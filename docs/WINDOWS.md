# Windows desktop package

## Version available now

The published ZIP and current `main` build scripts target **Horizon 0.2.0**.
They do not contain the automatic startup-location/map changes, bundled world
map, regional offline-map preparation or reusable setup library developed for
0.3.0. That unpublished checkout was removed by workspace maintenance. Recovery
and a new build on Windows are required; no native 0.3.0 package is available yet.
See [release/source status](RELEASE_STATUS.md).

The [Android 0.5.0 guide](ANDROID.md) covers the delivered phone planner. JSON
plans and equipment can move between the phone and desktop, but basemap and
terrain files are separate. The published 0.2.0 ZIP does not offer the planned
**Save map for Android** action.

The Windows x64 package runs Horizon and Field Kit together as a local browser
workspace. It includes Python, the terrain libraries, both interfaces and the
three checksum-pinned starter datum grids. Docker, Node and a separate Python
installation are not needed on the user's PC.

## Run

1. [Download the Windows x64 ZIP](https://github.com/DroneWuKong/Field-Kit/releases/download/horizon-v0.2.0-windows/Prismo-Field-Kit-Horizon-0.2.0-windows-x64.zip) from the Field Kit release.
2. Extract the entire folder. Keep `PrismoFieldKit.exe` and `_internal` together.
3. Double-click `PrismoFieldKit.exe`; the planner opens in your default browser.
4. Keep the console window open. Press Ctrl+C to stop it.

The default address is `http://127.0.0.1:8765`. Data is separate from the program
under `%LOCALAPPDATA%\PrismoFieldKit\Horizon`. Back up that directory while the
planner is stopped. Extracting a newer program package does not replace data.
A second launch with the same data path reopens the running workspace.

Optional arguments:

```powershell
.\PrismoFieldKit.exe --port 8767
.\PrismoFieldKit.exe --data 'D:\Field data\Horizon'
.\PrismoFieldKit.exe --no-browser
```

The executable is unsigned; Windows may show a reputation warning. The archive
checksum, per-file checksums, source commit and Windows test receipt accompany
the package. This is the Field Kit/Horizon planning app, not a recovered version
of the historical Windows manufacturing tester.

Prepare terrain and any additional regional grids before offline use. Analysis
runs locally, including background route/coverage jobs. The same assumptions,
unknown radio inputs and limitations of the Linux planner apply. No physical
configuration-write capability is added by Windows packaging.

## Build and qualification

Build on Windows x64 with Python 3.12, Node 22 and Git installed:

```powershell
.\scripts\build-windows.ps1
```

The script installs the hash-pinned runtime dependencies, builds the frontend,
fetches checksum-pinned grids and runs PyInstaller 6.22.3. The portable one-folder
package preserves GDAL/PROJ assets; `multiprocessing.freeze_support()` runs before
application imports so frozen analysis workers start correctly.

The manually dispatched **Windows desktop package** GitHub workflow uses an
actual `windows-2022` runner. The executable test checks both interfaces, a
synthetic route through spawned workers, raster upload, an offline NAVD88→EGM96
transformation, cancellation, duplicate launch and persistence after restart.
The temporary data path includes spaces and non-ASCII characters. Passing this
software qualification does not establish Authenticode signing, physical radio
performance or testing on a particular user's Windows installation.

Artifacts are created only after executable checks pass. Download the ZIP and
its `.sha256` file from the successful workflow or the published release.
Historical Linux/Android receipts remain unchanged.

References: [PyInstaller platform builds](https://pyinstaller.org/en/stable/usage.html#supporting-multiple-operating-systems)
and [frozen multiprocessing](https://pyinstaller.org/en/stable/common-issues-and-pitfalls.html#multi-processing).

## Published build evidence

The first Windows ZIP was built from `cf3f5fbc358aa6b61f60fbc5eb65fd630c8b2268`
and passed [Windows workflow 39975617807](https://github.com/DroneWuKong/Field-Kit/actions/runs/39975617807).
It completed a 345-sample synthetic route with frozen workers, raster import,
offline NAVD88→EGM96 conversion, cancellation, duplicate launch and restart
persistence. Both interfaces were served. The test data directory contained
spaces and a non-ASCII character. All 737 files listed in the archive's checksum
manifest matched after download.

ZIP size: 83,373,145 bytes. SHA256:
`b5ca55b224eea716098fa6c9c795472022f79d9f50cb8b275c4069d17ad6adee`.
The package includes the machine-readable Windows receipt. It is unsigned and
has not been installed on the user's physical Windows PC. Earlier failed build
runs are retained: the asset path and Windows temporary-file compatibility issues
were fixed before the successful qualification.
