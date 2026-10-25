# Field Kit + Horizon

## Version scope — 24 October 2026

The source layout and implementation below describe `main` (Horizon 0.2.0 and
Field Kit 0.3.3 assets). The delivered Android 0.5.0 APK adds a separate phone
map/route/setup workspace, but its unpublished source checkout is no longer
available after workspace maintenance. It must not be inferred from this older
source layout. See [release/source status](RELEASE_STATUS.md) and
[Android instructions](ANDROID.md).

The delivered phone planner uses its own `fieldkit-mobile-planner-v1` localStorage
record and `fieldkit-offline-maps-v1` IndexedDB database, while retaining the
existing appassets origin and legacy tool records. Its exports use the existing
Prismo contracts. This is file exchange, not shared storage or phone-side
execution of the desktop terrain engine.

## Consolidation recorded on 23 October 2026

Field Kit is now the common source repository. Horizon was imported under
`apps/horizon` with `git subtree add` **without squash**. Its original commits
`afea5b1` and `79baf49` remain ancestors alongside Field Kit commit `784d74a`.
The former standalone checkout is retained, and its branch/history were not
rewritten. Field Kit’s existing remote remains the publication destination.

## Implemented

- One desktop service serves Horizon at `/` and Field Kit at
  `/field-kit/tools/tools_offline.html?mode=standalone`. Both have navigation back
  to the other. Python terrain analysis remains the authoritative detailed model.
- Field Kit’s task navigation is **Plan · Set up · Check · Records**. Existing
  calculators, configuration practice and receive diagnostics remain accessible.
- `prismo.equipment.v1` carries ID, revision, serial, named radio links with roles
  and directions, frequency in MHz, power/sensitivity in dBm, gains/losses in dB,
  provenance, required margin and an original Field Kit source-profile snapshot.
- Field Kit exports require an explicit role and direction. Conversion is
  `dBm = 10 log10(mW)`. Legacy defaults are labeled assumed. Unknown values from
  Horizon stay null. Battery and device details remain in the source snapshot.
- Horizon validates and previews an import. Apply is undoable, invalidates prior
  analysis, selects the incoming control when present, and retains unrelated
  comparison links. Replacing equipment removes its previous links. A replacement
  cannot leave the project without a control link.
- Equipment files can return to Field Kit Records. Choose one radio to reuse in
  quick calculators. A colliding equipment ID creates a new local copy rather
  than overwriting the existing profile. Unknown power/thresholds, unsupported
  values or losses that quick tools cannot represent block this conversion.
- `prismo.plan.v1` carries the complete editable Horizon project with a fixed
  **predicted** evidence label. Field Kit reviews, saves, displays and re-exports
  the file. Horizon imports a new project ID to avoid overwriting local work.
  Terrain/basemap files and analysis results are not part of this envelope.
- Records exposes existing diagnostic snapshots, imported plans/equipment and an
  entry to configuration practice runs. Imported files remain unverified source
  claims; they are never presented as physical measurements or passed checks.
- Legacy storage keys remain untouched. Planning copies use
  `fieldkit-planning-records-v1`, keep up to 50 records without silent eviction,
  and report storage failures before claiming success. Unreadable storage is
  retained and blocks new imports. Imported equipment is only applied explicitly.

## Source and runtime layout

```
source/assets/tools/       Android/browser Field Kit assets
apps/horizon/frontend/     React planning interface
apps/horizon/horizon/      Python API, terrain and propagation implementation
packages/contracts/       schema artifacts, adapter source and shared fixtures
scripts/                  shared contract generation and desktop launcher
```

Service Pydantic models define the schemas. `scripts/generate-contracts.py`
generates `packages/contracts/schemas.json` and the packaged
`source/assets/tools/prismo-contracts.js` from those models plus
`packages/contracts/exchange.js`. `--check` detects stale generated files.
There is one handwritten browser adapter; the asset copy is generated.

The schema interpreter supports the vocabulary emitted by the current models.
When introducing new JSON Schema keywords, extend and test the interpreter or
replace it with a complete bundled validator. Plan checks additionally enforce
selected/required links, unique IDs and valid altitude bounds.

## Evidence and remaining work

Software checks cover cross-runtime exports/imports, explicit power conversion,
unknowns, invalid roles/schemas, preserved snapshots, repeat import, undo/redo,
reload, storage quota failure, stale preview clearing and mobile widths
360/393/800. Existing configuration and retired-tool regressions remain required.
New evidence lives in ignored `build-private/validation/`; historical receipts
and signed APKs under `output/` are not overwritten.

The 0.3.3/code 6 APK asset update is **unsigned**. Asset/native-entry comparison is
not signature, installation or hardware validation. Original signing continuity
is still required to update the installed Android app.

Further consolidation remains deliberate:

1. Phone-only offline terrain parity requires native source recovery or a new
   app-owned runtime. Copying Python/GDAL into a WebView is not an implementation.
2. Legacy quick tools and mesh/free-space previews still use their existing
   approximation. They have not been deleted or silently relabeled equivalent
   to Horizon’s full terrain/delta-Bullington calculations. A common remote/native
   engine adapter and numerical fixtures precede retiring those paths.
3. Relay/mesh route scenarios need an explicit graph/link model in Horizon.
4. Records currently provides a common entry and file exchange, not synchronized
   storage across the Android WebView and desktop browser or one SQL database.
5. Physical configuration writes, durable native production storage and verified
   manufacturing workflows retain the existing native-adapter requirements.

No new hardware capability is implied by this source consolidation.
