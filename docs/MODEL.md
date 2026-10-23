# Model and research basis

Reviewed 2026-10-23. The implementation is a deterministic terrain/link-budget estimator, not a complete statistical propagation model.

## Calculations

- WGS84 geodesic paths and distances; effective earth radius `k × 6,371,000 m`, default `k=4/3`. Smooth-earth horizon is a useful reference, not a terrain-aware range boundary.
- Free-space loss using distance and frequency (ITU-R P.525).
- Full delta-Bullington diffraction including spherical-earth correction, independently implemented from ITU-R P.526-16 §4.5 and §3.1.1/§3.2. This is not the full P.452 or Longley–Rice model. Polarization and ground permittivity/conductivity are explicit inputs.
- First Fresnel radius and effective-earth terrain bulge are evaluated along the full path. Default clearance is 60% of the first zone. Receiver power = transmit power + antenna gains − cable losses − free-space loss − diffraction loss. Default required reserve is 10 dB.
- Every radio is evaluated independently. Combined state uses the selected control radio and required video/telemetry profiles. A known failed required link remains red even if another required link is unknown; unknown values never qualify as passing.
- Native DEM cells are sampled without smoothing narrow ridges. Path spacing is no coarser than half the finest selected raster resolution or the requested profile spacing. This cannot recover sub-cell obstacles. The finest selected raster controls overlapping coverage; its NoData does not silently fall back to a coarser surface.
- Terrain elevations are transformed to WGS84/EGM96 with PROJ. Missing datum, missing grids, unresolved home, uncovered paths or insufficient hardware inputs produce unknown results. No ballpark datum transforms are accepted. Grid network access is disabled during analysis.
- Segment heights interpolate resolved absolute elevations, except between two AGL waypoints, where the specified AGL interpolates over terrain. This is a path assumption, not an autopilot flight simulation. Unsupported intervening mission commands break analyzable route continuity.
- Altitude suggestions sweep configured AGL limits at 5 m intervals and refine a passing interval at 1 m. They are the lowest evaluated passing altitude, not a continuous global optimum. Climb rates, turn radii, battery reserve and avoidance are not evaluated.
- Near-vertical paths under 1 m horizontal distance are marked unknown. Steep obstructed paths beyond a 12° inclination are marked outside model scope. Profiles are capped at 200,001 terrain samples; route and coverage sample budgets are bounded.

## Terrain and provenance

USGS TNM searches use the catalog dataset classification for current 1/3 arc-second products. A current catalog item can have a URL containing `/historical/`; URL spelling is not a currency test. Catalog identity, dates, raster checksum, CRS, vertical datum, native resolution and synthetic flag are recorded. Results include immutable request snapshots, terrain metadata, model version and grid hashes.

The initial package includes EGM96 and two regional US datum grids with pinned SHA-256 values in `scripts/grids.json`. This is not universal regional datum coverage. Use Prepare datum grids for the actual selected rasters before disconnecting.

USGS bare-earth data generally omits trees and structures. Neither a green route nor a diffraction prediction establishes field reliability. There is no atmospheric variability, clutter-loss, rain, interference, two-ray multipath, antenna-pattern or airframe-shadowing model. Constant antenna gains assume the entered orientation-dependent gain is appropriate. Hardware defaults remain unknown until supported by measurements or documentation; example values are hypothetical.

## Primary sources

- [ITU-R P.525: free-space attenuation](https://www.itu.int/rec/R-REC-P.525/en).
- [ITU-R P.526-16: propagation by diffraction](https://www.itu.int/rec/R-REC-P.526-16-202511-I/en).
- [USGS 3DEP products and services](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services).
- [USGS TNM API](https://tnmaccess.nationalmap.gov/api/v1/docs).
- [PROJ transformation grids](https://cdn.proj.org/) and [pyproj TransformerGroup](https://pyproj4.github.io/pyproj/stable/api/transformer.html#pyproj.transformer.TransformerGroup).
- [QGroundControl plan file format](https://docs.qgroundcontrol.com/master/en/qgc-dev-guide/file_formats/plan.html).
- [MAVLink mission plain-text format](https://mavlink.io/en/file_formats/).
- [MAVLink coordinate frames](https://mavlink.io/en/messages/common.html#MAV_FRAME).
- [pycraf propagation reference](https://bwinkel.github.io/pycraf/pathprof/index.html): used only in tests for independently implemented delta-Bullington comparisons; it is not a runtime dependency.

Orqa Iron Ghost-specific transmit powers, receiver sensitivity, antenna patterns and usable video thresholds are not established by this work. Frequency labels alone cannot supply a verified hardware preset. The requested 490/915/5800 MHz values are therefore editable user assumptions.
