# Field Kit Preview 0.3.3-preview.1

[Download the APK](https://github.com/DroneWuKong/Field-Kit/releases/download/android-v0.3.3-preview.1/Prismo-Field-Kit-0.3.3-preview.1.apk).

This is a new native build of the available Field Kit 0.3.3 assets. It includes
equipment and plan exchange with desktop Horizon, tools, checks, saved records,
and configuration Practice. It does not include the unavailable 0.5.0 map planner,
route editor, or regional PMTiles import. The 0.5.0 source has not been recovered.

## Installation and data

Open the APK on Android 8.0 or newer and allow installation from the file app or
browser when Android asks. Its launcher name is **Field Kit Preview** and its
package is `com.dronewukong.fieldtools.preview`.

The original signing key was unavailable on this host. This build uses a different
development certificate and a separate package ID, so it installs beside the
original Field Kit. Its data starts empty; it does not update, read, or migrate
the original app's private data. Keep your existing app installed and export any
records you want to transfer using its supported export actions.

Preview signing certificate SHA-256:

```text
7778d1e7642e2554efd4cc7bf7dc04455abe957de779473939cd6f9048dc6fd0
```

The release includes a checksum and verification receipt for the exact APK.
This development certificate is distinct from the original certificate documented
in `RELEASE_STATUS.md`.

Published artifact: **1,509,291 bytes**, SHA-256
`5b8cc1e334cc502b9b8efb64ed7312056415ff42870d6fb0a0bbdd3c7fb48eaf`.

Validation on 25 October 2026 passed the root `npm test` suite (35 model tests,
configuration browser workflows, retired-tool regression, exchange and planning
UI at three widths), native release compilation, and lint with 0 errors / 7
warnings. Warnings concern newer tooling/SDK/dependencies, backup configuration,
and the missing custom launcher icon. Signature, alignment, manifest identity,
non-debuggable release status, and all 34 packaged assets passed verification.
No physical-phone or emulator installation was performed.

## Source and build

The native shell comes from `codex/fieldkit-live-config` commit
`cd1603dfc2ce52ca1bbfde7ccf5d15d85339ff22`; the web assets come from `main`
commit `ab80f3cb338fb3571fafac4451f27f7c22f0a3c8`. The connected configuration
frontend was not imported. The existing web Practice gate remains disabled for
physical writes, and the native JavaScript write endpoint also rejects them.

The new Gradle wrapper pins 8.11.1 with its distribution checksum. Use JDK 17,
Android SDK platform 35, Build Tools 35.0.0, and set `ANDROID_HOME` to your SDK:

AGP remains 8.7.3; the lint analyzer is pinned to 8.13.2 to read the Kotlin 2.2
metadata in USB serial 3.11.0's dependencies.

```sh
npm ci
npm test
./gradlew :app:assembleRelease :app:lintRelease
```

The release build is unsigned until the owner signs it with the preview key.
Do not commit a keystore or passwords. With Build Tools on PATH:

```sh
zipalign -p 4 app/build/outputs/apk/release/app-release-unsigned.apk build-private/fieldkit-preview-aligned.apk
apksigner sign --ks /secure/path/preview.keystore --ks-key-alias androiddebugkey --out build-private/Prismo-Field-Kit-0.3.3-preview.1.apk build-private/fieldkit-preview-aligned.apk
python3 tests/validate-native-package.py build-private/Prismo-Field-Kit-0.3.3-preview.1.apk --build-tools "$ANDROID_HOME/build-tools/35.0.0" --certificate 7778d1e7642e2554efd4cc7bf7dc04455abe957de779473939cd6f9048dc6fd0
```

The native package validator checks signature, signer, alignment, package/version,
launcher, minimum/target Android, non-debuggable status, all packaged assets against
source, and the disabled web configuration gate. The legacy `validate:apk` script
applies only to asset-repacked historical builds.

Browser checks cover configuration models, failure handling, saved records,
equipment/plan exchange, and layouts at 360, 393, and 800 px. These checks and
Android compilation do not establish physical-phone or emulator installation.
