import numpy as np
import pytest

from horizon.engine import Engine, analyze
from horizon.models import AnalysisRequest, CoverageRequest
from horizon.terrain import Terrain, TerrainError, height_to_egm96


def test_sampling_masks_negative_elevations_and_edges(store, raster_factory):
    h = np.full((100, 100), -15, dtype="float32")
    h[50, 50] = -9999
    m = raster_factory(h)
    t = Terrain(store, [m["id"]])
    try:
        assert t.point(-88.09, 42.39) == -15
        assert np.isnan(t.sample([-88.0495], [42.3495])[0])
        with pytest.raises(TerrainError):
            t.point(-90, 42)
    finally:
        t.close()


def test_missing_datum_never_assumed():
    with pytest.raises(TerrainError, match="unresolved"):
        height_to_egm96(-88, 42, 100, None)
    assert height_to_egm96(-88, 42, 100, "EGM96") == 100


def test_unknown_hardware_not_green(store, project):
    project.radios[1].tx_dbm = None
    result = analyze(store, AnalysisRequest(project=project))
    assert result["summary"].get("green", 0) == 0
    assert all(s["state"] == "unknown" for s in result["samples"])


def test_home_and_agl_frames_are_distinct(store, project):
    e = Engine(store, project)
    try:
        project.home.altitude_m = 220
        e.close()
        e = Engine(store, project)
        w = project.waypoints[0]
        assert e.altitude(w) == 300
        w.altitude_mode = "agl"
        assert e.altitude(w) == 280
        w.altitude_mode = "amsl"
        assert e.altitude(w) == 80
    finally:
        e.close()


def test_missing_terrain_on_ray_is_unknown(store, project):
    project.station.lon = -90
    result = analyze(store, AnalysisRequest(project=project))
    assert all(s["state"] == "unknown" for s in result["samples"])
    assert all("terrain" in s["reason"].lower() for s in result["samples"])


def test_coverage_and_altitude_bounds(store, project):
    box = CoverageRequest(west=-88, south=42.25, east=-87.995, north=42.255, agl_m=80, cell_m=200)
    r = analyze(store, AnalysisRequest(project=project, kind="coverage", coverage=box))
    assert r["samples"] and all(s["agl_m"] == 80 for s in r["samples"])
    with pytest.raises(ValueError, match="maximum"):
        AnalysisRequest(project=project, kind="altitude")
    project.settings.max_agl_m = 120
    e = Engine(store, project)
    try:
        s = e.find_altitude(-88, 42.25)
        assert s["status"] == "found" and 10 <= s["agl_m"] <= 120
        project.radios[1].sensitivity_dbm = -1
        assert e.find_altitude(-88, 42.25)["status"] == "no_pass"
    finally:
        e.close()


def test_required_video_missing_profile_is_unknown(store, project):
    project.radios = [r for r in project.radios if r.role != "video"]
    r = analyze(store, AnalysisRequest(project=project))
    assert r["summary"].get("green", 0) == 0


def test_cancel_hook_interrupts_analysis(store, project):
    def stop():
        raise InterruptedError("cancel")

    with pytest.raises(InterruptedError):
        analyze(store, AnalysisRequest(project=project), tick=stop)


def test_finer_raster_nodata_does_not_silently_use_coarse(store, raster_factory):
    coarse = raster_factory()
    fine = raster_factory(np.full((100, 100), -9999, dtype="float32"), pixel=0.0001)
    t = Terrain(store, [coarse["id"], fine["id"]])
    try:
        with pytest.raises(TerrainError):
            t.point(-88.095, 42.395)
    finally:
        t.close()


def test_projected_geotiff_sampling(store, raster_factory):
    from pyproj import Transformer

    east, north = Transformer.from_crs(4326, 32616, always_xy=True).transform(-88, 42.25)
    tile = raster_factory(west=east - 500, north=north + 500, pixel=10, crs="EPSG:32616")
    terrain = Terrain(store, [tile["id"]])
    try:
        assert terrain.point(-88, 42.25) == pytest.approx(200)
        assert tile["resolution_m"] == pytest.approx(10, abs=0.02)
    finally:
        terrain.close()
