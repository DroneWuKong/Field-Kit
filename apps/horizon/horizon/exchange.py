"""File exchange for Field Kit. No hardware capabilities or measurements are inferred."""
from typing import Literal
from uuid import uuid4

from pydantic import ConfigDict, Field

from .models import Equipment, Model, Project


class EquipmentApply(Model):
    project: Project
    equipment: Equipment


class PlanExchange(Model):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, populate_by_name=True, serialize_by_alias=True)
    schema_id: Literal["prismo.plan.v1"] = Field(alias="schema")
    evidence: Literal["predicted"]
    project: Project


def apply_equipment(project: Project, equipment: Equipment) -> Project:
    # Replace links belonging to the prior equipment, keep unrelated comparison bands.
    p = project.model_copy(deep=True)
    previous = {r.id for r in p.equipment.radios} if p.equipment else set()
    incoming = {r.id for r in equipment.radios}
    p.radios = [r for r in p.radios if r.id not in previous | incoming] + equipment.radios
    controls = [r.id for r in equipment.radios if r.role == "control"]
    if controls:
        p.settings.selected_control = controls[0]
    elif not any(r.id == p.settings.selected_control and r.role == "control" for r in p.radios):
        controls = [r.id for r in p.radios if r.role == "control"]
        if not controls:
            raise ValueError("Equipment replacement would remove the only control link")
        p.settings.selected_control = controls[0]
    p.settings.required_telemetry = [i for i in p.settings.required_telemetry
                                     if any(r.id == i and r.role == "telemetry" for r in p.radios)]
    p.settings.margin_db = equipment.margin_db
    p.equipment = equipment
    return Project.model_validate(p.model_dump())


def export_equipment(project: Project) -> Equipment:
    if project.equipment:
        data = project.equipment.model_dump()
        if data["radios"] != [r.model_dump() for r in project.radios] or data["margin_db"] != project.settings.margin_db:
            data["revision"] += 1
        data.update(radios=[r.model_dump() for r in project.radios], margin_db=project.settings.margin_db)
        return Equipment.model_validate(data)
    return Equipment(schema="prismo.equipment.v1", id=project.id, revision=1, name=project.name,
                     origin="horizon", radios=project.radios, margin_db=project.settings.margin_db)


def import_plan(plan: PlanExchange) -> Project:
    p = plan.project.model_copy(deep=True)
    p.id = str(uuid4())  # Import as a copy; never overwrite an existing local project.
    return p
