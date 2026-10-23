"""Read native DEM cells with masks, explicit vertical transformations and a block cache."""

import hashlib
import math
import shutil
import warnings
from collections import OrderedDict
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Geod, Transformer, datadir, network
from pyproj.aoi import AreaOfInterest
from pyproj.crs import CompoundCRS
from pyproj.transformer import TransformerGroup
from rasterio.warp import transform_bounds
from rasterio.windows import Window

from .storage import now

GEOD = Geod(ellps="WGS84")
VERTICAL = {"EGM96": 5773, "NAVD88": 5703}
EGM96 = CompoundCRS("WGS84 + EGM96", [CRS(4326), CRS(5773)])


class TerrainError(ValueError):
    pass


def compound(horizontal, datum):
    horizontal = CRS(horizontal).to_2d()
    return (
        horizontal.to_3d()
        if datum == "WGS84_ELLIPSOID"
        else CompoundCRS(f"{horizontal.name} + {datum}", [horizontal, CRS(VERTICAL[datum])])
    )


def vertical_transform(crs, datum, area=None):
    if datum is None:
        raise TerrainError("Vertical datum is unresolved")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        group = TransformerGroup(
            compound(crs, datum), EGM96, always_xy=True, allow_ballpark=False, area_of_interest=area
        )
    if not group.best_available or not group.transformers:
        grids = sorted(
            {g.short_name for op in group.unavailable_operations for g in op.grids if not g.available}
        )
        raise TerrainError(
            "Required datum transformation unavailable; prepare grids: " + ", ".join(grids[:6])
        )
    return group.transformers[0]


def height_to_egm96(lon, lat, value, datum):
    if datum == "EGM96":
        return float(value)
    t = vertical_transform(CRS(4326), datum, AreaOfInterest(lon - 0.01, lat - 0.01, lon + 0.01, lat + 0.01))
    z = t.transform(lon, lat, value, errcheck=True)[2]
    if not math.isfinite(z):
        raise TerrainError("Invalid transformed elevation")
    return float(z)


def file_hash(path):
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            sha.update(b)
    return sha.hexdigest()


def register(store, path, datum=None, source=None):
    path = Path(path)
    with rasterio.open(path) as ds:
        if ds.driver != "GTiff" or ds.count != 1 or ds.crs is None:
            raise TerrainError("Import a single-band georeferenced GeoTIFF elevation raster")
        crs = CRS(ds.crs)
        verticals = [c.to_epsg() for c in crs.sub_crs_list if c.is_vertical]
        detected = next((key for key, value in VERTICAL.items() if value in verticals), None)
        if detected and datum and detected != datum:
            raise TerrainError(f"Supplied datum {datum} conflicts with raster datum {detected}")
        datum = datum or detected
        if datum not in VERTICAL and datum != "WGS84_ELLIPSOID":
            raise TerrainError("The file has no supported vertical datum; explicitly choose EGM96 or NAVD88")
        if ds.units[0] not in (None, "m", "metre", "meter", "metres", "meters"):
            raise TerrainError("Convert elevation values to metres before importing")
        horizontal = crs.to_2d()
        bounds = transform_bounds(ds.crs, "EPSG:4326", *ds.bounds, densify_pts=21)
        if bounds[2] - bounds[0] > 180 or bounds[1] < -85 or bounds[3] > 85:
            raise TerrainError("Split dateline-crossing or polar rasters before import")
        t = Transformer.from_crs(horizontal, 4326, always_xy=True)
        p = [
            t.transform(*(ds.transform * xy))
            for xy in [
                (ds.width / 2, ds.height / 2),
                (ds.width / 2 + 1, ds.height / 2),
                (ds.width / 2, ds.height / 2 + 1),
            ]
        ]
        resolution = min(GEOD.inv(*p[0], *p[1])[2], GEOD.inv(*p[0], *p[2])[2])
        if resolution <= 0:
            raise TerrainError("Invalid raster cell size")
        metadata = {
            "name": path.name,
            "datum": datum,
            "crs": horizontal.to_wkt(),
            "bounds": list(bounds),
            "resolution_m": resolution,
            "width": ds.width,
            "height": ds.height,
            "units": "m",
            "synthetic": ds.tags().get("SYNTHETIC") == "true",
            "source": source,
            "registered_at": now(),
        }
    sha = file_hash(path)
    try:
        existing = store.get("terrain", sha)
    except KeyError:
        existing = None
    if existing:
        if existing["datum"] != datum:
            raise TerrainError("This raster is already registered with a different datum")
        return existing
    target = store.root / "terrain" / f"{sha}.tif"
    if not target.exists():
        tmp = target.with_suffix(".part")
        shutil.copyfile(path, tmp)
        tmp.replace(target)
    metadata.update(id=sha, sha256=sha, size_bytes=target.stat().st_size)
    store.put("terrain", sha, metadata)
    return metadata


