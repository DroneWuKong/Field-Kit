# Validation record

Validation performed on GupB, Linux x86-64, 2026-10-23. This is local software validation, not independent review, hardware qualification, native ground-station acceptance or field RF validation.

Completed checks are recorded below and in `validation.json` when present. Automated tests cover formulas against independent pycraf reference calculations, synthetic ridge/flat terrain, missing data and datum cases, mission preservation and altitude frames, required-link unknown handling, bounded altitude searches, API snapshots, cancellation and restart recovery. Browser checks use a local service and block external requests throughout the main route-edit/analyze/export workflow.

A real USGS current 1/3 arc-second product was downloaded through the catalog: n43w088, dated 2024-11-07, source ID `672ed3a9d34ea9e4508933cf`. Raster SHA-256: `3a6a5af373aa1f019e217c90e0b1c8b27aea3bb11930aa67afceb20e8a7877cb`. NAVD88-to-EGM96 grids were downloaded and the sample at longitude -87.975, latitude 42.255 transformed to 218.83549319117535 m EGM96. Native horizontal cell spacing near the tile center is about 7.61 m. This confirms an end-to-end catalog/import/datum path; it does not establish survey accuracy.

The bundled synthetic example is deliberately marked synthetic. No recorded flight, spectrum survey or verified Iron Ghost hardware measurements were supplied. Native QGroundControl/Mission Planner reopening and physical field tests remain acceptance steps; internal import/export round trips do not substitute for those checks.

## Final automated checks

- `uv run pytest -q`: **53 passed**. Dependency deprecation warnings remain; none are test failures.
- `uv run ruff check horizon tests scripts/benchmark.py`: passed.
- `npm --prefix frontend run build`: passed TypeScript and production bundling. MapLibre produces a large bundle warning; assets are all local.
- Playwright: **3 passed** against the packaged service, including offline route editing/analyzing/exporting, missing hardware, drawing/undo/redo and persistence across project switching/reload.
- `npm --prefix frontend audit --omit=dev --audit-level=high`: no known vulnerabilities reported at validation time.
- Docker runtime imported rasterio/PROJ successfully after adding the required `libexpat1` shared library.
- Docker `--network none` completed analysis using the real USGS raster and prepared datum grids: **112 samples**, zero unknown samples. The radios for this test were explicitly assumed. See `offline-validation.json` for the terrain/grid checksums and model version.

## Workload measurements

See `benchmark.json` and `scripts/benchmark.py` for a reproducible workload. A 20 km route with 100 waypoints, 25 m maximum route spacing, native DEM profile sampling and three radios completed in **3.86 s** (892 evaluated samples). A 20 × 20 km area with 200 m cells completed in **32.72 s** (10,000 cells). These are single-run GupB measurements against the prepared real USGS tile, not performance guarantees for other hardware or 1 m terrain.

## Failures found and corrected

Browser validation identified and fixed the MapLibre worker URL, stale job-result polling, loading/edit races and project-switch persistence. Packaged execution identified a missing GDAL runtime dependency. A transient Chromium `ERR_NETWORK_CHANGED` during Docker network setup was followed by a full clean rerun after the network stabilized; assertions were not relaxed. Task-owned superseded image layers were removed when the shared host root filesystem filled; other projects and historical container receipts were retained.
