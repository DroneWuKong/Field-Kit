import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from horizon.models import Home, Project, Station, Waypoint
from horizon.storage import Store
from horizon.terrain import register


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "data")


@pytest.fixture
def raster_factory(tmp_path, store):
    def make(values=None, west=-88.1, north=42.4, pixel=0.001, datum="EGM96", crs="EPSG:4326"):
        values = (
            np.full((300, 300), 200.0, dtype="float32")
            if values is None
            else np.asarray(values, dtype="float32")
        )
        path = tmp_path / f"raster-{len(store.list('terrain'))}.tif"
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            width=values.shape[1],
            height=values.shape[0],
            count=1,
            dtype="float32",
            crs=crs,
            transform=from_origin(west, north, pixel, pixel),
            nodata=-9999,
        ) as ds:
            ds.write(values, 1)
        return register(store, path, datum)

    return make


@pytest.fixture
def project(raster_factory):
    terrain = raster_factory()
    p = Project(
        home=Home(lat=42.25, lon=-88.02, altitude_m=200),
        station=Station(lat=42.25, lon=-88.02, height_m=10),
        terrain_ids=[terrain["id"]],
        waypoints=[
            Waypoint(lat=42.25, lon=-88.0, altitude_m=80),
            Waypoint(lat=42.26, lon=-87.98, altitude_m=90),
        ],
    )
    for r in p.radios:
        r.tx_dbm = 30
        r.sensitivity_dbm = -120
    return p
