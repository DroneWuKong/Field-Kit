# Build and test

The native Android rebuild is documented in [Android Preview](ANDROID_PREVIEW.md).
Run `./gradlew :app:assembleRelease :app:lintRelease` with JDK 17 and Android SDK 35.
The preview uses current 0.3.3 assets and a separate application ID/signing identity.
It does not reproduce 0.5.0. Use `tests/validate-native-package.py` for this build;
the legacy asset repackager and validator below remain available separately.

These commands apply to the source currently on `main`: **Horizon 0.2.0** and
**Field Kit 0.3.3 web assets**. They do not reproduce the delivered Android 0.5.0
APK or the unpublished Horizon 0.3.0 work. Read [release/source status](RELEASE_STATUS.md)
and [Android usage](ANDROID.md) before choosing a build path.

## Check the current Field Kit assets

Use Node 22+, Python 3 and the pinned Playwright dependency:

```sh
npm ci
npx playwright install chromium --only-shell
npm test
npm run contracts:check
```

Contract generation/checking also requires `uv` and the Horizon Python environment.
On Linux, install Chromium system dependencies when necessary with
`npx playwright install --with-deps chromium`.

The root suite covers configuration models, browser workflows, the removed-tool
regression, equipment/plan exchange and phone layouts at 360, 393 and 800 px.
The browser harness uses the Android-like HTTPS asset origin and blocks external
network requests. It does not open real USB devices or validate physical drones.
Current evidence goes under ignored `build-private/validation/`; do not overwrite
historical `output/` receipts or PDF screenshots.

The explicit configuration boundary is in
[`source/assets/tools/fieldkit-deployment.js`](../source/assets/tools/fieldkit-deployment.js):

- `LIVE_CONFIG_WRITE_GATE=false` identifies the physical-write gate.
- `PracticeAdapter` provides the supported hardware-free execution path.
- `NativeAdapter` rejects physical configuration access, and the runner accepts
  `mode=simulation` only on `main`.

Tests can exercise the full practice sequence without hardware. Changing the
constant alone does not supply a native adapter. See the
[adapter contract](../output/configuration/Native-configuration-adapter-contract.txt)
for required target identity, complete reads, backups, persistence and readback.

## Check Horizon source

From `apps/horizon`:

```sh
uv sync --frozen
uv run pytest -q
uv run ruff check horizon tests
npm --prefix frontend ci
npm --prefix frontend run build
```

Start a separate test service, then run the browser suite in another terminal:

```sh
uv run horizon --data /tmp/horizon-browser-data serve --port 8766
```

```sh
cd frontend
npx playwright install chromium
npx playwright test
```

Use `npm run contracts:generate` at the repository root after intentional service
schema changes, and `npm run contracts:check` to detect drift. Generated browser
contracts must match `packages/contracts/exchange.js` and the service models.

`./scripts/start-planner.sh` builds the combined Docker image and starts the local
workspace. The first build needs internet. Reuse the existing data directory;
an older running container must not be reported as a newer source build.

## Build the published Windows version

Use [the Windows guide](WINDOWS.md) and `scripts/build-windows.ps1` on Windows x64.
The current manual workflow and packaging script target **0.2.0**. Linux service
or browser tests do not qualify a native Windows executable. Restoring the 0.3.0
source and packaging changes is required before a 0.3.0 Windows build can run.

## Android asset update available on main

The current asset repackager targets **0.3.3 / versionCode 6** against the exact
compiled 0.3.0 baseline. This is the legacy asset-update path, not a full native
0.5.0 build:

```sh
npm run build:apk-assets
npm run validate:apk
```

The resulting `build-private/fieldkit-unsigned.apk` is unsigned. The validator
checks its manifest, asset contents and preserved non-asset entries; it does not
prove installation or hardware behavior.

To sign that legacy output, provide Android Build Tools 35.0.0 and the original
trusted development key locally. For example, using a private key path:

```sh
zipalign -f -p 4 build-private/fieldkit-unsigned.apk build-private/fieldkit-aligned.apk
apksigner sign --ks /secure/path/development.keystore --ks-key-alias androiddebugkey --out build-private/Prismo-Field-Kit-0.3.3-debug.apk build-private/fieldkit-aligned.apk
apksigner verify --verbose --print-certs build-private/Prismo-Field-Kit-0.3.3-debug.apk
zipalign -c -p 4 build-private/Prismo-Field-Kit-0.3.3-debug.apk
python3 tests/validate-package.py --apk build-private/Prismo-Field-Kit-0.3.3-debug.apk
```

Let the signer prompt for passwords or use a local secret mechanism. Never put
private credentials in history, documentation, source or the repository. A newly
generated debug key cannot update an installed app signed by the original key.
Do not try to replace an installed code-9 build with this older code-6 package.

## Android 0.5.0: verification versus rebuild

The exact 0.5.0 source checkout was removed before publication. The older native
Gradle implementation remains on
[`codex/fieldkit-live-config`](https://github.com/DroneWuKong/Field-Kit/tree/codex/fieldkit-live-config),
where `app/build.gradle.kts` declares **0.4.2 / code 8**. It is useful recovery
material, not an exact 0.5.0 source tree. `main` does not contain the 0.5.0 mobile
frontend, source staging script or native APK validator.

The recorded 0.5.0 build used JDK 17 including `jlink`, Gradle 8.9, Android Gradle
Plugin 8.7.3, SDK platform 35 and Build Tools 35.0.0, with Node 22+ and Python 3.
Restore the matching source and tests before presenting new build commands as a
reproducible 0.5.0 release process.

The delivered binary can still be inspected with Android Build Tools:

```sh
apksigner verify --verbose --print-certs Prismo-Field-Kit-0.5.0.apk
zipalign -c -p 4 Prismo-Field-Kit-0.5.0.apk
aapt dump badging Prismo-Field-Kit-0.5.0.apk
```

Expected package: `com.dronewukong.fieldtools`; version `0.5.0`; code `9`; minimum
SDK `26`; target SDK `35`. Compare its SHA-256 and certificate with
[the artifact identity](RELEASE_STATUS.md#android-050-artifact).
A matching signature and hash verify identity, not on-device functionality.

## Documentation and historical evidence

`tmp/pdfs/` and `output/pdf/` retain the earlier guide sources, screenshots and
PDFs. Their 0.3.1 workflow is historical. The new Android planner instructions are
in [ANDROID.md](ANDROID.md); the old PDFs have not been regenerated or relabeled.

Before regenerating PDFs, update the copy and screenshot mapping, follow the PDF
workflow, render every page, and inspect layout and callouts. Preserve the old
versioned artifacts. `output/app/` and `output/configuration/` also remain historical
records, not evidence for features added later.
