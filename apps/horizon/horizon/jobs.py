import multiprocessing as mp
import threading
import time
import traceback
from uuid import uuid4

from .catalog import download_products, prepare_grids
from .engine import analyze
from .models import AnalysisRequest
from .storage import Store, fingerprint, now


def worker(root, ident, kind, payload):
    store = Store(root)
    last_report = 0

    def tick():
        if store.get("job", ident)["status"] == "cancelled":
            raise InterruptedError("Cancelled")

    def progress(done, total, downloaded=0):
        nonlocal last_report
        tick()
        if time.monotonic() - last_report > 0.2 or done == total:
            store.update_job(ident, done=done, total=total, downloaded_bytes=downloaded)
            last_report = time.monotonic()

    try:
        store.update_job(ident, status="running", started_at=now())
        start = time.monotonic()
        if kind == "analysis":
            result = analyze(store, AnalysisRequest.model_validate(payload), progress, tick)
        elif kind == "download":
            result = download_products(store, payload["products"], payload["datum"], tick, progress)
        elif kind == "grids":
            result = prepare_grids(store, payload["ids"], tick)
        else:
            raise ValueError("Unknown job type")
        tick()
        store.atomic_json(f"results/{ident}.json", result)
        store.update_job(ident, status="complete", elapsed_s=time.monotonic() - start, finished_at=now())
    except InterruptedError:
        store.update_job(ident, status="cancelled")
    except Exception as exc:
        traceback.print_exc()
        store.update_job(ident, status="failed", error=str(exc), finished_at=now())


class Jobs:
    def __init__(self, store, limit=2):
        self.store, self.limit = store, limit
        self.processes = {}
        self.lock = threading.Lock()
        for job in store.list("job"):
            if job["status"] in {"queued", "running"}:
                store.update_job(job["id"], status="failed", error="Application restarted; rerun this job")

    def start(self, kind, payload):
        with self.lock:
            self.processes = {k: v for k, v in self.processes.items() if v.is_alive()}
            if len(self.processes) >= self.limit:
                raise ValueError("Two jobs are already running; cancel or wait for one")
            ident = str(uuid4())
            project = payload.get("project")
            job = {
                "id": ident,
                "kind": kind,
                "status": "queued",
                "created_at": now(),
                "done": 0,
                "total": 0,
                "project_id": project.get("id") if project else None,
                "project_hash": fingerprint(project) if project else None,
                "error": None,
            }
            self.store.put("job", ident, job)
            process = mp.get_context("spawn").Process(
                target=worker, args=(str(self.store.root), ident, kind, payload), daemon=True
            )
            process.start()
            self.processes[ident] = process
            threading.Thread(target=self._watch, args=(ident, process), daemon=True).start()
            return job

    def _watch(self, ident, process):
        process.join()
        job = self.store.get("job", ident)
        if job["status"] in {"running", "queued"}:
            self.store.update_job(
                ident, status="failed", error=f"Worker exited unexpectedly ({process.exitcode})"
            )

    def cancel(self, ident):
        job = self.store.get("job", ident)
        if job["status"] not in {"queued", "running"}:
            return job
        self.store.update_job(ident, status="cancelled", finished_at=now())
        with self.lock:
            process = self.processes.get(ident)
            if process and process.is_alive():
                process.terminate()
                process.join(timeout=1)
                if process.is_alive():
                    process.kill()
                    process.join(timeout=1)
        return self.store.get("job", ident)

    def close(self):
        for ident in list(self.processes):
            self.cancel(ident)
