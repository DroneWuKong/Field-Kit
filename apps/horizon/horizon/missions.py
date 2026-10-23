"""Loss-aware mission interchange. Never turn an opaque command into a waypoint."""

import copy
import json
import math
from pathlib import Path

from .models import Home, MissionSource, Project, Waypoint

NAV = {16, 21, 22}
PASS = {178, 206}
FRAMES = {0: "amsl", 3: "home", 10: "agl"}
FRAME_FOR = {v: k for k, v in FRAMES.items()}
QGC_MODE = {"home": 1, "amsl": 2, "agl": 4}


def _number(x):
    if x is None:
        return None
    n = float(x)
    if not math.isfinite(n):
        raise ValueError("Mission contains a non-finite number")
    return n


def _parameter(x):
    # MAVLink represents an unspecified command parameter with NaN. It is
    # legal for params 1–4, never for a position that we actually analyze.
    return None if x is None or isinstance(x, str) and x.lower() == "nan" else _number(x)


def _wp(item, index, warnings):
    if item.get("type", "SimpleItem") != "SimpleItem":
        warnings.append(f"Item {index}: complex mission item retained, route not expanded")
        return None
    command = int(item["command"])
    p = item["params"]
    if not isinstance(p, list) or len(p) != 7:
        raise ValueError(f"Item {index}: expected seven parameters")
    p = [_number(x) for x in p]
    if command in PASS:
        return None
    if command not in NAV or item["frame"] not in FRAMES:
        warnings.append(f"Item {index}: command {command} / frame {item['frame']} is not modeled")
        return None
    if item.get("AltitudeMode") == 3:
        warnings.append(f"Item {index}: QGC calculated-terrain altitude must be edited in QGC")
    if p[4] is None or p[5] is None or p[6] is None:
        warnings.append(f"Item {index}: unresolved position or altitude")
        return None
    if command in {21, 22} and p[4] == 0 and p[5] == 0:
        warnings.append(f"Item {index}: takeoff/land uses a runtime position")
        return None
    return Waypoint(
        lat=p[4],
        lon=p[5],
        altitude_m=p[6],
        altitude_mode=FRAMES[item["frame"]],
        command=command,
        params=p[:4],
        source_index=index,
        id=f"import-{index}",
    )


