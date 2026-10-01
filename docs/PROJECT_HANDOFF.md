# Project handoff — 1 October 2026

## User intent and decisions

The user wants a standalone Android app built from the TAK Bridge tools, with a
simpler interface. The latest direction is “pretty much an android version of
the Windows line mfg app we made”: reusable standard setups, quick processing of
multiple drones, repeatable checks and per-drone records.

Requested configuration functions are Betaflight dump/config pull and push;
ArduPilot/PX4 parameter pull and push; create/edit/import saved templates; apply a
setup across a batch quickly. Configuration deployment is distinct from flashing
firmware. Firmware flashing has not been implemented.

The user explicitly removed MafiaLRS. It is absent from the current UI/catalog,
presets and packaged Forge database. Old stored favorites/recent entries and an
old `#mafialrs` route are handled without restoring the tool. Do not add it back.

The user requested supporting PDFs with screenshots and arrows, then asked for
more human writing. Those guides were rewritten. Keep concrete instructions and
normal phrasing. The user is on Android; direct APK file attachments worked,
while tiny download bubbles/alternate links did not. Prefer one actual APK link.

The latest instruction is to put all app work and continuation context into
`https://github.com/DroneWuKong/Field-Kit`. This repository is the new project home.
The request authorizes this migration and GitHub publication to that repository.
The previous TAK Bridge repository is not being deleted or rewritten.

## Current implementation

The app package is `com.dronewukong.fieldtools`; launcher is
`com.dronewukong.fieldtools.FieldToolsActivity`. Baseline 0.3.0 has `versionCode 3`,
0.3.1 is code 4 and 0.3.2 is code 5. Minimum SDK is 26, target/compile SDK is 35.
All updates here preserve compiled native code and native resources.

Home has four task entries: Plan a radio link; Set up video; Check a connection;
Quick field tools. Bottom navigation is Home, Equipment, Saved checks, Tools.
There are 21 current tools. Equipment profiles, diagnostic snapshots, config
inspection, location health, RF/video calculators and bench notes are included.

Version 0.3.2 adds Configuration workbench:

- Setup → Drones → Run screens; batch/work-order and operator labels.
- Betaflight supported CLI dump/diff text, profile-aware entries, file import,
  clipboard copy and editable saved templates.
- ArduPilot/PX4 two-column or five-column QGroundControl parameter files.
- Exact stack, board and firmware matching; known parameter types/encoding;
  range/read-only checks where metadata is present.
- Three distinct software drones for each flight stack, with different identity
  and calibration settings. Common per-unit fields are kept by default.
- Comparison bound to the reviewed source snapshot and selected template.
- Backup and write-ahead records before writes; sequential apply; save;
  fresh readback; stop queue on failures; cancellation between steps.
- Per-unit results, before/after hashes and reports with full before backups.
- Practice fault cases: rejected setting, disconnect during write, saved value
  mismatch. A failed unit is incomplete, not passed. No automatic rollback.

**These reads/writes are simulations. Physical configuration push/pull is not
implemented.** `NativeAdapter` throws and `LIVE_CONFIG_WRITE_GATE=false`.
The deployment runner currently rejects every adapter mode except `simulation`.

Existing native connection diagnostics are passive receive only. Direct MSP may
be silent because this adapter sends no requests. JS uses Android bridge calls:
`getDiagnosticPorts`, `startDiagnostics`, `stopDiagnostics`, `getDiagnostics`,
`probeVideo`, `requestFreshPhoneLocation`, `getCurrentPhoneLocation`,
`requestLocationPermission`, `getAppVersion`, `copyText` and `saveReport`.
These callbacks are not a configuration-write API. TCP probe results do not prove
video decoding or latency. The current report exporter saves HTML; config/param
text can be copied, but native `.param`/`.txt` export is unfinished.

## Editable files and architecture

`tools_offline.html` loads the separated runtime, avoiding HTML string replacement
that can accidentally modify report-generator strings. Standalone behavior is
selected with `?mode=standalone`; browser tests use the native-like HTTPS origin
`https://appassets.androidplatform.net/assets/tools/tools_offline.html`.

- `tools-core.js`, `tools-ui.js`, `tools-actions.js`: original calculators,
  navigation and clipboard/report actions.
- `fieldkit.js`: catalog additions, task flows, favorite/recent/input storage,
  coordinates, batteries, signal readings and bench checklist.
- `fieldkit-models.js`: equipment validation, config inspection and diagnostics.
- `fieldkit-workbench.js`: equipment/config inspector, receive diagnostics,
  position health, stored records/report UI.
- `fieldkit-design.js` and `fieldkit.css`: mobile task UI and navigation.
- `fieldkit-deployment.js`: pure template/parser/planner/deployment model,
  software adapter and explicit missing-native boundary.
- `fieldkit-deployment-ui.js`: template library, three screens, comparison,
  run ledger, practice faults and HTML exports.

