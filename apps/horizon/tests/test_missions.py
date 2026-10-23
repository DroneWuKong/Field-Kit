import json

import pytest

from horizon.missions import export_mission, import_mission, segment_known
from horizon.models import Project, Waypoint


def plan():
    return {
        "fileType": "Plan",
        "version": 1,
        "groundStation": "QGroundControl",
        "custom": "retain-me",
        "geoFence": {"version": 2, "circles": [], "polygons": []},
        "rallyPoints": {"version": 2, "points": []},
        "mission": {
            "version": 2,
            "firmwareType": 3,
            "vehicleType": 2,
            "hoverSpeed": 8,
            "plannedHomePosition": [42.25, -88.02, 200],
            "items": [
                {
                    "type": "SimpleItem",
                    "command": 16,
                    "frame": 3,
                    "params": [0, 2, 0, None, 42.26, -88.0, 80],
                    "autoContinue": True,
                    "doJumpId": 1,
                    "extra": "keep",
                },
                {
                    "type": "SimpleItem",
                    "command": 178,
                    "frame": 2,
                    "params": [1, 9, -1, 0, 0, 0, 0],
                    "autoContinue": True,
                    "doJumpId": 2,
                },
                {
                    "type": "SimpleItem",
                    "command": 16,
                    "frame": 10,
                    "params": [0, 0, 0, 0, 42.27, -87.98, 70],
                    "autoContinue": True,
                    "doJumpId": 3,
                },
            ],
        },
    }


def test_plan_exact_roundtrip_and_edited_metadata():
    original = json.dumps(plan(), indent=4)
    p = import_mission(original, "flight.plan")
    assert p.altitude_datum is None and p.home.datum is None
    assert export_mission(p, "plan") == original
    p.altitude_datum = p.home.datum = "EGM96"
    p.waypoints[0].altitude_m = 123
    out = json.loads(export_mission(p, "plan"))
    assert out["custom"] == "retain-me"
    items = out["mission"]["items"]
    assert items[0]["extra"] == "keep" and items[0]["params"][3] is None
    assert items[0]["params"][6] == 123 and items[0]["Altitude"] == 123
    assert items[0]["AltitudeMode"] == 1 and items[0]["frame"] == 3
    assert items[1]["command"] == 178 and items[1]["params"][1] == 9
    assert items[2]["AltitudeMode"] == 4


def test_wpl_nan_unspecified_parameter_and_roundtrip():
    original = "QGC WPL 110\n0\t1\t0\t16\t0\t0\t0\t0\t42.25\t-88.02\t200\t1\n1\t0\t3\t16\t0\t0\t0\tnan\t42.26\t-88\t80\t1\n"
    p = import_mission(original, "mission.waypoints")
    assert p.waypoints[0].params[3] is None
    assert len(p.waypoints) == 1
    assert export_mission(p, "wpl") == original
    p.altitude_datum = p.home.datum = "EGM96"
    p.waypoints[0].altitude_m = 81
    out = export_mission(p, "wpl")
    assert import_mission(out, "edited.waypoints").waypoints[0].altitude_m == 81


def test_complex_commands_read_only_no_fabricated_connection():
    d = plan()
    d["mission"]["items"][1] = {
        "type": "ComplexItem",
        "complexItemType": "survey",
        "polygon": [[42.26, -88], [42.27, -88]],
    }
    original = json.dumps(d)
    p = import_mission(original, "survey.plan")
    assert p.source.readonly
    assert not segment_known(p, *p.waypoints)
    assert export_mission(p, "plan") == original
    p.waypoints[0].altitude_m += 1
    with pytest.raises(ValueError, match="unchanged"):
        export_mission(p, "plan")


def test_wpl_blocks_fence_or_rally_loss():
    d = plan()
    d["rallyPoints"]["points"] = [[42.1, -88, 50]]
    p = import_mission(json.dumps(d), "fenced.plan")
    p.altitude_datum = p.home.datum = "EGM96"
    with pytest.raises(ValueError, match="cannot retain"):
        export_mission(p, "wpl")


def test_drawn_plan_default_altitude_mode_and_home_requirement():
    p = Project(waypoints=[Waypoint(lat=42.26, lon=-88.0)])
    with pytest.raises(ValueError, match="home altitude"):
        export_mission(p, "plan")
    p.home.altitude_m = 200
    out = import_mission(export_mission(p, "plan"), "drawn.plan")
    assert out.waypoints[0].altitude_mode == "home"
    assert out.waypoints[0].altitude_m == 60


@pytest.mark.parametrize(
    "text",
    [
        "QGC WPL 120",
        "QGC WPL 110\n1 0 0 16 0 0 0 0 42 -88 80 1",
        '{"fileType":"Plan","version":8}',
        '{"fileType":"Plan","version":NaN}',
    ],
)
def test_malformed_missions_rejected(text):
    with pytest.raises((ValueError, KeyError)):
        import_mission(text, "bad.plan")
