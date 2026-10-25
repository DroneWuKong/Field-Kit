# Horizon — offline radio mission planner

**Version scope:** this checkout and the published Windows ZIP are 0.2.0.
The later 0.3.0 startup/offline-area/setup work was not published and requires
source recovery before a new native build. See the parent
[release/source status](../../docs/RELEASE_STATUS.md). The delivered
[Android 0.5.0 planner](../../docs/ANDROID.md) exchanges route/equipment files with
Horizon; it does not include this Python terrain engine.

A local browser app for drawing aerial waypoint missions and predicting terrain clearance and radio-link margins at 490, 915 and 5800 MHz. Linux x86-64 and a portable Windows x64 executable are packaged. See the parent repository’s `docs/WINDOWS.md` for Windows startup and qualification. The analysis engine and versioned HTTP API are independent of the UI and serve the Prismo Field Kit planning workspace.

## Start the packaged app

Install Docker Engine on the Linux host before going offline. Extract the release archive and run:

```sh
./start.sh
```

Open **http://127.0.0.1:8765**. `./stop.sh` stops the app without deleting data. Data lives in `~/.local/share/radio-horizon-planner`; back up that whole directory while the app is stopped. `HORIZON_PORT`, `HORIZON_DATA`, and `HORIZON_CONTAINER` customize the first launch. Existing containers retain their original settings.

The package includes the application, map renderer, fonts supplied by the operating system, and three starter PROJ datum grids. No CDN, API key or internet connection is required for analysis. Download terrain and any additional regional datum grids before field use. The app does not ship worldwide elevation data.

## First mission

1. Click **Example mission** to explore the explicitly synthetic ridge and hypothetical radios. This is a demonstration, not a location survey or verified Orqa preset.
2. For real work, create a project and open **Terrain**. Capture the map area or enter bounds; search USGS current 1/3 arc-second or available 1 m products. Download the products, select their vertical datum from source metadata, and prepare datum grids. Alternatively import single-band elevation GeoTIFFs with metre values. NAVD88 is common for CONUS 3DEP; do not assume it for every region.
3. Set launch/home, home elevation and datum, ground radio position, and antenna height above ground. The operator marker is independent of the radio site. Draw waypoints or import `.plan` / `QGC WPL 110` files. Imported mission altitude datum must be recorded explicitly.
4. In **Radios**, enter measured/documented transmit power, antenna gains, cable losses and receiver or usable-video threshold. The 490/915/5800 MHz profiles are editable starting points with unknown power and threshold. Select required control, video and optional telemetry links.
5. Analyze the route, inspect individual terrain/Fresnel profiles, compare a changed antenna height or route, or calculate area coverage. Set a maximum AGL to enable bounded altitude suggestions.
6. Review export details and download a QGroundControl `.plan` or Mission Planner `.waypoints` file. Reopen it in the intended ground station and review altitude semantics before using it. Complex or unsupported missions remain read-only and can be exported unchanged.

Green means the modeled required links meet the configured margin and Fresnel clearance. Amber indicates insufficient reserve/clearance, red a modeled failure, and gray an unknown result. These predictions do not certify operational range. Bare-earth DEMs omit buildings and vegetation; interference, antenna orientation, multipath and vehicle dynamics are not modeled.

## Field Kit exchange

This app now lives in the Field Kit repository at `apps/horizon`. Use the parent
repository for new commits. The prior standalone repository remains untouched.
The header opens Field Kit on the same local service. **Radios → Import equipment**
previews a shared equipment file; applying it is undoable and invalidates old
predictions. Unknown power/sensitivity stay unknown. Original Field Kit mW values,
serial, battery details and revision remain in the source snapshot.

**Export plan to Field Kit** writes `prismo.plan.v1`: an editable project snapshot
labeled predicted. Field Kit keeps it in Records. Terrain/basemap files and analysis
results are not embedded. Import that file through **Open project JSON** to create
a new local copy; no existing project is overwritten.

## Development

Python 3.12+, Node 22+, and `uv` are required.

```sh
uv sync --frozen
npm --prefix frontend ci
npm --prefix frontend run build
uv run horizon --data data serve
```

```sh
uv run pytest -q
uv run ruff check horizon tests
# Start a separate test service in another terminal:
uv run horizon --data /tmp/horizon-browser-data serve --port 8766
# Then:
cd frontend
npx playwright install chromium
npx playwright test
```

`./scripts/package.sh` builds from the parent Field Kit repository context and the Docker image and creates a checksummed Linux archive under `release/`. Building requires internet; starting the resulting archive does not. UI types derive from FastAPI OpenAPI (`npm run types`, service on port 8765).

API documentation is at `/docs`, OpenAPI at `/openapi.json`. CLI examples:

```sh
uv run horizon --data data demo --output demo.horizon.json
uv run horizon --data data analyze demo.horizon.json --output analysis.json
```

See [model and research](docs/MODEL.md), [interchange and API](docs/INTEGRATION.md), [validation](docs/VALIDATION.md), and [implementation status](docs/IMPLEMENTATION.md).
