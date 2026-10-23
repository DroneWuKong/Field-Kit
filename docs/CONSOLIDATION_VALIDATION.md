# Consolidation software validation — 23 October 2026

- Horizon backend: **59 pytest checks passed**, including cross-runtime exchange
  using an actual Node/Field Kit export; Ruff passed. The five new exchange checks
  were rerun after the browser adapter was finalized and passed.
- Horizon UI: TypeScript and Vite production build passed. Four Playwright
  workflows passed: existing offline route analysis/export, drawing/undo/unknown
  inputs, project persistence, and shared equipment/plan exchange. The exchange
  test includes preview, undo/redo, reload and navigating between both apps.
- Field Kit: **35 configuration model checks passed**; all existing configuration
  browser workflows and the retired-tool regression passed. Shared contract checks
  passed. Planning workflows passed at **360, 393 and 800 px**, including import,
  export, quota failure, rejected-preview clearing, reload and preserved legacy
  equipment/bench notes. Returning a radio to quick tools preserves the old profile
  and creates a separate copy when its ID collides.
- Generated schemas match the service models; the committed browser bundle matches
  the shared adapter source. `git diff --check` passed.
- The unsigned Android asset package declares **0.3.3 / code 6**, with **34 assets**
  matching source and **432 native/resource entries unchanged** from the baseline.
  The removed catalog stays absent and `LIVE_CONFIG_WRITE_GATE=false` remains.
  This is not a signed, installed or hardware-tested Android release.
- New screenshots and test receipts are in ignored `build-private/validation`;
  the unsigned APK and its structural receipt are in `build-private`. Historical
  signed releases, PDF screenshots and receipts under `output` are unchanged.

The new exchange test initially hit a Playwright selector ambiguity between
“Open project” and “Open project JSON”. Selecting the exact label resolved the
harness issue; the full exchange workflow then passed. Existing library
warnings and the MapLibre large-bundle warning remain; no physical radio or
native configuration verification was performed.
