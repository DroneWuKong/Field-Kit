from __future__ import annotations

import math
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Location(Model):
    lat: float = Field(default=42.28, ge=-85, le=85)
    lon: float = Field(default=-87.96, ge=-180, le=180)


Datum = Literal["EGM96", "NAVD88", "WGS84_ELLIPSOID"]


class Home(Location):
    altitude_m: float | None = None
    datum: Datum | None = "EGM96"


class Station(Location):
    height_m: float = Field(default=3, gt=0, le=3000)


class Waypoint(Location):
    id: str = Field(default_factory=lambda: str(uuid4()))
    altitude_m: float = 60
    altitude_mode: Literal["agl", "home", "amsl"] = "home"
    command: int = 16
    params: list[float | None] = Field(default_factory=lambda: [0, 0, 0, None])
    source_index: int | None = None

    @model_validator(mode="after")
    def params_valid(self):
        if len(self.params) != 4:
            raise ValueError("A waypoint must retain four non-position command parameters")
        return self


class RadioProfile(Model):
    id: str
    name: str
    frequency_mhz: float = Field(ge=30, le=20000)
    direction: Literal["uplink", "downlink"]
    role: Literal["control", "video", "telemetry"]
    tx_dbm: float | None = Field(default=None, ge=-30, le=70)
    sensitivity_dbm: float | None = Field(default=None, ge=-180, le=0)
    tx_gain_dbi: float = Field(default=0, ge=-30, le=60)
    rx_gain_dbi: float = Field(default=0, ge=-30, le=60)
    cable_loss_db: float = Field(default=0, ge=0, le=100)
    additional_loss_db: float = Field(default=0, ge=0, le=100)
    polarization: Literal["horizontal", "vertical"] = "vertical"
    provenance: Literal["assumed", "manufacturer", "measured"] = "assumed"
    notes: str = "Proposed frequency; power and receiver threshold must be supplied. Gains are assumed."


def radios():
    return [
        RadioProfile(
            id="control490", name="IRONghost · 490 MHz", frequency_mhz=490, direction="uplink", role="control"
        ),
        RadioProfile(
            id="control915", name="IRONghost · 915 MHz", frequency_mhz=915, direction="uplink", role="control"
        ),
        RadioProfile(
            id="video5800", name="Video · 5.8 GHz", frequency_mhz=5800, direction="downlink", role="video"
        ),
    ]


class Settings(Model):
    k_factor: float = Field(default=4 / 3, ge=0.5, le=3)
    fresnel_fraction: float = Field(default=0.6, ge=0, le=1)
    margin_db: float = Field(default=10, ge=0, le=60)
    route_step_m: float = Field(default=25, ge=1, le=100)
    profile_step_m: float = Field(default=10, ge=0.5, le=30)
    epsilon: float = Field(default=15, gt=1, le=100)
    conductivity: float = Field(default=0.005, gt=0, le=10)
    selected_control: str = "control915"
    require_video: bool = True
    required_telemetry: list[str] = Field(default_factory=list)
    min_agl_m: float = Field(default=10, ge=0.5, le=3000)
    max_agl_m: float | None = Field(default=None, ge=0.5, le=3000)

    @model_validator(mode="after")
    def bounds(self):
        if self.max_agl_m is not None and self.max_agl_m < self.min_agl_m:
            raise ValueError("Maximum altitude must be at least the minimum altitude")
        return self


class MissionSource(Model):
    format: Literal["plan", "wpl"]
    filename: str
    text: str
    document: dict[str, Any] | None = None
    warnings: list[str] = Field(default_factory=list)
    readonly: bool = False


class Project(Model):
    version: Literal[1] = 1
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(default="Untitled mission", min_length=1, max_length=200)
    home: Home = Field(default_factory=Home)
    station: Station = Field(default_factory=Station)
    operator: Location | None = None
    waypoints: list[Waypoint] = Field(default_factory=list, max_length=5000)
    speed_mps: float = Field(default=8, gt=0, le=100)
    radios: list[RadioProfile] = Field(default_factory=radios)
    settings: Settings = Field(default_factory=Settings)
    terrain_ids: list[str] = Field(default_factory=list)
    source: MissionSource | None = None
    altitude_datum: Datum | None = "EGM96"

    @model_validator(mode="after")
    def unique_radios(self):
        ids = [r.id for r in self.radios]
        if len(set(ids)) != len(ids):
            raise ValueError("Radio identifiers must be unique")
        selected = next((r for r in self.radios if r.id == self.settings.selected_control), None)
        if selected is None or selected.role != "control":
            raise ValueError("Select a configured control radio")
        for tid in self.settings.required_telemetry:
            if not any(r.id == tid and r.role == "telemetry" for r in self.radios):
                raise ValueError("Required telemetry must reference a telemetry radio")
        return self


class CoverageRequest(Model):
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-85, le=85)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-85, le=85)
    agl_m: float = Field(default=60, gt=0, le=3000)
    cell_m: float = Field(default=100, ge=10, le=1000)

    @model_validator(mode="after")
    def bounds(self):
        if self.west >= self.east or self.south >= self.north:
            raise ValueError("Area must have west < east and south < north; split dateline-crossing areas")
        width = (self.east - self.west) * 111320 * math.cos(math.radians((self.south + self.north) / 2))
        height = (self.north - self.south) * 111320
        if width * height / self.cell_m**2 > 60000:
            raise ValueError("Limit coverage to 60,000 cells; choose a smaller area or larger cells")
        return self


class AnalysisRequest(Model):
    project: Project
    kind: Literal["route", "coverage", "altitude"] = "route"
    coverage: CoverageRequest | None = None

    @model_validator(mode="after")
    def complete(self):
        if self.kind == "coverage" and self.coverage is None:
            raise ValueError("Coverage requires area and altitude")
        if self.kind == "altitude" and self.project.settings.max_agl_m is None:
            raise ValueError("Enter a maximum AGL altitude before searching")
        return self
