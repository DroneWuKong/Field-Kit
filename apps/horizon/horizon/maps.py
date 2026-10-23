import io
import math
from functools import lru_cache

import numpy as np
from PIL import Image

from .terrain import Terrain

# One palette/range for the whole selected dataset, never per-map-tile normalization.
PALETTE = ["#162d59", "#215d8a", "#348e9a", "#7ab4a1", "#b5bd84", "#ce9f87", "#b97ca5", "#dfc4d6"]


@lru_cache(maxsize=32)
def display_range(root, terrain_ids, grid_revision=0):
    from .storage import Store

    terrain = Terrain(Store(root), terrain_ids)
    values = []
    try:
        for record in terrain.records:
            west, south, east, north = record["bounds"]
            xs, ys = np.meshgrid(np.linspace(west, east, 67)[1:-1], np.linspace(south, north, 67)[1:-1])
            samples = terrain.sample(xs.ravel(), ys.ravel())
            values.extend(samples[np.isfinite(samples)].tolist())
    finally:
        terrain.close()
    low = math.floor(min(values) / 10) * 10 if values else 0
    high = max(low + 20, math.ceil(max(values) / 10) * 10) if values else 100
    interval = max(5, round((high - low) / 100) * 10)
    return {"low": low, "high": high, "colors": PALETTE, "available": bool(values), "contour_m": interval}


@lru_cache(maxsize=256)
def tile(root, terrain_ids, z, x, y, grid_revision=0):
    from .storage import Store

    if z < 0 or z > 19 or x < 0 or y < 0 or x >= 2**z or y >= 2**z:
        raise ValueError("Invalid tile coordinates")
    size = 256
    # Pixel centres and a one-pixel halo for shading gradients.
    xs = (x + (np.arange(-1, size + 1) + 0.5) / size) / 2**z
    ys = (y + (np.arange(-1, size + 1) + 0.5) / size) / 2**z
    lon = xs * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * ys))))
    lons, lats = np.meshgrid(lon, lat)
    terrain = Terrain(Store(root), terrain_ids)
    try:
        heights = terrain.sample(lons.ravel(), lats.ravel()).reshape((size + 2, size + 2))
    finally:
        terrain.close()
    valid = np.isfinite(heights)
    clean = np.nan_to_num(heights)
    metres = 40075016.686 * math.cos(math.radians(float(lat[size // 2]))) / (2**z * size)
    dy, dx = np.gradient(clean, metres)
    slope = np.arctan(np.hypot(dx, dy))
    aspect = np.arctan2(-dx, dy)
    shade = np.clip(
        math.sin(math.pi / 4) * np.cos(slope)
        + math.cos(math.pi / 4) * np.sin(slope) * np.cos(aspect - 7 * math.pi / 4),
        0,
        1,
    )
    scale = display_range(root, terrain_ids, grid_revision)
    colors = np.array([[int(color[i : i + 2], 16) for i in (1, 3, 5)] for color in PALETTE])
    position = np.clip((clean - scale["low"]) / (scale["high"] - scale["low"]), 0, 1)
    base = np.stack(
        [np.interp(position, np.linspace(0, 1, len(colors)), colors[:, i]) for i in range(3)], axis=-1
    )
    base *= (0.68 + shade * 0.42)[..., None]
    # Subtle contour ink; the actual radio engine still uses native DEM cells.
    interval = scale["contour_m"]
    distance = np.minimum(np.mod(clean, interval), interval - np.mod(clean, interval))
    width = np.maximum(0.2, np.hypot(dx, dy) * metres * 0.55)
    ink = np.clip(1 - distance / width, 0, 1) * 0.24
    base = base * (1 - ink[..., None]) + np.array([219, 233, 245]) * ink[..., None]
    base = np.clip(base, 0, 255)
    rgba = np.concatenate([base, (valid * 255)[..., None]], axis=-1)[1:-1, 1:-1].astype("uint8")
    output = io.BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    return output.getvalue()
