import csv
import io
import math

from .engine import Engine
from .terrain import height_to_egm96


def compare(store, project, text):
    rows = list(csv.DictReader(io.StringIO(text)))
    if len(rows) > 20000:
        raise ValueError("Limit observation imports to 20,000 rows")
    required = {"lat", "lon", "altitude_m", "altitude_reference", "frequency_mhz"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError(
            "CSV requires lat, lon, altitude_m, altitude_reference, frequency_mhz; optional rssi_dbm, link_quality"
        )
    engine = Engine(store, project)
    output = []
    try:
        for i, row in enumerate(rows):
            lon, lat, altitude, f = [float(row[k]) for k in ["lon", "lat", "altitude_m", "frequency_mhz"]]
            if (
                not all(math.isfinite(x) for x in [lon, lat, altitude, f])
                or not -180 <= lon <= 180
                or not -85 <= lat <= 85
            ):
                raise ValueError(f"Row {i + 2}: invalid coordinates/value")
            ref = row["altitude_reference"]
            if ref == "agl":
                altitude += engine.terrain.point(lon, lat)
            elif ref == "home":
                if engine.home_alt is None:
                    raise ValueError("Home altitude unresolved")
                altitude += engine.home_alt
            elif ref in {"EGM96", "NAVD88", "WGS84_ELLIPSOID"}:
                altitude = height_to_egm96(lon, lat, altitude, ref)
            else:
                raise ValueError(f"Row {i + 2}: specify agl, home or an explicit vertical datum")
            result = engine.evaluate(lon, lat, altitude)
            match = [r for r in project.radios if abs(r.frequency_mhz - f) < 0.01]
            if len(match) != 1:
                raise ValueError(f"Row {i + 2}: frequency must uniquely match a radio profile")
            link = result["links"].get(match[0].id, {})
            observed = float(row["rssi_dbm"]) if row.get("rssi_dbm") else None
            quality = float(row["link_quality"]) if row.get("link_quality") else None
            if any(v is not None and not math.isfinite(v) for v in [observed, quality]):
                raise ValueError(f"Row {i + 2}: non-finite observation")
            predicted = link.get("rx_dbm")
            output.append(
                {
                    "lat": lat,
                    "lon": lon,
                    "frequency_mhz": f,
                    "observed_rssi_dbm": observed,
                    "link_quality": quality,
                    "predicted_rssi_dbm": predicted,
                    "residual_db": observed - predicted
                    if observed is not None and predicted is not None
                    else None,
                    "reason": result.get("reason") or link.get("reason"),
                }
            )
        return {"observations": output, "calibration_applied": False}
    finally:
        engine.close()
