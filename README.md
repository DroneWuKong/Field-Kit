# Prismo Field Kit

Standalone Android tools for drone setup, inspection and production-line work.
The current build is **0.3.2** (`versionCode 5`), package
`com.dronewukong.fieldtools`, Android 8.0/API 26 or newer.

**The configuration workbench currently uses software test drones. Real
Betaflight configuration and ArduPilot/PX4 parameter push/pull is unfinished.**
The original native Android source module is missing; this repository contains
recovered web assets, the original compiled APK and the later asset updates.
It is not yet a complete Gradle Android source project.

## Start here

- [Project handoff](docs/PROJECT_HANDOFF.md): decisions, current state and next work.
- [Build and test](docs/BUILD_AND_TEST.md): reproduce the available software checks and APK asset update.
- [Configuration workflow](output/configuration/Configuration-workbench-notes.txt).
- [Native configuration adapter contract](output/configuration/Native-configuration-adapter-contract.txt).
- [Latest Android APK](output/app/Prismo-Field-Kit-0.3.2-debug.apk).
- [Quick start PDF](output/pdf/Prismo-Field-Kit-Quick-Start.pdf) and
  [tool guide PDF](output/pdf/Prismo-Field-Kit-Tool-Guide.pdf): describe version 0.3.1;
  the configuration notes above cover the 0.3.2 addition.

## What is here

| Path | Purpose |
| --- | --- |
| `source/assets/tools/` | Current editable HTML, JavaScript, CSS and vendored runtime |
| `source/Prismo-Field-Kit-0.3.0-debug.apk` | Verified baseline compiled app required by the asset repackager |
| `output/app/` | APKs 0.3.1 and 0.3.2 and validation records |
| `tests/` | Configuration model, phone-browser UI, retired-tool regression and APK checks |
| `tmp/repackage_fieldkit.py` | Asset replacement and binary manifest version update; preserves native code |
| `tmp/pdfs/` | Guide authoring scripts, source copy, screenshot metadata and annotated-guide screenshots |
| `output/pdf/` | Human-readable user guides with arrows/callouts |
| `output/configuration/` | Configuration notes, adapter contract, screenshots, sample report and validation |
| `docs/` | Project context, recovery boundary, build/signing and continuation plan |
| `AGENTS.md` | Working guidance for continuing this project |

The Home screen groups tools into radio planning, video setup, connection checks
and quick field tools. The configuration workbench is under Tools; search
“configuration”. Its three screens are Setup → Drones → Run.

## Software checks

```sh
npm ci
npx playwright install chromium
npm test
npm run validate:apk
```

Node 22+ and Python 3 are required. On Linux, Chromium may additionally need
system dependencies (`npx playwright install --with-deps chromium`). The tests
are software checks; they do not prove physical drone or Android installation
behavior. See the build guide for the native-source limitation and signing.

## Provenance

Field Kit was separated from the tools in
[MultiProtocol-UAS-TAK-Bridge](https://github.com/DroneWuKong/MultiProtocol-UAS-TAK-Bridge).
This repository is the requested home for continuing the standalone app.
Third-party runtime licenses remain in `source/assets/tools/vendor/`.
No signing keystore, credentials or personal production records are committed.
