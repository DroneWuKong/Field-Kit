"""Portable desktop entry point. Keep worker bootstrap ahead of application imports."""
import multiprocessing

if __name__ == "__main__":
    multiprocessing.freeze_support()

import argparse
import json
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Prismo Field Kit / Horizon desktop planner")
    parser.add_argument("--data", type=Path)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port between 1024 and 65535")
    bundle = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    data = (args.data or Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local"))
            / "PrismoFieldKit" / "Horizon").resolve()
    url = f"http://127.0.0.1:{args.port}"
    # A second launch only reuses a service that identifies the same data directory.
    try:
        with urllib.request.urlopen(url + "/api/v1/health", timeout=1) as response:
            existing = json.load(response)
        if Path(existing.get("data_directory", "")).resolve() == data and existing.get("mode") == "local":
            if not args.no_browser:
                webbrowser.open(url)
            print(f"Workspace is already running at {url}")
            return
    except (OSError, ValueError):
        pass
    with socket.socket() as probe:
        if os.name == "nt":
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        probe.bind(("127.0.0.1", args.port))
    os.environ["PROJ_NETWORK"] = "OFF"
    os.environ["HORIZON_BUNDLED_GRIDS"] = str(bundle / "grids")
    os.environ["HORIZON_FIELDKIT_ASSETS"] = str(bundle / "fieldkit")
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    data.mkdir(parents=True, exist_ok=True)
    import uvicorn

    from horizon.api import create_app
    app = create_app(data, bundle / "frontend")

    def open_when_ready():
        for _ in range(120):
            try:
                with urllib.request.urlopen(url + "/api/v1/health", timeout=1) as response:
                    health = json.load(response)
                if Path(health["data_directory"]).resolve() == data:
                    webbrowser.open(url)
                    return
            except (OSError, ValueError, KeyError):
                time.sleep(.25)

    if not args.no_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()
    print(f"Prismo Field Kit / Horizon\n{url}\nData: {data}\nKeep this window open. Ctrl+C stops the planner.")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as exc:
        print(f"Could not start the planner: {exc}", file=sys.stderr)
        if not getattr(sys, "frozen", False) or "--no-browser" in sys.argv:
            raise SystemExit(1) from exc
        input("Press Enter to close…")
        raise SystemExit(1) from exc
