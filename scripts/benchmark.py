"""Repeatable real-terrain workload; use a prepared local data directory."""

import argparse
import json
import platform
import time
from pathlib import Path

from pyproj import Geod

from horizon.engine import analyze
from horizon.models import AnalysisRequest, CoverageRequest, Home, Project, Station, Waypoint
from horizon.storage import Store
from horizon.terrain import Terrain

parser = argparse.ArgumentParser()
parser.add_argument("--data", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
store = Store(args.data)
record = store.list("terrain")[0]
t = Terrain(store, [record["id"]])
lat, lon = 42.5, -87.8
alt = t.point(lon, lat)
t.close()
geod = Geod(ellps="WGS84")
p = Project(
    name="20 km / 100 waypoint benchmark",
    home=Home(lat=lat, lon=lon, altitude_m=alt),
    station=Station(lat=lat, lon=lon, height_m=10),
    terrain_ids=[record["id"]],
)
for i in range(100):
    x, y, _ = geod.fwd(lon, lat, 0, 100 + i * 20000 / 99)
    p.waypoints.append(Waypoint(lon=x, lat=y, altitude_m=120, altitude_mode="agl"))
for r in p.radios:
    r.tx_dbm = 27
    r.sensitivity_dbm = -100
w, s, _ = geod.fwd(lon, lat, 225, 2**0.5 * 10000)
e, n, _ = geod.fwd(lon, lat, 45, 2**0.5 * 10000)
report = {
    "platform": platform.platform(),
    "processor": platform.processor(),
    "terrain_sha256": record["id"],
    "assumed_radios": True,
    "benchmarks": [],
}
for kind in ["route", "coverage"]:
    req = AnalysisRequest(
        project=p,
        kind=kind,
        coverage=CoverageRequest(west=w, south=s, east=e, north=n, agl_m=120, cell_m=200)
        if kind == "coverage"
        else None,
    )
    start = time.perf_counter()
    result = analyze(store, req)
    elapsed = time.perf_counter() - start
    item = {
        "kind": kind,
        "elapsed_s": elapsed,
        "samples": len(result["samples"]),
        "summary": result["summary"],
        "route_step_m": p.settings.route_step_m,
        "profile_step_m": p.settings.profile_step_m,
        "coverage_cell_m": 200 if kind == "coverage" else None,
    }
    report["benchmarks"].append(item)
    print(json.dumps(item), flush=True)
    Path(args.output).write_text(json.dumps(report, indent=2))
