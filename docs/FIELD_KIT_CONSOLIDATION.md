# Field Kit and Horizon consolidation review

Reviewed 2026-10-23 against Field Kit main `784d74a0f9b90213f4cadabc384d9bc33ce389fb` and the current Horizon implementation. The clean local Field Kit checkout is `/srv/dev-rig/workspaces/dronewukong/worktrees/Field-Kit-recorder-companion-20261009`; its origin is https://github.com/DroneWuKong/Field-Kit.git. No Field Kit files or history were changed for this review.

## Recommendation

Use **Prismo Field Kit** as the product family and **Horizon** as its planning workspace. Consolidate the shared models and workflow before moving repositories. Keep the current Android functions, and make desktop planning a companion that exchanges the same equipment, project and evidence records. A shared visual language alone would leave the most important duplication intact.

An eventual Field Kit monorepo can contain `apps/field-kit` (Android shell/web assets), `apps/horizon` (planning interface), `services/radio-terrain` (one authoritative analysis engine), and `packages/contracts` (versioned schemas plus conversion fixtures). Preserve both Git histories during any later move. Horizon presently has its own local Git repository; no GitHub remote has been configured.

## Actual overlap

| Area | Field Kit today | Horizon today | Consolidation target |
| --- | --- | --- | --- |
| Radio calculations | Range budget, Fresnel and worst-obstacle knife-edge model | P.525 + full delta-Bullington, per-link required margins | One analysis contract and authoritative implementation; retain simple calculator views |
| Terrain | HGT and EPSG:4326 GeoTIFF import, online elevation fallbacks, in-memory DEMs | Persistent GeoTIFF library, projected CRS support, explicit vertical datums and offline grids | One terrain library with coverage, datum, checksum and source metadata |
| Coverage | Separate RF and mesh heatmap loops use free-space budget | Terrain paths evaluated for every coverage cell | Explicitly distinguish quick free-space previews from terrain-evaluated coverage |
| Maps and routes | Leaflet terrain paths, waypoints, repeater and mesh nodes | MapLibre mission editor, route profiles, QGC/WPL interchange | One planning workspace; carry useful relay/mesh tools forward, not discard them |
| Equipment | Versioned equipment profiles, serials, radio/video/battery details | Mission radio profiles with roles and assumption provenance | Shared equipment record with multiple radio links, battery and unit identity |
| Records | Saved checks, HTML reports, practice deployment ledger in localStorage | SQLite projects, immutable analysis snapshots, JSON reports and CSV comparisons | Unified records/export model with explicit measured, predicted and simulated evidence |

The overlap is functional, not drop-in code compatibility. Field Kit is vanilla JavaScript in an Android WebView. Horizon uses React/TypeScript and a Python/GDAL/PROJ service. Python terrain analysis cannot be placed into the existing APK by copying its HTML.

## First implementation slice

1. Define a versioned equipment exchange schema and import/export adapters in both apps. Convert Field Kit power from mW to dBm explicitly (`10 log10(mW)`), retain original values and revisions, and require an explicit control/video/telemetry role. Preserve unknowns and assumption provenance. Do not promote hardcoded legacy radio presets to manufacturer-verified data.
2. Add one **Plan** entry to Field Kit and make Horizon its desktop planning workspace. Exchange project/report files first; a connected-service mode needs deliberate endpoint discovery, authentication and Android networking support. The current Horizon service is loopback-only.
3. Put RF range, terrain path and coverage calculations behind the shared contract, with reference fixtures checking numerical behavior. The legacy worst-obstacle approximation and full delta-Bullington model are different methods; document expected differences instead of forcing identical answers.
4. Merge equipment, saved checks and mission reports into a common records browser. Preserve existing localStorage records and stable IDs through tested migrations.
5. Bring relay and mesh scenarios into the common map. Plan each relevant radio link through the same terrain engine while keeping network connectivity logic separate from propagation.
6. Move source into the chosen monorepo after adapters and parity checks pass; retire duplicate implementations only after their workflows are covered.

Suggested operator navigation: **Plan · Set up · Check · Records**. Equipment is shared context across these tasks rather than a different profile for every calculator. Keep configuration deployment as its own workflow and retain the Practice/Connected-device distinction.

## Android boundary

Field Kit's native Android source is missing. Its APK packaging currently replaces web assets inside the compiled baseline; it is not a reproducible full native build. Configuration writes deliberately remain disabled (`LIVE_CONFIG_WRITE_GATE=false`), and the runner accepts simulation adapters only. Consolidation must not imply that USB/MAVLink writes or phone-only offline terrain analysis become available automatically. Recover/rebuild the Android shell and choose a validated native runtime or portable engine before promising phone-only offline parity. Keep original signing continuity and existing saved records.

## Evidence

- [Field Kit project handoff](https://github.com/DroneWuKong/Field-Kit/blob/784d74a0f9b90213f4cadabc384d9bc33ce389fb/docs/PROJECT_HANDOFF.md): product intent, Android boundary, storage and task flows.
- [RF/terrain implementation](https://github.com/DroneWuKong/Field-Kit/blob/784d74a0f9b90213f4cadabc384d9bc33ce389fb/source/assets/tools/tools-core.js#L809): `analyzePath`; RF heatmap starts at line 1903, mesh heatmap at line 2694. Both heatmaps calculate free-space budgets without per-cell terrain evaluation.
- [Equipment schema](https://github.com/DroneWuKong/Field-Kit/blob/784d74a0f9b90213f4cadabc384d9bc33ce389fb/source/assets/tools/fieldkit-models.js#L4) and [shared calculator inputs](https://github.com/DroneWuKong/Field-Kit/blob/784d74a0f9b90213f4cadabc384d9bc33ce389fb/source/assets/tools/fieldkit-workbench.js#L17).
- [Native adapter contract](https://github.com/DroneWuKong/Field-Kit/blob/784d74a0f9b90213f4cadabc384d9bc33ce389fb/output/configuration/Native-configuration-adapter-contract.txt).

This is a source review and migration proposal. It does not claim a completed app merge, Android build, or hardware qualification.

The scoped structural review used graphify's AST extractor on the ten first-party JavaScript files directly under `source/assets/tools`: 197 nodes and 440 edges, with zero LLM extraction tokens. No existing saved graph was present. The structural output was kept outside the Field Kit checkout; conclusions above were checked against the cited source and handoff, rather than inferred from node counts.
