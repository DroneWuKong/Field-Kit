import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_origin

from .models import Home, Project, Station, Waypoint
from .terrain import register


def create_demo(store):
    """Entirely synthetic elevations and assumed radios, never USGS measurements."""
    size = 1400
    west, north, pixel = -88.05, 42.34, 0.0001
    lon = west + (np.arange(size) + 0.5) * pixel
    lat = north - (np.arange(size) + 0.5) * pixel
    x, y = np.meshgrid(lon, lat)
    h = 180 + 11 * np.sin((x + 88) * 100) * np.cos((y - 42.28) * 90)
    h += 83 * np.exp(-(((x + 87.987) / 0.007) ** 2)) * (0.4 + 0.6 * np.exp(-(((y - 42.27) / 0.034) ** 2)))
    with tempfile.NamedTemporaryFile(suffix=".tif", dir=store.root / "downloads") as f:
        with rasterio.open(
            f.name,
            "w",
            driver="GTiff",
            width=size,
            height=size,
            count=1,
            dtype="float32",
            crs="EPSG:4326",
            transform=from_origin(west, north, pixel, pixel),
            tiled=True,
            compress="deflate",
            nodata=-9999,
        ) as ds:
            ds.write(h.astype("float32"), 1)
            ds.update_tags(
                SYNTHETIC="true", DESCRIPTION="Mathematical demonstration terrain, not real elevations"
            )
        meta = register(store, f.name, "EGM96", {"title": "Synthetic ridge demonstration"})
    meta["name"] = "Synthetic ridge · demonstration only"
    store.put("terrain", meta["id"], meta)
    p = Project(
        name="Ridge crossing · synthetic example",
        terrain_ids=[meta["id"]],
        station=Station(lat=42.255, lon=-88.025, height_m=3),
        home=Home(lat=42.255, lon=-88.025, altitude_m=None),
        waypoints=[
            Waypoint(lat=lat, lon=lon, altitude_m=65, params=[0, 0, 0, 0])
            for lat, lon in [(42.255, -88.02), (42.279, -87.999), (42.29, -87.97), (42.271, -87.95)]
        ],
    )
    p.settings.max_agl_m = 140
    for r in p.radios:
        r.tx_dbm = 27
        r.sensitivity_dbm = -110 if r.role == "control" else -90
        r.tx_gain_dbi = 2
        r.rx_gain_dbi = 2 if r.role == "control" else 12
        r.cable_loss_db = 1
        r.notes = "Hypothetical demonstration settings; not verified IRONghost specifications"
    from .engine import Engine

    e = Engine(store, p)
    try:
        p.home.altitude_m = e.home_alt
    finally:
        e.close()
    store.put("project", p.id, p.model_dump())
    return p
