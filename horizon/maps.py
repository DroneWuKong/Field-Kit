import io
import math
from functools import lru_cache

import numpy as np
from PIL import Image

from .terrain import Terrain


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
    base = np.stack([70 + shade * 89, 92 + shade * 91, 82 + shade * 77], axis=-1)
    # Contours are a display aid only; calculations always use native DEM cells.
    contour = np.mod(clean, 20) < np.maximum(0.6, np.hypot(dx, dy) * metres * 0.4)
    base[contour] *= 0.78
    rgba = np.concatenate([base, (valid * 255)[..., None]], axis=-1)[1:-1, 1:-1].astype("uint8")
    output = io.BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    return output.getvalue()
