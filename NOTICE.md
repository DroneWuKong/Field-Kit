# Source and bundled runtime

This is the standalone Prismo Field Kit project, originally derived from the
Tools assets in DroneWuKong/MultiProtocol-UAS-TAK-Bridge. The original native
app is preserved as compiled APKs; its standalone source module is missing.

Leaflet, GeoTIFF.js, MGRS, Phosphor and Betaflight preset notices/licenses remain
in `source/assets/tools/vendor/`. That vendor README contains historical
provenance for the removed Forge catalog; the catalog itself is not shipped in
the current app. The original baseline APK is retained only as the packaging
input/history; the current 0.3.2 app has MafiaLRS removed.

APK signatures contain public certificates. Private signing keys and credentials
are intentionally outside this repository. Generated reports/screenshots here
use demonstration/practice data, not customer production records.
