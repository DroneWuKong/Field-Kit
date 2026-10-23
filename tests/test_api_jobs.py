import time

import pytest
from fastapi.testclient import TestClient

from horizon.api import create_app
from horizon.jobs import Jobs
from horizon.models import AnalysisRequest
from horizon.storage import fingerprint
from horizon.terrain import TerrainError, register


def test_project_snapshot_staleness_and_origin(store, project):
    with TestClient(create_app(store.root)) as client:
        p = project.model_dump()
        assert client.put("/api/v1/projects/" + project.id, json=p).status_code == 200
        saved_hash = fingerprint(client.get("/api/v1/projects/" + project.id).json())
        job = client.post("/api/v1/analyses", json=AnalysisRequest(project=project).model_dump()).json()
        for _ in range(100):
            current = client.get("/api/v1/jobs/" + job["id"]).json()
            if current["status"] in {"complete", "failed"}:
                break
            time.sleep(0.05)
        assert current["status"] == "complete", current
        assert not current["stale"]
        result = client.get("/api/v1/jobs/" + job["id"] + "/result").json()
        assert result["samples"]
        p["station"]["height_m"] += 5
        client.put("/api/v1/projects/" + project.id, json=p)
        assert client.get("/api/v1/jobs/" + job["id"]).json()["stale"]
        assert store.get("job", job["id"])["project_hash"] == saved_hash
        assert (
            client.post("/api/v1/projects", headers={"Origin": "https://unrelated.example"}).status_code
            == 403
        )


def test_cancellation_cannot_be_overwritten_and_restart(store, project):
    jobs = Jobs(store)
    job = jobs.start("analysis", AnalysisRequest(project=project).model_dump())
    started = time.monotonic()
    assert jobs.cancel(job["id"])["status"] == "cancelled"
    assert time.monotonic() - started < 3
    store.update_job(job["id"], status="complete", done=500)
    assert store.get("job", job["id"])["status"] == "cancelled"
    jobs.close()
    store.put("job", "orphan", {"id": "orphan", "status": "running"})
    restarted = Jobs(store)
    assert store.get("job", "orphan")["status"] == "failed"
    restarted.close()


def test_registered_datum_is_immutable(store, raster_factory):
    record = raster_factory()
    path = store.root / "terrain" / (record["id"] + ".tif")
    assert register(store, path, "EGM96") == record
    with pytest.raises(TerrainError, match="different datum"):
        register(store, path, "NAVD88")
