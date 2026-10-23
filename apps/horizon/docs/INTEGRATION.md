# Mission interchange and integration

## Supported formats

QGroundControl Plan v1 with Mission v2 and QGC WPL 110 are accepted. Navigation commands 16 (waypoint), 21 (land), 22 (takeoff), and passthrough commands 178 (speed) and 206 (camera trigger distance) are supported. Passthrough commands retain their source order and values; this app does not simulate their operational effects. Unknown commands, jumps and complex items make the import read-only, preserve the original data and break continuity where needed. Unchanged imported missions round-trip as their original text.

MAVLink frame 0 means absolute, 3 home-relative, 10 terrain-relative. These are distinct from QGC `AltitudeMode` values (Relative 1, Absolute 2, CalcAboveTerrain 3, TerrainFrame 4). CalcAboveTerrain imports retain the absolute altitude QGC calculated. Edited exports use explicit EGM96 mission/home altitudes; other unresolved or non-EGM96 datums block edited export. The QGC file format does not itself guarantee a geoid definition, so the chosen datum is an operator-recorded assumption. Frames cannot be inferred from a number called “altitude.”

Unknown metadata, fences and rally data are retained for same-format export. Conversion to WPL is blocked when it would discard fences or rally points. Unsupported source formats cannot be converted. Newly drawn missions use common waypoint fields; null yaw is preserved as QGC `null` / WPL `nan`. Export is a file download, not a flight-controller upload.

## Local API

Start the service and open `/docs` for the exact typed request schema. `/api/v1/schema` returns the project JSON schema, and `/openapi.json` defines the HTTP contract. Frontend schema types are generated from that contract.

- `GET/POST /api/v1/projects`, `GET/PUT /api/v1/projects/{id}`: local project records.
- `POST /api/v1/missions/import` (multipart file), `/missions/export` (project, format).
- `POST /api/v1/analyses`: immutable `project`, `kind` (`route`, `coverage`, `altitude`), optional coverage bounds/grid. Returns a job identifier.
- `GET /api/v1/jobs/{id}`: status, progress and whether the saved project has changed. `DELETE` cancels. `GET /jobs/{id}/result` returns the complete immutable JSON report.
- `POST /api/v1/profile`: project, latitude, longitude and EGM96 absolute `altitude_m`; returns a detailed radio path.
- Terrain import, catalog/download, grid preparation and point/tile endpoints manage local elevation.
- `POST /api/v1/observations`: multipart project JSON and CSV. Columns: `lat,lon,altitude_m,altitude_reference,frequency_mhz`; optional `rssi_dbm,link_quality`. Reference is `agl`, `home`, `EGM96`, `NAVD88` or `WGS84_ELLIPSOID`. Frequency must uniquely match a radio profile. Reports predicted RSSI and residual; never silently recalibrates profiles.
- Raster PNG/JPEG/WebP PMTiles v3 basemaps are imported locally and served with byte-range support. Attribution is supplied by the importer. No online basemap is necessary; hillshade/contours derive from selected terrain.

There are at most two simultaneous background jobs. Shutdown cancels active jobs; unexpected restart marks interrupted jobs failed. Cancellation is terminal and late worker writes cannot overwrite it. Jobs execute in separate processes, keeping the local API responsive.

## Prismo boundary

Prismo can submit a project snapshot and retrieve the versioned result without embedding this UI. A future adapter should translate its own altitude/datum conventions explicitly and bind terrain/radio identities. No live telemetry ingestion, vehicle control, radio control, Prismo service changes or remote deployment are included. This release exposes local HTTP and Python interfaces for that later integration.

## Storage

SQLite in WAL mode stores projects, jobs, terrain metadata and observation summaries. GeoTIFFs/basemaps are addressed by SHA-256; result files are written atomically. Raster datum assignment cannot be changed by reimporting the same bytes with a conflicting datum. Back up the entire data directory while stopped. The service is intended for loopback use; authentication and multi-user coordination are not implemented.
