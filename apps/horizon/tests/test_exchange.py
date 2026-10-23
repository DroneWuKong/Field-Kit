import json
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from horizon.api import create_app
from horizon.exchange import PlanExchange, apply_equipment, export_equipment
from horizon.models import Equipment, Project

ROOT = Path(__file__).resolve().parents[3]
FIXTURES = json.loads((ROOT / 'packages/contracts/fixtures.json').read_text())


def from_fieldkit():
    text = subprocess.check_output(['node', '-e', '''
const E=require('./source/assets/tools/prismo-contracts.js');
const f=require('./packages/contracts/fixtures.json');
console.log(JSON.stringify(E.fromLegacy(f.legacy,'control','uplink')));
'''], cwd=ROOT, text=True)
    return Equipment.model_validate_json(text)


def test_actual_javascript_export_import_and_roundtrip():
    equipment = from_fieldkit()
    p = apply_equipment(Project(), equipment)
    assert p.settings.selected_control == 'fieldkit-unit-42-control'
    assert p.radios[-1].tx_dbm == 20
    assert p.radios[-1].provenance == 'assumed'
    assert len(p.radios) == 4  # Preserve comparison bands.
    assert p.equipment.source_profile == FIXTURES['legacy']
    assert p.equipment.revision == 7
    assert Project.model_validate_json(p.model_dump_json()).equipment.id == 'unit-42'
    exported = export_equipment(p)
    assert exported.source_profile['power'] == 100
    assert exported.source_profile['batteryMah'] == 5000
    assert exported.revision == 8  # Includes the retained comparison radios.
    again = apply_equipment(p, exported)
    assert len(again.radios) == 4
    assert export_equipment(again).revision == 8


def test_unknowns_and_rejected_duplicate_roles():
    equipment = from_fieldkit()
    equipment.radios[0].tx_dbm = equipment.radios[0].sensitivity_dbm = None
    assert apply_equipment(Project(), equipment).radios[-1].tx_dbm is None
    value = equipment.model_dump()
    value['radios'] *= 2
    with pytest.raises(ValidationError, match='unique'):
        Equipment.model_validate(value)
    value['radios'] = value['radios'][:1]
    value['radios'][0]['role'] = 'unspecified'
    with pytest.raises(ValidationError):
        Equipment.model_validate(value)


def test_replacement_cannot_leave_invalid_control():
    equipment = from_fieldkit()
    p = apply_equipment(Project(), equipment)
    replacement = equipment.model_copy(deep=True)
    replacement.radios[0].role = 'video'
    replacement.radios[0].direction = 'downlink'
    updated = apply_equipment(p, replacement)
    assert updated.settings.selected_control == 'control490'
    p.radios = [p.radios[-1]]
    with pytest.raises(ValueError, match='only control'):
        apply_equipment(p, replacement)


def test_api_preview_is_read_only_and_plan_import_is_copy(store):
    p = Project()
    with TestClient(create_app(store.root)) as client:
        client.put('/api/v1/projects/' + p.id, json=p.model_dump()).raise_for_status()
        r = client.post('/api/v1/exchange/equipment/apply', json={'project':p.model_dump(),'equipment':from_fieldkit().model_dump()})
        r.raise_for_status()
        assert client.get('/api/v1/projects/' + p.id).json()['equipment'] is None
        envelope = client.post('/api/v1/exchange/plan/export', json=r.json()).json()
        assert envelope['evidence'] == 'predicted'
        restored = client.post('/api/v1/exchange/plan/import', json=envelope)
        restored.raise_for_status()
        assert restored.json()['id'] != p.id
        assert restored.json()['equipment']['revision'] == 7
        assert len(store.list('project')) == 2
        envelope['evidence'] = 'measured'
        assert client.post('/api/v1/exchange/plan/import', json=envelope).status_code == 422
        assert len(store.list('project')) == 2
        assert client.get('/field-kit/tools/tools_offline.html?mode=standalone').status_code == 200


def test_shared_schema_and_plan_fixture():
    schemas = json.loads((ROOT / 'packages/contracts/schemas.json').read_text())
    assert schemas['equipment'] == Equipment.model_json_schema()
    assert schemas['plan'] == PlanExchange.model_json_schema()
    PlanExchange.model_validate(FIXTURES['plan'])