class Terrain:
    def __init__(self, store, ids):
        self.store = store
        datadir.append_data_dir(str(store.root / "grids"))
        network.set_network_enabled(False)
        self.records = sorted([store.get("terrain", ident) for ident in ids], key=lambda m: m["resolution_m"])
        self.datasets = {}
        self.transforms = {}
        self.blocks = OrderedDict()
        self.errors = []

    @property
    def resolution(self):
        return min((m["resolution_m"] for m in self.records), default=10)

    def close(self):
        for ds in self.datasets.values():
            ds.close()

    def _open(self, meta):
        ident = meta["id"]
        if ident not in self.datasets:
            ds = rasterio.open(self.store.root / "terrain" / f"{ident}.tif")
            b = meta["bounds"]
            try:
                vertical = vertical_transform(meta["crs"], meta["datum"], AreaOfInterest(*b))
            except Exception:
                ds.close()
                raise
            self.datasets[ident] = ds
            self.transforms[ident] = (Transformer.from_crs(4326, meta["crs"], always_xy=True), vertical)
        return self.datasets[ident], self.transforms[ident]

    def sample(self, lons, lats):
        lons, lats = np.asarray(lons, dtype=float), np.asarray(lats, dtype=float)
        result = np.full(lons.shape, np.nan)
        claimed = np.zeros(lons.shape, dtype=bool)
        for meta in self.records:
            w, s, e, n = meta["bounds"]
            mask = (~claimed) & (lons >= w) & (lons <= e) & (lats >= s) & (lats <= n)
            indices = np.where(mask)[0]
            if not len(indices):
                continue
            # Do not silently replace missing high-resolution cells or a failed
            # datum conversion with coarser data under the same footprint.
            claimed[indices] = True
            try:
                ds, (xy_transform, z_transform) = self._open(meta)
                xs, ys = xy_transform.transform(lons[indices], lats[indices], errcheck=True)
                cs, rs = (~ds.transform) * (np.asarray(xs), np.asarray(ys))
                rows, cols = np.floor(rs).astype(int), np.floor(cs).astype(int)
                valid = (rows >= 0) & (rows < ds.height) & (cols >= 0) & (cols < ds.width)
                for br, bc in set(zip((rows[valid] // 256).tolist(), (cols[valid] // 256).tolist())):
                    take = valid & (rows // 256 == br) & (cols // 256 == bc)
                    key = (meta["id"], br, bc)
                    if key not in self.blocks:
                        win = Window(
                            bc * 256, br * 256, min(256, ds.width - bc * 256), min(256, ds.height - br * 256)
                        )
                        block = ds.read(1, window=win, masked=True).astype(float)
                        self.blocks[key] = block.filled(np.nan)
                        if len(self.blocks) > 256:
                            self.blocks.popitem(last=False)
                    self.blocks.move_to_end(key)
                    heights = self.blocks[key][rows[take] % 256, cols[take] % 256]
                    zs = z_transform.transform(np.asarray(xs)[take], np.asarray(ys)[take], heights)[2]
                    result[indices[take]] = np.where(np.isfinite(zs), zs, np.nan)
            except Exception as exc:
                reason = str(exc)
                if reason not in self.errors:
                    self.errors.append(reason)
        return result

    def point(self, lon, lat):
        value = self.sample([lon], [lat])[0]
        if not math.isfinite(value):
            raise TerrainError(self.errors[-1] if self.errors else "Missing terrain at requested location")
        return float(value)

    def profile(self, station, lon, lat, requested_step=10):
        az, _, distance = GEOD.inv(station.lon, station.lat, lon, lat)
        # Half a cell along the ray limits skipping narrow raster-cell ridges.
        step = min(requested_step, self.resolution / 2)
        count = max(3, math.ceil(distance / step) + 1)
        if count > 200001:
            raise TerrainError("Radio path exceeds the profile budget; reduce extent or use coarser terrain")
        x = np.linspace(0, max(distance, 0.001), count)
        lons, lats, _ = GEOD.fwd(
            np.full(count, station.lon), np.full(count, station.lat), np.full(count, az), x
        )
        return x, self.sample(lons, lats)


def grid_requirements(store, ids):
    datadir.append_data_dir(str(store.root / "grids"))
    network.set_network_enabled(False)
    required = {}
    for ident in ids:
        m = store.get("terrain", ident)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            group = TransformerGroup(
                compound(m["crs"], m["datum"]),
                EGM96,
                always_xy=True,
                allow_ballpark=False,
                area_of_interest=AreaOfInterest(*m["bounds"]),
            )
        if group.best_available:
            continue
        if not group.unavailable_operations:
            raise TerrainError("No supported datum transformation for " + m["name"])
        # The highest-ranked unavailable operation is the preferred operation.
        for grid in group.unavailable_operations[0].grids:
            if not grid.available:
                if (
                    not grid.open_license
                    or not grid.direct_download
                    or not grid.url.startswith("https://cdn.proj.org/")
                ):
                    raise TerrainError("Required grid cannot be downloaded automatically: " + grid.short_name)
                required[grid.short_name] = grid.url
    return required
