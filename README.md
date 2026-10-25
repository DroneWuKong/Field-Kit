# Prismo Field Kit

Drone planning, equipment setups, checks and field records. **Field Kit Android**
puts the map and route on your phone. **Horizon** runs detailed terrain and radio
analysis on your computer.

## Downloads

| App | Download | Status |
| --- | --- | --- |
| Android Preview 0.3.3-preview.1 | [Download APK](https://github.com/DroneWuKong/Field-Kit/releases/download/android-v0.3.3-preview.1/Prismo-Field-Kit-0.3.3-preview.1.apk) · [preview guide](docs/ANDROID_PREVIEW.md) | Rebuilt current assets; separate installation and development signer; Android 8.0+ |
| Android 0.5.0 | APK supplied directly to the owner · 4.4 MB; [installation guide](docs/ANDROID.md) | Signed development build; Android 8.0+; no public download yet |
| Windows x64 · Horizon 0.2.0 | [Download ZIP · about 80 MiB](https://github.com/DroneWuKong/Field-Kit/releases/download/horizon-v0.2.0-windows/Prismo-Field-Kit-Horizon-0.2.0-windows-x64.zip) | Published portable preview; executable is unsigned |

The preview is a new build of the available 0.3.3 assets, with tools, Practice,
records and desktop plan exchange. It installs as **Field Kit Preview** beside
the original app. It does not include the missing 0.5.0 mobile map planner.
The original 0.5.0 APK has not been published as a public GitHub release.
[Release and source status](docs/RELEASE_STATUS.md) distinguishes the
available downloads from the code currently on `main`. The Android 0.5.0 and
Horizon 0.3.0 source changes are not present on GitHub; the unpublished checkout
was removed by workspace maintenance. The delivered Android APK is preserved.

## Android: open the map and plan

1. Install the APK and allow location when prompted. The app opens the map and
   tries to center on your phone. If a fix is unavailable, the map remains usable.
2. Use **Route** to set home and the ground antenna, add points and edit altitudes.
   Phone location is separate from those planned positions.
3. Use **Equipment** to save a reusable radio setup, review it before applying,
   or undo an equipment change. Unknown power or sensitivity stays unknown.
4. Use **Offline** to import a compatible regional PMTiles map. A world overview
   is already included; detailed streets load online or from an imported map.
5. Export a Prismo plan to Horizon for terrain-aware analysis. Open **Tools** for
   the existing Field Kit checks, records and configuration practice.

[Android installation, offline maps and troubleshooting](docs/ANDROID.md).
The phone planner saves route drafts and assumptions locally. It does not run
Horizon’s terrain engine or produce new terrain-aware coverage predictions.

## Windows: analyze terrain and radio links

Extract the full ZIP and open `PrismoFieldKit.exe`. Keep `_internal` beside the
executable and leave its window open while planning. Docker and a separate Python
installation are not needed. See [Windows setup and qualification](docs/WINDOWS.md).

**The available ZIP is still 0.2.0.** Automatic startup location, the bundled
world overview, regional map preparation and reusable setup library were developed
for 0.3.0, but a recovered source tree and a new native Windows build are still
needed. Those features are not added by downloading the existing 0.2.0 ZIP.

## Configuration and evidence

Configuration deployment in `main` and the delivered Android 0.5.0 planner build
is **Practice**. `LIVE_CONFIG_WRITE_GATE=false` is explicit in
[`fieldkit-deployment.js`](source/assets/tools/fieldkit-deployment.js).
`PracticeAdapter` exercises software drones; `NativeAdapter` rejects physical
configuration writes. The separate native development branch must not be treated
as merged into this planner build.

Software tests, a valid APK signature and modeled RF results do not establish
physical-device validation. The 0.5.0 APK passed build, signature, alignment and
browser checks; it has not been installed on a physical phone or emulator in this
work. [Build and test boundaries](docs/BUILD_AND_TEST.md) explain the evidence.

## Run the current desktop source on Linux

```sh
./scripts/start-planner.sh
```

Open **http://127.0.0.1:8765** for Horizon. Its Field Kit link opens the companion
workspace. The first image build needs Docker and internet; analysis works offline
with prepared terrain and datum grids. Existing data stays in
`~/.local/share/radio-horizon-planner`.

## Documentation

- [Android guide](docs/ANDROID.md): installation, map/route workflow, local data and exports.
- [Windows guide](docs/WINDOWS.md): download, startup, backup and native build.
- [Release/source status](docs/RELEASE_STATUS.md): versions, APK identity and recovery gap.
- [Build and test](docs/BUILD_AND_TEST.md): commands that apply to the current checkout.
- [Consolidation](docs/CONSOLIDATION.md): shared equipment and plan contracts.
- [Project handoff](docs/PROJECT_HANDOFF.md): prior decisions, validation and next work.
- [Browser workspace](docs/WEB.md): hosted Field Kit scope and build.
- [Configuration adapter contract](output/configuration/Native-configuration-adapter-contract.txt).
- Historical [quick start](output/pdf/Prismo-Field-Kit-Quick-Start.pdf) and
  [tool guide](output/pdf/Prismo-Field-Kit-Tool-Guide.pdf): these describe the older
  0.3.1 workflow, not the Android 0.5.0 planner.

## Source layout

| Path | Purpose on `main` |
| --- | --- |
| `apps/horizon/` | Horizon 0.2.0 desktop planner and terrain service |
| `source/assets/tools/` | Field Kit 0.3.3 web assets and vendored runtime |
| `packages/contracts/` | Shared equipment/plan schemas and fixtures |
| `scripts/` | Desktop packaging, web build and contract generation |
| `tests/` | Configuration, browser, exchange and package checks |
| `output/` | Historical APKs, guides and validation receipts; preserved |
| `docs/` | Current operating instructions and version-specific status |

The older native Android 0.4.2 Gradle implementation is on
[`codex/fieldkit-live-config`](https://github.com/DroneWuKong/Field-Kit/tree/codex/fieldkit-live-config).
That branch is a recovery starting point, not the source of the exact delivered
0.5.0 planner APK.

## Provenance

Field Kit was separated from the tools in
[MultiProtocol-UAS-TAK-Bridge](https://github.com/DroneWuKong/MultiProtocol-UAS-TAK-Bridge).
This repository is the project home. Third-party licenses remain in
`source/assets/tools/vendor/`. Private signing keys and personal production
records are not committed.
