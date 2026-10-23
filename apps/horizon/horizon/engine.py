import math
from collections import Counter

import numpy as np

from .missions import segment_known
from .models import AnalysisRequest
from .propagation import MODEL_VERSION, clearance, diffraction, fspl
from .storage import fingerprint, now
from .terrain import GEOD, Terrain, TerrainError, file_hash, height_to_egm96


def combined(links, required):
    states = [links.get(key, {}).get("state", "unknown") for key in required]
    for state in ("red", "unknown", "amber"):
        if state in states:
            return state
    return "green" if states else "unknown"


def required_radios(p):
    ids = [p.settings.selected_control, *p.settings.required_telemetry]
    if p.settings.require_video:
        ids += [r.id for r in p.radios if r.role == "video"] or ["missing-video"]
    return ids


class Engine:
    def __init__(self, store, project):
        self.p = project
        self.terrain = Terrain(store, project.terrain_ids)
        self.required = required_radios(project)
        self.home_alt = None
        self.home_error = None
        try:
            h = project.home
            if h.datum is None:
                raise TerrainError("Record the planned-home vertical datum")
            self.home_alt = (
                self.terrain.point(h.lon, h.lat)
                if h.altitude_m is None
                else height_to_egm96(h.lon, h.lat, h.altitude_m, h.datum)
            )
        except Exception as e:
            self.home_error = str(e)

    def close(self):
        self.terrain.close()

    def altitude(self, wp):
        if wp.altitude_mode == "agl":
            return self.terrain.point(wp.lon, wp.lat) + wp.altitude_m
        if wp.altitude_mode == "home":
            if self.home_alt is None:
                raise TerrainError(self.home_error or "Home altitude unresolved")
            return self.home_alt + wp.altitude_m
        return height_to_egm96(wp.lon, wp.lat, wp.altitude_m, self.p.altitude_datum)

    def evaluate(self, lon, lat, altitude, profile=None, detail=False):
        p, s = self.p, self.p.settings
        result = {
            "lon": float(lon),
            "lat": float(lat),
            "altitude_m": altitude,
            "terrain_m": None,
            "state": "unknown",
            "links": {},
            "reason": None,
        }
        try:
            x, h = (
                profile
                if profile is not None
                else self.terrain.profile(p.station, lon, lat, s.profile_step_m)
            )
            if not np.all(np.isfinite(h)):
                raise TerrainError(
                    self.terrain.errors[-1]
                    if self.terrain.errors
                    else "Terrain is missing along the radio path"
                )
            result["terrain_m"] = float(h[-1])
            if altitude is None:
                raise TerrainError("Aircraft altitude is unresolved")
            ground_ant = h[0] + p.station.height_m
            result["agl_m"] = float(altitude - h[-1])
            slant = math.hypot(x[-1], altitude - ground_ant)
            if x[-1] < 1 or slant < 1:
                raise TerrainError(
                    "Near-vertical/near-field path: radio prediction unavailable within 1 m horizontal distance"
                )
            if altitude <= h[-1]:
                result.update(state="red", reason="Planned antenna is at or below the terrain surface")
                return result
            for r in p.radios:
                c = clearance(x, h, ground_ant, altitude, r.frequency_mhz, s.k_factor)
                loss = diffraction(
                    x,
                    h,
                    ground_ant,
                    altitude,
                    r.frequency_mhz,
                    s.k_factor,
                    r.polarization,
                    s.epsilon,
                    s.conductivity,
                )
                free = fspl(slant, r.frequency_mhz)
                link = {
                    "state": "unknown",
                    "margin_db": None,
                    "rx_dbm": None,
                    "free_space_db": free,
                    "diffraction_db": loss,
                    "clearance_fraction": c["fraction"],
                    "obstruction_m": c["obstruction_m"],
                    "clearance_m": c["clearance_m"],
                    "los": c["los"],
                    "reason": None,
                }
                if r.tx_dbm is None or r.sensitivity_dbm is None:
                    link["reason"] = "Enter transmit power and receiver/usable-video threshold"
                elif c["fraction"] < s.fresnel_fraction and abs(
                    math.atan2(altitude - ground_ant, x[-1])
                ) > math.radians(12):
                    link["reason"] = (
                        "Steep obstructed path: outside the small-angle diffraction approximation"
                    )
                else:
                    received = (
                        r.tx_dbm
                        + r.tx_gain_dbi
                        + r.rx_gain_dbi
                        - r.cable_loss_db
                        - r.additional_loss_db
                        - free
                        - loss
                    )
                    margin = received - r.sensitivity_dbm
                    link.update(
                        rx_dbm=received,
                        margin_db=margin,
                        state="red"
                        if margin < 0
                        else "amber"
                        if margin < s.margin_db or c["fraction"] < s.fresnel_fraction
                        else "green",
                    )
                result["links"][r.id] = link
            result["state"] = combined(result["links"], self.required)
            if detail:
                # Full-resolution calculation, bounded display payload with extrema retained.
                keep = set(np.linspace(0, len(x) - 1, min(len(x), 1500), dtype=int).tolist())
                for r in p.radios:
                    c = clearance(x, h, ground_ant, altitude, r.frequency_mhz, s.k_factor)
                    keep.add(int(np.argmin(abs(x - c["obstruction_m"]))))
                ix = np.array(sorted(keep))
                c = clearance(x, h, ground_ant, altitude, p.radios[0].frequency_mhz, s.k_factor)
                result["profile"] = {
                    "distance_m": x[ix].tolist(),
                    "terrain_m": h[ix].tolist(),
                    "curved_terrain_m": (h + c["bulge"])[ix].tolist(),
                    "line_m": c["line"][ix].tolist(),
                    "fresnel_m": {
                        r.id: clearance(x, h, ground_ant, altitude, r.frequency_mhz, s.k_factor)["fresnel"][
                            ix
                        ].tolist()
                        for r in p.radios
                    },
                    "calculation_points": len(x),
                }
        except (TerrainError, ValueError) as exc:
            result["reason"] = str(exc)
        return result

    def route_points(self):
        p = self.p
        points, travelled = [], 0.0
        previous_alt = None
        previous_error = None
        for i, wp in enumerate(p.waypoints):
            try:
                altitude, error = self.altitude(wp), None
            except (TerrainError, ValueError) as exc:
                altitude, error = None, str(exc)
            if i:
                first = p.waypoints[i - 1]
                az, _, length = GEOD.inv(first.lon, first.lat, wp.lon, wp.lat)
                count = max(1, math.ceil(length / p.settings.route_step_m))
                if len(points) + count > 100000:
                    raise ValueError("Route exceeds 100,000 analysis samples; increase route spacing")
                known = segment_known(p, first, wp)
                # Straight segments interpolate absolute heights; terrain-frame
                # segments interpolate AGL only when both endpoints use that frame.
                for j in range(1, count):
                    f = j / count
                    lon, lat, _ = GEOD.fwd(first.lon, first.lat, az, length * f)
                    z = None
                    err = error or previous_error
                    if not known:
                        err = "Unsupported mission item interrupts this segment"
                    elif first.altitude_mode == wp.altitude_mode == "agl":
                        try:
                            z = (
                                self.terrain.point(lon, lat)
                                + first.altitude_m
                                + f * (wp.altitude_m - first.altitude_m)
                            )
                        except TerrainError as e:
                            err = str(e)
                    elif altitude is not None and previous_alt is not None:
                        z = previous_alt + f * (altitude - previous_alt)
                    points.append(
                        dict(
                            lon=lon,
                            lat=lat,
                            altitude=z,
                            distance_m=travelled + length * f,
                            waypoint_index=None,
                            segment=i - 1,
                            error=err,
                        )
                    )
                travelled += length
            points.append(
                dict(
                    lon=wp.lon,
                    lat=wp.lat,
                    altitude=altitude,
                    distance_m=travelled,
                    waypoint_index=i,
                    segment=max(0, i - 1),
                    error=error,
                )
            )
            previous_alt, previous_error = altitude, error
        return points

    def find_altitude(self, lon, lat, tick=lambda: None):
        s = self.p.settings
        x, h = self.terrain.profile(self.p.station, lon, lat, s.profile_step_m)
        if not np.all(np.isfinite(h)):
            return {"status": "unknown", "agl_m": None, "reason": "Missing terrain or datum grid"}
        if any(r.tx_dbm is None or r.sensitivity_dbm is None for r in self.p.radios if r.id in self.required):
            return {"status": "unknown", "agl_m": None, "reason": "Required radio settings are incomplete"}
        candidates = list(np.arange(s.min_agl_m, s.max_agl_m, 5)) + [s.max_agl_m]
        last = s.min_agl_m
        saw_unknown = False
        for agl in candidates:
            tick()
            out = self.evaluate(lon, lat, float(h[-1] + agl), (x, h))
            saw_unknown |= out["state"] == "unknown"
            if out["state"] == "green":
                for refined in np.arange(last, agl, 1):
                    tick()
                    r = self.evaluate(lon, lat, float(h[-1] + refined), (x, h))
                    if r["state"] == "green":
                        return {"status": "found", "agl_m": float(refined), "reason": None}
                return {"status": "found", "agl_m": float(agl), "reason": None}
            last = agl
        return {
            "status": "unknown" if saw_unknown else "no_pass",
            "agl_m": None,
            "reason": "Some evaluated paths are unresolved"
            if saw_unknown
            else "No evaluated altitude meets all criteria",
        }


