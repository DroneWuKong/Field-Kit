# Build and test

## JavaScript and browser checks

Use Node 22+ and Python 3. The pinned browser dependency is Playwright 1.56.1.

```sh
npm ci
npx playwright install chromium
npm test
npm run validate:apk
```

On a fresh Linux host, install Chromium system dependencies when needed with
`npx playwright install --with-deps chromium`. The browser tests route the
appassets HTTPS origin to local files and block external network requests.
They never open USB/network devices. They create sample outputs under
`output/configuration/` and `output/app/fieldkit-validation.json`.

Model checks require no npm dependencies:

```sh
node --test tests/configuration-model.cjs
```

A plain `file://` or HTTP preview is not equivalent to the Android appassets
origin. Clipboard, crypto and navigation assumptions should be checked using
the provided browser harness or a deliberate secure local preview.

## Available Android packaging path

There is no recoverable native Gradle module in this repository. The provided
packager is an asset-only update to the exact compiled 0.3.0 baseline. It verifies
the baseline hash, replaces/adds assets, omits the retired Forge catalog, updates
manifest version 3/0.3.0 to 5/0.3.2, and preserves native code/resources.

Requirements: Python 3, Java, Android SDK Build Tools 35.0.0 (`zipalign`,
`apksigner` or its JAR), and the original trusted development signing keystore.
No SDK tools or private key are committed. Supply their paths locally.

```sh
python3 tmp/repackage_fieldkit.py
zipalign -f -p 4 build-private/fieldkit-unsigned.apk build-private/fieldkit-aligned.apk
apksigner sign --ks /secure/path/development.keystore --ks-key-alias androiddebugkey --out output/app/Prismo-Field-Kit-0.3.2-debug.apk build-private/fieldkit-aligned.apk
apksigner verify --verbose --print-certs output/app/Prismo-Field-Kit-0.3.2-debug.apk
zipalign -c -p 4 output/app/Prismo-Field-Kit-0.3.2-debug.apk
python3 tests/validate-package.py
```

Allow the signer to prompt for passwords or use a local secret mechanism. Do not
put private credentials in command history, source files or this repository.
The prior development key was saved separately outside the repository as
`TAK-Bridge-development-signing.keystore` (a prior Work file artifact). Recover
that file through the owner’s existing secure storage if it is needed. A new
key changes the signer and cannot update the installed app in place.

Trusted development certificate SHA-256:

```
2e127ebcae2cfa8e81e529327b98ea2758050120ce692001136413f0437413c9
```

The certificate fingerprint is public identity metadata, not the private key.
Recover/use the trusted keystore for continuity. Do not present a differently
signed build as the same installable update.

`aapt dump badging` should show `com.dronewukong.fieldtools`, versionCode 5,
versionName 0.3.2, minSdk 26 and targetSdk 35. For a later version, revise the
packager's explicit version fields, validator and filenames together. Do not
patch native DEX to manufacture missing USB/MAVLink features.

## Documentation assets

`tmp/pdfs/make_guides.py`, `human_copy.py`, `manifest.json`, `screens/` and
`sample-report.html` preserve the reviewed 0.3.1 guide sources. PDFs are under
`output/pdf/`. They contain 6 and 31 pages respectively and describe 20 tools.

The authoring script uses ReportLab 4.4.9 and DejaVu fonts under the usual Linux
font path. Install `requirements-docs.txt` when regenerating intentionally.
The screenshot capture script targets current assets; it would generate a
21-tool catalog. The guide generator intentionally checks its archived
20-tool manifest. Do not overwrite the archived source manifest as a casual test.

Before producing an updated guide, update copy/screenshot mapping/version
claims, follow the available PDF workflow, render every page and inspect layout,
arrows and labels. Merely copying the existing PDFs does not regenerate them.

## Migration validation

The migration changes browser test imports to normal `require('playwright')`,
provides a pinned root npm package/lockfile, and creates the packager's output
directory when needed. Runtime assets remain byte-identical to the delivered
0.3.2 APK. APK validation must continue to prove this.
