# Field Kit Android 0.5.0

This is the historical 0.5.0 guide. For the current reconstructed build, use
[Field Kit Planner 0.5.1](ANDROID_PLANNER.md), including its separate install identity.

`Prismo-Field-Kit-0.5.0.apk` (4.4 MB) is the signed development build supplied
directly to the project owner. There is no public GitHub download for this version
yet; use the APK attachment supplied with the build. It supports Android 8.0/API 26
or later with an up-to-date Android System WebView.

## Install or update

1. Export any important existing routes, equipment and records before updating.
2. Download `Prismo-Field-Kit-0.5.0.apk` on the phone and open it.
3. If Android asks, allow installation from the browser/file app used to open
   this APK, then continue with Install or Update.
4. Open **Prismo Field Kit**. Allow location to center the map automatically.
   Approximate location is supported; the displayed accuracy describes the fix.

The package is `com.dronewukong.fieldtools`, version code **9**. It uses the
original development signing certificate, so its identity is compatible with
updates to older builds signed by that key. On-device update behavior has not
been tested here. If Android reports a signature conflict, verify the installed
package and signer before doing anything that could remove its saved data.

## Map and location

The opening screen is the map. Online street tiles load for the visible area.
A bundled Natural Earth world overview supplies country borders and lakes when
detailed maps are unavailable. It is not an offline street map.

Use the location-arrow button to request a fresh fix. A denied permission or
unavailable fix leaves the previous map area usable. A late fix does not recenter
a map after you have panned or edited it. Your phone location is a separate marker;
it does not silently change mission home or the ground antenna position.

## Create a route

1. Open **Route**, create or select a saved route, and give it a useful name.
2. Choose **Set home** and place the planned launch/home point on the map.
3. Choose **Ground antenna**, place it separately, and enter antenna height.
4. Choose **Add points on map**. Tap to add waypoints, then choose **Done**.
5. Select a waypoint to edit coordinates, altitude and altitude reference:
   above home, above terrain (AGL), or sea level (AMSL).
6. Choose **Export plan** and select a destination in Android’s document picker.

The phone supports up to 30 saved routes and 500 waypoints per route. Imported
read-only missions remain read-only. Source command parameters and terrain
references travel with imported plans; terrain files themselves do not.

Routes are drafts. The phone planner does not calculate Horizon’s terrain-aware
coverage, Fresnel clearance or altitude suggestions. Import the exported Prismo
JSON in desktop Horizon and prepare the required terrain before analysis.

## Reuse equipment

Open **Equipment**, review radio frequencies, transmit power, receiver sensitivity,
antenna gains and losses, and set the required control link and planning margin.
Blank power/sensitivity fields remain unknown; entering values marks them assumed.

Give the setup a name and choose **Save reusable setup**. On another route, choose
**Review & apply** before replacing radio assumptions and analysis settings.
The route, home and terrain references stay with the plan. **Undo equipment
change** restores the previous equipment assumptions. Up to 50 setups are stored.

Prismo equipment JSON can also be imported through a review. Imported claims are
not hardware measurements. The original Field Kit equipment and records remain
available through **Tools**.

## Take detailed maps offline

1. Obtain a regional `.pmtiles` archive from a source whose data and license you
   can identify. Supported formats are Protomaps vector basemaps or raster
   PNG/JPEG/WebP PMTiles, up to 150 MB per archive.
2. Transfer the file to the phone, open **Offline**, and choose **Import offline map**.
3. After the save completes, choose **Show area** or select it under **Map source**.
4. Before leaving connectivity, reopen the app with the network disabled and
   check that the detail you need is present at the intended location and zoom.

The published Windows 0.2.0 ZIP does not include the regional-map preparation or
**Save map for Android** action developed for 0.3.0. Until that source is restored
and the new Windows build is available, import a compatible archive you already
have. An imported basemap does not add elevation or radio coverage predictions.

Map files persist in IndexedDB and show their size, bounds/detail and SHA-256
fingerprint. The fingerprint identifies the imported bytes; it does not authenticate
who supplied them or prove every tile is intact. Ordinary OSM street tiles are
not bulk downloaded. Keep the original archive separately as a backup.

## Records, exports and configuration practice

Changes are stored locally before the planner reports success. Export JSON to
move plans between devices; there is no automatic phone/desktop synchronization.
Do not point the phone at the computer’s `127.0.0.1` address: that address always
refers to the device opening it.

**Tools** opens the existing calculators, equipment, diagnostic records and
configuration practice. The 0.5.0 planner build keeps physical configuration
writes disabled. It does not incorporate the connected-deployment web UI from
the separate 0.4.2 native development branch. Existing quick RF tools retain their
own simplified model descriptions; they are not the desktop terrain engine.

## Troubleshooting

| Symptom | Next check |
| --- | --- |
| Map stays at the previous area | Enable Android location and this app’s permission, then tap the location arrow. Manual planning still works. |
| Only country outlines appear | Online street tiles are unavailable or world overview is selected. Select/import a detailed offline map. |
| Offline region has no nearby detail | Check the file’s geographic bounds and maximum zoom; import the intended region. |
| A save fails | Free storage or export/remove an old route or map. A failed write is not reported as saved. |
| Saved workspace is unreadable | Use **Export saved data** to retain the raw content before repair. The planner does not silently overwrite it. |
| Route has no coverage result | Export to Horizon and analyze there. The phone planner stores drafts and assumptions. |
| APK will not update | Check package, version code and certificate; do not clear app data as an initial fix. |

Uninstalling the app or clearing Android app data can remove routes, setups,
records and offline maps. Preserve exported files and original map archives.

## Build identity and verification

See [release/source status](RELEASE_STATUS.md) for the exact APK hash and signer.
The build passed Android compilation, signature/alignment checks and comparison
of all 42 packaged app assets. Phone browser scenarios passed at 360, 393 and
800 px, including a real vector map, local fonts, restart without network tile
requests, route/plan exchange, setup apply/undo, failed saves and data recovery.
Those results were recorded during the build; they are not a physical-phone or
emulator installation test.

The exact 0.5.0 source checkout was not published and was removed by workspace
maintenance. `main` cannot currently reproduce this APK. Do not use the legacy
asset repackager or the 0.4.2 branch and label its output 0.5.0. Source recovery
and a fresh build/validation are required first.
