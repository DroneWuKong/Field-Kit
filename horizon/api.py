import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import Field

from . import __version__
from .catalog import search
from .engine import Engine
from .jobs import Jobs
from .maps import tile
from .missions import export_mission, import_mission
from .models import AnalysisRequest, CoverageRequest, Datum, Model, Project
from .observations import compare
from .storage import Store, fingerprint, now
from .terrain import Terrain, grid_requirements, register


class ExportRequest(Model):
    project: Project
    format: Literal["plan", "wpl"]


class CatalogRequest(Model):
    area: CoverageRequest
    resolution: Literal["10m", "1m"] = "10m"


class DownloadRequest(Model):
    products: list[dict] = Field(min_length=1, max_length=100)
    datum: Datum = "NAVD88"


class IdsRequest(Model):
    ids: list[str]


class ProfileRequest(Model):
    project: Project
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-85, le=85)
    altitude_m: float | None = None


def create_app(root=None, frontend=None):
    store = Store(root)

    @asynccontextmanager
    async def lifespan(app):
        app.state.jobs = Jobs(store)
        yield
        app.state.jobs.close()

    app = FastAPI(title="Radio Horizon Planner", version=__version__, lifespan=lifespan)
    app.state.store = store

    @app.middleware("http")
    async def local_origin(request: Request, call_next):
        # Prevent unrelated browser origins from issuing writes to the local service.
        origin = request.headers.get("origin")
        if origin and origin not in {
            f"http://{request.headers.get('host')}",
            f"https://{request.headers.get('host')}",
        }:
            return JSONResponse({"detail": "Use the local planner origin"}, status_code=403)
        return await call_next(request)

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return JSONResponse({"detail": str(exc)}, status_code=400)

    @app.exception_handler(KeyError)
    async def missing(request, exc):
        return JSONResponse({"detail": "Record not found"}, status_code=404)

    @app.get("/api/v1/health")
    def health():
        return {"version": __version__, "mode": "local", "data_directory": str(store.root)}

    @app.get("/api/v1/projects", response_model=list[Project])
    def projects():
        return store.list("project")

    @app.post("/api/v1/projects", response_model=Project)
    def new_project():
        project = Project()
        store.put("project", project.id, project.model_dump())
        return project

    @app.post("/api/v1/examples/demo", response_model=Project)
    def demo():
        from .examples import create_demo

        return create_demo(store)

    @app.get("/api/v1/projects/{ident}", response_model=Project)
    def project(ident: str):
        return store.get("project", ident)

    @app.put("/api/v1/projects/{ident}", response_model=Project)
    def save_project(ident: str, project: Project):
        if project.id != ident:
            raise ValueError("Project identifier mismatch")
        store.put("project", ident, project.model_dump())
        return project

    @app.post("/api/v1/missions/import", response_model=Project)
    async def mission_import(file: UploadFile = File()):
        data = await file.read(10_000_001)
        if len(data) > 10_000_000:
            raise ValueError("Mission file exceeds 10 MB")
        project = import_mission(data.decode("utf-8-sig"), file.filename or "mission")
        store.put("project", project.id, project.model_dump())
        return project

    @app.post("/api/v1/missions/export")
    def mission_export(body: ExportRequest):
        text = export_mission(body.project, body.format)
        return Response(
            text,
            media_type="application/json" if body.format == "plan" else "text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="mission.{"plan" if body.format == "plan" else "waypoints"}"'
            },
        )

    @app.get("/api/v1/terrain")
    def terrain_list():
        return store.list("terrain")

    @app.post("/api/v1/terrain/import")
    def terrain_import(file: UploadFile = File(), datum: Datum = Form()):
        with tempfile.NamedTemporaryFile(suffix=".tif", dir=store.root / "downloads") as tmp:
            size = 0
            while data := file.file.read(1024 * 1024):
                size += len(data)
                if size > 8 * 1024**3:
                    raise ValueError("Raster exceeds 8 GiB")
                tmp.write(data)
            tmp.flush()
            meta = register(store, tmp.name, datum)
            meta["name"] = Path(file.filename or "Imported terrain").name
            store.put("terrain", meta["id"], meta)
            return meta

    @app.post("/api/v1/terrain/catalog")
    def terrain_catalog(body: CatalogRequest):
        b = body.area
        try:
            return search([b.west, b.south, b.east, b.north], body.resolution)
        except Exception as exc:
            raise HTTPException(502, "USGS catalog unavailable: " + str(exc)) from exc

    @app.post("/api/v1/terrain/download")
    def terrain_download(body: DownloadRequest, request: Request):
        return request.app.state.jobs.start("download", body.model_dump())

    @app.post("/api/v1/terrain/grids/check")
    def grid_check(body: IdsRequest):
        return grid_requirements(store, body.ids)

    @app.post("/api/v1/terrain/grids")
    def grids(body: IdsRequest, request: Request):
        return request.app.state.jobs.start("grids", body.model_dump())

    @app.post("/api/v1/terrain/point")
    def terrain_point(body: ProfileRequest):
        t = Terrain(store, body.project.terrain_ids)
        try:
            return {"altitude_m": t.point(body.lon, body.lat), "datum": "EGM96"}
        finally:
            t.close()

    @app.get("/api/v1/terrain/tiles/{z}/{x}/{y}.png")
    def terrain_tile(z: int, x: int, y: int, ids: str = Query(default="")):
        revision = sum(p.stat().st_mtime_ns for p in (store.root / "grids").glob("*.tif"))
        return Response(
            tile(str(store.root), tuple(sorted(filter(None, ids.split(",")))), z, x, y, revision),
            media_type="image/png",
            headers={"Cache-Control": "no-cache"},
        )

    @app.post("/api/v1/analyses")
    def start_analysis(body: AnalysisRequest, request: Request):
        # Every job owns a validated immutable snapshot. Saved project edits do
        # not mutate it; GET job reports whether the saved project has changed.
        return request.app.state.jobs.start("analysis", body.model_dump())

    @app.post("/api/v1/profile")
    def profile(body: ProfileRequest):
        engine = Engine(store, body.project)
        try:
            return engine.evaluate(body.lon, body.lat, body.altitude_m, detail=True)
        finally:
            engine.close()

    @app.get("/api/v1/jobs")
    def jobs():
        return store.list("job")

    @app.get("/api/v1/jobs/{ident}")
    def get_job(ident: str):
        job = store.get("job", ident)
        if job.get("project_id"):
            try:
                job["stale"] = fingerprint(store.get("project", job["project_id"])) != job["project_hash"]
            except KeyError:
                job["stale"] = True
        return job

    @app.delete("/api/v1/jobs/{ident}")
    def cancel_job(ident: str, request: Request):
        return request.app.state.jobs.cancel(ident)

    @app.get("/api/v1/jobs/{ident}/result")
    def result(ident: str):
        job = store.get("job", ident)
        if job["status"] != "complete":
            raise HTTPException(409, "Job has not completed")
        return FileResponse(store.root / "results" / f"{job['id']}.json", media_type="application/json")

    @app.post("/api/v1/observations")
    def observations(project: str = Form(), file: UploadFile = File()):
        p = Project.model_validate_json(project)
        text = file.file.read(10_000_001)
        if len(text) > 10_000_000:
            raise ValueError("Observation CSV exceeds 10 MB")
        result = compare(store, p, text.decode("utf-8-sig"))
        ident = str(uuid4())
        result.update(id=ident, project_hash=fingerprint(p.model_dump()), created_at=now())
        store.put("observations", ident, result)
        return result

    @app.get("/api/v1/basemaps")
    def basemaps():
        return store.list("basemap")

    @app.post("/api/v1/basemaps")
    def import_basemap(file: UploadFile = File(), attribution: str = Form(default="User-supplied basemap")):
        from .terrain import file_hash

        with tempfile.NamedTemporaryFile(dir=store.root / "downloads") as tmp:
            header = file.file.read(127)
            if len(header) != 127 or header[:8] != b"PMTiles\x03" or header[99] not in {2, 3, 4}:
                raise ValueError("Expected a raster PNG/JPEG/WebP PMTiles v3 archive")
            tmp.write(header)
            size = len(header)
            while block := file.file.read(1024 * 1024):
                size += len(block)
                if size > 8 * 1024**3:
                    raise ValueError("Basemap exceeds 8 GiB")
                tmp.write(block)
            tmp.flush()
            ident = file_hash(tmp.name)
            import shutil

            shutil.copyfile(tmp.name, store.root / "basemaps" / f"{ident}.pmtiles")
        meta = {"id": ident, "name": Path(file.filename or "Basemap").name, "attribution": attribution}
        store.put("basemap", ident, meta)
        return meta

    @app.get("/api/v1/basemaps/{ident}.pmtiles")
    def basemap_file(ident: str):
        meta = store.get("basemap", ident)
        return FileResponse(
            store.root / "basemaps" / f"{meta['id']}.pmtiles", media_type="application/octet-stream"
        )

    @app.get("/api/v1/schema")
    def schema():
        return Project.model_json_schema()

    assets = Path(frontend or os.environ.get("HORIZON_FRONTEND", "frontend/dist"))
    if assets.is_dir():
        app.mount("/", StaticFiles(directory=assets, html=True), name="frontend")
    return app
