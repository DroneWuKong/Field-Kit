# Field Kit Planner 0.5.1

This is a reconstruction of the documented 0.5.0 phone planner, built from the
source now in this repository. It is not the missing original 0.5.0 binary or
commit. The older Tools and Practice workflows remain available from **Tools**.

Download the APK from the Android button on the Prismo Apps site, or the
`android-v0.5.1` GitHub release. Android 8.0/API 26 or later and a current Android
System WebView are required. Allow installation from the browser used to download
the APK when Android asks.

## Installation identity

The launcher is **Field Kit Planner**, version 0.5.1, code 10. The package remains
`com.dronewukong.fieldtools.preview`, using the same development certificate as
0.3.3-preview.1. It can update that preview; it installs separately from the
original `com.dronewukong.fieldtools` app. The original signing key was not
available on GupB. Keep the original app and export data you want to transfer;
this build does not read its private storage or erase it.

Signer SHA-256:
`7778d1e7642e2554efd4cc7bf7dc04455abe957de779473939cd6f9048dc6fd0`.

The APK is 2,428,389 bytes. SHA-256:
`91c42c7980d2997a1c522e79b364f039ce14d54d72e93e5b18cc2990702f1253`.
The release includes the checksum and a package verification receipt. All 53
packaged assets match the source bytes.

## Plan on the phone

- Allow location to center the map; approximate permission is supported. A late
  fix does not move a map you have panned or edited. Phone location never changes
  mission home or the antenna. **Locate** requests another fix.
- Open **Route → New route**, set home and the antenna separately, then use
  **Add points on map** and **Done placing**. Tap a point to edit coordinates,
  altitude and home/AGL/AMSL reference. Antenna height has its own editor.
- Routes save after each successful edit. Up to 30 routes and 500 points per
  route are supported. Read-only imported missions stay read-only. Imported
  source commands, parameters, source documents and terrain references are kept.
- **Export plan** opens Android's document picker for Prismo JSON. Import the
  file into Horizon for terrain and coverage analysis. This phone planner stores
  drafts and assumptions, not terrain-aware coverage results.
- **Equipment** edits radio links, frequencies, gains, losses, required control
  link and margin. Save settings before saving a named reusable setup. Blank
  transmit power and sensitivity remain unknown. Edited values are assumptions.
- Saved/imported setups require review before applying. **Undo equipment change**
  restores the previous radio assumptions in the current session. Up to 50 setups
  can be retained. Route coordinates and terrain references stay with the plan.

## Maps and storage

Online street tiles cover the current view. A bundled Natural Earth overview
works without a network but contains no street detail. In **Offline maps**, import
a Protomaps-compatible vector or PNG/JPEG/WebP PMTiles archive up to 150 MB.
**Show area** selects and frames it. Imports persist in IndexedDB; the selected
map and last view are remembered. Keep the original archive as a backup and check
your intended area offline before leaving connectivity.

The reconstructed vector style shows land, water, roads, buildings, boundaries and
place labels. Local Noto glyph ranges 0–1023 cover Latin/Greek text; other scripts
are not bundled. It is not an exact restoration of the lost 0.5.0 style. Archive
bounds, zoom range and SHA-256 identify what you imported; the checksum does not
authenticate its source or prove every tile is correct. No bulk OSM downloader
is included.

Local save failures leave the previous data intact. If stored planner data cannot
be read, **Export saved data** retains the raw text for recovery; it is not silently
replaced. Existing Tools storage is separate. Clearing Android app data or
uninstalling can remove locally saved work.

## Source, build and evidence

`source/assets/mobile/` contains the planner; `app/` contains the Android shell.
Use JDK 17, Android SDK 35 and the pinned wrapper:

```sh
npm ci
npm test
./gradlew :app:assembleRelease :app:lintRelease
```

Align and sign the resulting unsigned release with the separate planner key;
do not commit private keys. `tests/validate-native-package.py` checks the signature,
signer, alignment, manifest and exact packaged assets. Versioned verification
receipts belong with release assets; historical receipts stay unchanged.

Software checks cover phone layouts at 360/393/800 px, route edits and export,
equipment apply/undo, saved-state reload, quota errors, corrupt data recovery,
late location, and a synthetic PMTiles map with local glyphs that reopens without
network tiles. The existing configuration and exchange suites also pass. Release
compilation and lint pass (0 errors, 7 warnings). These checks do not establish
physical-phone installation, Android permission-dialog behavior, native document
picker operation or real regional-map coverage. Physical configuration writes
remain disabled in both the native bridge and Practice frontend.
