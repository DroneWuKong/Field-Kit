# Working on Field Kit

Read `docs/PROJECT_HANDOFF.md`, `docs/BUILD_AND_TEST.md` and the configuration
adapter contract before changing the app. The user's goal is an Android
production-line app that reuses standard setups across drones and records
verified results. Carry this work forward; do not restart from a generic tools
mockup or assume that the Windows tester was Hangar.

- Read `docs/RELEASE_STATUS.md` before making version or source-availability claims.
  `docs/ANDROID_PREVIEW.md` describes the native 0.3.3 preview rebuild now on this
  branch: separate package/signing identity, current main assets, and native writes
  disabled. Keep its version and feature claims distinct from the missing 0.5.0.
  `main` has the asset baseline; the 0.4.2 native Gradle implementation is on
  `codex/fieldkit-live-config`. The delivered 0.5.0 APK's unpublished checkout was
  removed by workspace maintenance and is not recoverable from a fresh clone.
  Do not claim that older source reproduces it or that configuration hardware
  writes work. Preserve the APK and recover/reconstruct the missing source.
- `LIVE_CONFIG_WRITE_GATE=false` is intentional. Keep Practice clearly labeled.
  Do not enable that gate to hide a missing adapter, and do not route a physical
  device request silently to the simulator.
- Preserve separate Betaflight master/PID/rate scopes, observed MAVLink types,
  exact board/firmware matches, target identity, exclusive writer ownership,
  complete reads, before backups, cancellation, durable saves and readback.
  Common calibration/identity protection patterns are not exhaustive.
- Develop and test complete observation/deployment sequences with software
  peers. Hardware tests must be explicitly identified as hardware tests; software
  results cannot stand in for them.
- MafiaLRS was removed. Do not restore its panel, search entry, presets, stale
  shortcuts or removed Forge catalog. Keep the regression test.
- Keep mobile copy plain and useful. Prefer task flows and short screens over
  exposing every setting at once. The user disliked uncanny, machine-like docs.
- Android downloads worked for this user as direct file attachments. When using
  Work Mode, link the actual APK file once; do not mix it with an alternate bubble
  download or claim a GitHub private raw link works without authentication.
- Run `npm test` and appropriate APK checks for changes to these assets. Check
  layout and workflows at 360, 393 and 800 px; maintain honest evidence labels.
- The PDF scripts and screenshots describe 0.3.1. Before editing/rebuilding PDFs,
  follow the available PDF skill, render/inspect the pages and any required
  artifact-authoring marker. Do not regenerate old screenshots against a new
  catalog and then label the PDFs current without reviewing the guide copy.
- Keep private signing keys and credentials out of git. Use the original trusted
  development keystore for an installable update; a different signer cannot
  update the existing app in place. See the documented certificate fingerprint.
- New user instructions take precedence. Do not introduce unnecessary approval
  questions for work already authorized by the user.

## Consolidated planning workspace

- `apps/horizon` contains Horizon with its unsquashed Git history. Work in this
  Field Kit repository for future changes; keep the old standalone checkout.
- `packages/contracts/exchange.js` is the browser adapter source. Service models
  in `apps/horizon/horizon` generate shared schemas and the packaged browser copy
  through `scripts/generate-contracts.py`. Check generated artifacts for drift.
- Keep historical `output/` receipts intact. New test/unsigned build evidence goes
  under ignored `build-private/`; do not label it signed or hardware-validated.
- `docs/CONSOLIDATION.md` is the current integration scope and continuation map.
