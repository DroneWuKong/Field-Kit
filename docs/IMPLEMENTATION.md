# Implementation status

The initial Linux implementation includes:

- Offline browser map, local terrain hillshade/contours and raster PMTiles overlay.
- Separate home, ground antenna and operator positions; draw/edit/insert/delete waypoints, undo/redo and local persistence.
- QGC and Mission Planner file import/export with read-only preservation for unsupported semantics.
- Configurable 490/915/5800 MHz and additional radio profiles; per-radio and combined predictions.
- Route, area coverage, path profiles, bounded altitude suggestions and saved visual comparison.
- Real USGS current-product search/download, GeoTIFF import, explicit datum/grid preparation and provenance.
- Process-isolated background work, progress, cancellation, stale-result detection and JSON reports.
- Observation CSV comparison, typed API, CLI and Linux Docker archive.

Remaining follow-on work: verify actual Orqa hardware profiles with measured thresholds/antenna patterns; collect outdoor observations and evaluate prediction residuals; validate exported files in native target ground stations; add a Prismo adapter; qualify Windows/macOS packaging if requested. This release has no live aircraft or radio interface.