Storage uses the WebView's localStorage. Existing keys include favorites, recent,
inputs, checklist/notes, equipment and diagnostic records. Deployment keys are
`fieldkit-deploy-templates` (30 templates) and `fieldkit-deploy-runs` (10 runs).
Storage errors stop configuration before writes. The current local ledger is
suitable for the practice workflow, not a complete durable manufacturing store.
Do not clear existing storage keys during migration without preserving records.

Betaflight parser supports a reviewed command subset; it is not a universal
restore engine. It rejects duplicates and unsupported commands and omits reset/
save commands from imported templates. Parameter files can lack types; types
must come from a live read before writes. Source file system/component IDs are
source metadata, not authorization to select a destination.

## Missing source and Windows app

The original standalone native Android module was created earlier but is absent
from the currently available source checkout. The recovered 0.3.0 APK is included
as the exact baseline. The subsequent releases were made by replacing assets,
updating the binary manifest version, aligning and signing with the original
trusted development key. No Java/Kotlin source was recovered or fabricated.

The original source project was
`DroneWuKong/MultiProtocol-UAS-TAK-Bridge`, main commit
`4d074597cf69efbc8833be4b8aab81507cfb3f76`. The local MafiaLRS-removal commit there
was `eae5cb8`; its source changes are represented in the recovered current assets.
That upstream main tree contains the TAK Bridge app, not the standalone
`:fieldtools` module. Fetching that tree alone does not complete this project.

The exact Windows production-line tester repository/source has not been found.
Earlier searches found adjacent Prismo/Hangar/PrismoDeck work, but the user had
already clarified that Hangar was not the intended tester. Do not claim this is a
verified Windows-app port or copy unrelated fleet-control code as if it were the
manufacturing app. Continue the concrete requested workflow while recovering
that source if it becomes available.

Relevant prior architectural decisions included Read → Diff → Approve → Apply →
Verify → Log, per-drone identity, repeatable steps, separate shared/unit settings,
configuration comparison and exportable records. A physical serial link should
have one writer; coexistence with Mission Planner/QGroundControl must use routing
and explicit writer ownership rather than competing physical-port writes.

## Validation performed

35 model tests pass. They cover successful three-unit batches for all stacks;
backup before writes; per-unit identity/calibration preservation; profile scopes;
numeric bounds; typed files; bytewise integer bits versus C-cast precision;
exact compatibility; incomplete reads; missing disarmed state/type/encoding;
read-only/range checks; stale comparison; quota failure; cancellation; rejection;
disconnect; failed readback; corruption of untouched settings; second-unit failure;
blocked live adapter.

Browser tests pass for all three stacks, imports, template reload/persistence,
edit invalidation, failure queues and HTML backup export. Phone controls fit
360, 393 and 800 px; page errors are absent. Retired-tool regression verifies
21-tool catalog, stale shortcuts/hash handling, empty retired search, existing
bench notes and intact hardware task flow.

The APK is aligned, has valid v2/v3 signatures with the original certificate,
and contains all 32 expected assets. All 432 non-asset/native resource entries
are byte-identical to the original APK. Physical phone installation, USB
configuration, MAVLink parameter changes and production hardware were not tested.
The original native-only test suite was not recovered; do not claim it ran here.

## Next work, in order

1. Recover the standalone native Android source module, or build a new app-owned
   Android shell with package/lifecycle/permissions/WebView bridge and the
   existing tested assets. Keep this gap visible in status/build docs.
2. Implement actual USB/serial and MAVLink configuration transports following
   `Native-configuration-adapter-contract.txt`. Implement complete catalogs,
   immutable UID, confirmed disarmed state, encoding/type negotiation, exclusive
   writer, persistence/reconnect and readback. Do not simply turn the gate on.
3. Add native config/param text-file export and durable production storage.
   Keep reviewed shared templates separate from per-unit calibration/identity.
   Add per-unit overlay and reviewed recovery before claiming clone/restore.
4. Exercise real native protocol state machines using fake serial/MAVLink peers,
   including incomplete lists, stale targets, readonly echoes and reconnect.
   Then identify physical hardware validation separately. Keep production
   acceptance checks distinct from configuration-value verification.
5. When the Windows tester source is found, reuse its actual job schema, test
   recipes and reporting where suitable. Add serial/barcode scanning, operator
   steps and next-drone handling against those real requirements.
6. Update the PDFs for the completed physical workflow, with current screenshots
   and plain operator instructions. Existing PDFs describe 0.3.1/20 tools;
   the 0.3.2 config notes are the current addition.

## Reference protocols

Official pages inspected for this feature:

- https://betaflight.com/docs/wiki/guides/current/Cli
- https://mavlink.io/en/services/parameter.html
- https://ardupilot.org/dev/docs/mavlink-get-set-params.html
- https://docs.qgroundcontrol.com/Stable_V5.0/en/qgc-dev-guide/file_formats/parameters.html
- https://docs.px4.io/main/en/advanced_config/parameters

Recheck current official documentation when implementing native writes. Observe
the actual target capabilities; do not infer types/encoding from a product name.