def analyze(store, request: AnalysisRequest, progress=lambda done, total: None, tick=lambda: None):
    p = request.project
    engine = Engine(store, p)
    try:
        if request.kind == "coverage":
            box = request.coverage
            midlat = (box.north + box.south) / 2
            dy = box.cell_m / 111320
            dx = dy / math.cos(math.radians(midlat))
            points = []
            for lat in np.arange(box.south + dy / 2, box.north, dy):
                for lon in np.arange(box.west + dx / 2, box.east, dx):
                    points.append(dict(lon=float(lon), lat=float(lat), altitude=None, cell_dx=dx, cell_dy=dy))
        else:
            points = engine.route_points()
        samples = []
        for i, point in enumerate(points):
            tick()
            if request.kind == "coverage":
                try:
                    point["altitude"] = (
                        engine.terrain.point(point["lon"], point["lat"]) + request.coverage.agl_m
                    )
                except TerrainError as exc:
                    point["error"] = str(exc)
            out = engine.evaluate(point["lon"], point["lat"], point["altitude"])
            if point.get("error"):
                out.update(state="unknown", reason=point["error"], links={})
            out.update({k: v for k, v in point.items() if k not in {"altitude", "error"}})
            if request.kind == "altitude":
                out["suggestion"] = (
                    engine.find_altitude(point["lon"], point["lat"], tick)
                    if not point.get("error")
                    else {"status": "unknown", "agl_m": None, "reason": point["error"]}
                )
            samples.append(out)
            progress(i + 1, len(points))
        return {
            "model": MODEL_VERSION,
            "created_at": now(),
            "kind": request.kind,
            "project_hash": fingerprint(p.model_dump()),
            "request": request.model_dump(),
            "terrain": engine.terrain.records,
            "datum_grids": [
                {"name": path.name, "sha256": file_hash(path), "size_bytes": path.stat().st_size}
                for path in sorted((store.root / "grids").glob("*.tif"))
            ],
            "required_radios": engine.required,
            "synthetic": any(m["synthetic"] for m in engine.terrain.records),
            "summary": dict(Counter(s["state"] for s in samples)),
            "samples": samples,
            "limitations": [
                "Bare-earth path profiles; buildings and vegetation excluded",
                "Static gains; aircraft attitude, multipath and interference not modeled",
                "Straight planned segments; turn, climb and flight dynamics not simulated",
                "Altitude suggestions are the lowest evaluated samples, not a flight trajectory",
            ],
            "warnings": (p.source.warnings if p.source else []) + engine.terrain.errors,
        }
    finally:
        engine.close()