def import_mission(text: str, filename: str) -> Project:
    if len(text.encode()) > 10_000_000:
        raise ValueError("Mission file exceeds 10 MB")
    text = text.lstrip("\ufeff")
    warnings = []
    project = Project(name=Path(filename).stem[:200] or "Imported mission", altitude_datum=None)
    if text.lstrip().startswith("{"):
        doc = json.loads(text, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite JSON")))
        if doc.get("fileType") != "Plan" or doc.get("version") != 1:
            raise ValueError("Expected QGroundControl Plan version 1")
        mission = doc["mission"]
        if mission.get("version") != 2:
            raise ValueError("Expected QGroundControl mission version 2")
        items = mission["items"]
        home = mission.get("plannedHomePosition")
        if home and len(home) == 3:
            project.home = Home(lat=home[0], lon=home[1], altitude_m=_number(home[2]), datum=None)
        project.speed_mps = mission.get("hoverSpeed", 8)
        fmt = "plan"
    else:
        lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
        if not lines or lines[0] != "QGC WPL 110":
            raise ValueError("Expected a .plan JSON file or QGC WPL 110 waypoint file")
        items = []
        for line in lines[1:]:
            p = line.split()
            if len(p) != 12:
                raise ValueError("WPL rows must contain twelve fields")
            seq, current, frame, command = map(int, p[:4])
            if seq != len(items):
                raise ValueError("WPL indices must be consecutive starting at zero")
            params = [_parameter(x) for x in p[4:8]] + [_number(x) for x in p[8:11]]
            items.append(
                dict(
                    type="SimpleItem",
                    command=command,
                    frame=frame,
                    params=params,
                    current=current,
                    autoContinue=int(p[11]),
                    doJumpId=seq,
                )
            )
        doc = {"items": items}
        if items and items[0]["frame"] == 0 and items[0]["command"] == 16 and items[0]["current"] == 1:
            p = items[0]["params"]
            project.home = Home(lat=p[4], lon=p[5], altitude_m=p[6], datum=None)
            doc["home_index"] = 0
        fmt = "wpl"
    if not isinstance(items, list) or len(items) > 10000:
        raise ValueError("Invalid or oversized mission item list")
    for i, item in enumerate(items):
        if fmt == "wpl" and i == doc.get("home_index"):
            continue
        wp = _wp(item, i, warnings)
        if wp:
            project.waypoints.append(wp)
    if not project.waypoints and not warnings:
        raise ValueError("Mission contains no supported navigation items")
    if project.home.altitude_m is None and project.waypoints:
        project.home = Home(lat=project.waypoints[0].lat, lon=project.waypoints[0].lon, datum=None)
    project.station.lat, project.station.lon = project.home.lat, project.home.lon
    project.source = MissionSource(
        format=fmt,
        filename=Path(filename).name,
        text=text,
        document=doc,
        warnings=warnings,
        readonly=bool(warnings),
    )
    return Project.model_validate(project.model_dump())


def source_items(project):
    if not project.source or not project.source.document:
        return []
    d = project.source.document
    return d["mission"]["items"] if project.source.format == "plan" else d["items"]


def segment_known(project, first, second):
    if not project.source or not project.source.readonly:
        return True
    if first.source_index is None or second.source_index is None:
        return False
    items = source_items(project)
    between = items[first.source_index + 1 : second.source_index]
    return all(x.get("type", "SimpleItem") == "SimpleItem" and x.get("command") in PASS for x in between)


def _mission_signature(p):
    return {
        "home": {k: v for k, v in p.home.model_dump().items() if k != "datum"},
        "waypoints": [w.model_dump(exclude={"id"}) for w in p.waypoints],
        "speed": p.speed_mps,
    }


def _item(w, original=None):
    item = copy.deepcopy(original) if original else {}
    item.update(
        type="SimpleItem",
        command=w.command,
        frame=FRAME_FOR[w.altitude_mode],
        params=w.params + [w.lat, w.lon, w.altitude_m],
    )
    item.setdefault("autoContinue", True)
    item.update(Altitude=w.altitude_m, AltitudeMode=QGC_MODE[w.altitude_mode], AMSLAltAboveTerrain=None)
    return item


def _edited_items(p):
    originals = source_items(p)
    # Keep non-routing commands anchored before their following navigation item.
    # Deleting that navigation item moves its prefix to the next remaining item.
    prefixes, pending = {}, []
    for i, it in enumerate(originals):
        if p.source.format == "wpl" and i == p.source.document.get("home_index"):
            continue
        if it.get("command") in NAV:
            prefixes[i], pending = pending, []
        else:
            pending.append(copy.deepcopy(it))
    output = []
    emitted = set()
    for w in p.waypoints:
        if w.source_index is not None:
            for idx in sorted(prefixes):
                if idx <= w.source_index and idx not in emitted:
                    output.extend(prefixes[idx])
                    emitted.add(idx)
        old = (
            originals[w.source_index]
            if w.source_index is not None and w.source_index < len(originals)
            else None
        )
        output.append(_item(w, old))
    for idx in sorted(prefixes):
        if idx not in emitted:
            output.extend(prefixes[idx])
    output.extend(pending)
    for i, item in enumerate(output, 1):
        item["doJumpId"] = i
    return output


def export_mission(p: Project, fmt: str) -> str:
    if fmt not in {"plan", "wpl"}:
        raise ValueError("Unsupported export format")
    if p.source and p.source.readonly:
        original = import_mission(p.source.text, p.source.filename)
        if fmt != p.source.format or _mission_signature(p) != _mission_signature(original):
            raise ValueError("Unsupported mission commands: only the unchanged original can be exported")
        return p.source.text
    if p.source and fmt == p.source.format:
        original = import_mission(p.source.text, p.source.filename)
        if _mission_signature(p) == _mission_signature(original):
            return p.source.text
    if p.home.altitude_m is None:
        raise ValueError("Set planned home altitude before exporting (use the terrain lookup)")
    if p.home.datum is None or p.altitude_datum is None:
        raise ValueError("Record the home and mission vertical datum before exporting edits")
    if p.home.datum != "EGM96" or p.altitude_datum != "EGM96":
        raise ValueError("Normalize edited export heights to EGM96 first; original files remain available")
    if not p.waypoints:
        raise ValueError("Add at least one waypoint")
    items = _edited_items(p) if p.source else [_item(w) for w in p.waypoints]
    if fmt == "plan":
        doc = (
            copy.deepcopy(p.source.document)
            if p.source and p.source.format == "plan"
            else {
                "fileType": "Plan",
                "version": 1,
                "groundStation": "QGroundControl",
                "geoFence": {"circles": [], "polygons": [], "version": 2},
                "rallyPoints": {"points": [], "version": 2},
                "mission": {"version": 2, "firmwareType": 3, "vehicleType": 2, "cruiseSpeed": 15},
            }
        )
        for i, item in enumerate(items, 1):
            item["doJumpId"] = i
            item.pop("current", None)
            item["autoContinue"] = bool(item.get("autoContinue", True))
        doc["mission"].update(
            items=items,
            hoverSpeed=p.speed_mps,
            globalPlanAltitudeMode=0,
            plannedHomePosition=[p.home.lat, p.home.lon, p.home.altitude_m],
        )
        return json.dumps(doc, indent=2, allow_nan=False) + "\n"
    if p.source and p.source.format == "plan":
        doc = p.source.document
        fence = doc.get("geoFence", {})
        if any(fence.get(k) for k in ["polygons", "circles", "polygon"]) or doc.get("rallyPoints", {}).get(
            "points"
        ):
            raise ValueError("WPL cannot retain fences/rally points; export .plan instead")
    rows = ["QGC WPL 110"]
    home = dict(
        frame=0, command=16, params=[0, 0, 0, 0, p.home.lat, p.home.lon, p.home.altitude_m], autoContinue=1
    )
    for i, it in enumerate([home] + items):
        values = [i, int(i == 0), it["frame"], it["command"], *it["params"], int(it.get("autoContinue", 1))]
        rows.append("\t".join("nan" if v is None else format(v, ".15g") for v in values))
    return "\n".join(rows) + "\n"
