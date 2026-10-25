# Release and source status

## 25 October 2026: reproducible Android preview

[Field Kit Preview 0.3.3-preview.1](ANDROID_PREVIEW.md) builds the available 0.3.3
assets using the recovered native shell. Its separate package ID is
`com.dronewukong.fieldtools.preview`, version code 6, signed with the preview
development certificate documented in that guide. It installs beside the original
Field Kit and does not migrate its private data. The missing 0.5.0 planner source
and original signing key were unavailable on GupB. This preview does not recover
that implementation or supersede its feature set. The records below describe
the earlier deliveries and source recovery gap.

Checked **24 October 2026**. A delivered binary, a source branch, a passing browser
test and a published native package are different records.

## Available versions

| Item | Version | What is available |
| --- | --- | --- |
| Delivered Android planner | 0.5.0 / code 9 | Signed APK supplied directly to the owner; [installation guide](ANDROID.md); no public download yet |
| Published Windows planner | Horizon 0.2.0 | [Portable x64 release](https://github.com/DroneWuKong/Field-Kit/releases/tag/horizon-v0.2.0-windows), with native Windows qualification |
| Desktop source on `main` | Horizon 0.2.0 | `apps/horizon/horizon/__init__.py` and the Windows workflow still target 0.2.0 |
| Android assets on `main` | 0.3.3 / code 6 | Asset-update source and unsigned packaging path; not the delivered 0.5.0 app |
| Native development branch | 0.4.2 / code 8 | Gradle module on `codex/fieldkit-live-config`; not merged into `main` |
| Historical APK in `output/app/` | 0.3.2 | Preserved prior build, not the latest Android delivery |
| Earlier PDF guides | 0.3.1 workflow | Historical screenshots/instructions; not a guide to the new phone planner |

The repository source was checked at
[`a2e0aeba4f353b5c43af0ef8fad0c6d76a46fa90`](https://github.com/DroneWuKong/Field-Kit/commit/a2e0aeba4f353b5c43af0ef8fad0c6d76a46fa90).
The native branch’s `app/build.gradle.kts` declares 0.4.2/code 8. `main` has no
0.5.0 Gradle module or mobile planner source.

## Android 0.5.0 artifact

- Filename: `Prismo-Field-Kit-0.5.0.apk`
- Package: `com.dronewukong.fieldtools`
- Version: `0.5.0`, version code `9`
- Minimum Android: API 26; target SDK: 35
- Size: **4,385,709 bytes**
- APK SHA-256: `8c0cbe38ae2453508fe52493ad65926220109d2cf63c732af0e65029a1cf1eeb`
- Signing certificate SHA-256: `2e127ebcae2cfa8e81e529327b98ea2758050120ce692001136413f0437413c9`
- Signing type: original development key; no private key is in this repository.

The recorded checks passed Android compilation, trusted certificate verification,
ZIP alignment and byte comparison of all 42 packaged assets. Browser checks used
360/393/800 px and a software native-location peer, plus real PMTiles rendering,
local fonts, persistence and failed-storage recovery. No physical Android or
emulator installation was performed. These are prior build-session results;
the current documentation change does not rerun or replace them.

## Unpublished implementation and recovery

The prior session recorded these local commits on `codex/desktop-startup-maps`:

| Local commit | Recorded work |
| --- | --- |
| `5317301` | Automatic startup location/street maps, remembered view, offline world overview, deferred engine imports |
| `9292961` | Horizon 0.3.0 regional offline areas, local vector style/font, saved equipment setups and observation overlays |
| `8ffe158` | Android 0.5.0 native app and local phone planner |

They were not pushed. The branch is absent from GitHub, and GitHub could not
resolve `8ffe158` during this check. Workspace maintenance removed the local
checkout. A file search found the delivered 0.5.0 APK, but no matching source
archive. The APK remains available; its compiled assets are not a substitute for
the complete editable source, tests or Git history.

The 0.5.0 build reused native Java modules from the existing development branch,
then added the phone planner and retained `LIVE_CONFIG_WRITE_GATE=false`.
That does not make the entire 0.4.2 connected-configuration branch part of 0.5.0.

Horizon 0.3.0 was tested locally before cleanup: 80 Python tests, 14 browser tests,
root Field Kit regressions, TypeScript/Vite, Ruff and contract checks passed.
A real regional PMTiles preparation and checksum verification also passed.
No native 0.3.0 Windows executable was built. The current published ZIP remains
0.2.0 and does not contain those changes.

## Next release work

1. Recover the unpublished source from a retained checkout/backup if available;
   otherwise reconstruct it against the recorded behavior and retained APK.
2. Preserve the original signing identity and legacy storage. Recreate regression
   checks; distinguish reconstruction from recovery of the exact original commit.
3. Publish the restored source and rerun software checks before claiming it is
   reproducible from this repository.
4. Build and qualify Horizon 0.3.0 on an actual Windows runner. Publish a new
   versioned package only after those checks pass; retain the 0.2.0 release.
5. Perform and record Android installation/location/file-picker/offline checks on
   a physical phone. Keep hardware configuration testing a separate evidence set.

The current request updates documentation only. It does not publish the missing
application source, run the Windows build, merge the native configuration branch,
or turn on physical configuration writes.
