# Bundled planner dependencies

- MapLibre GL JS 6.15.0: https://github.com/maplibre/maplibre-gl-js
  (BSD-3-Clause; vendor/maplibre-LICENSE.txt). Module, worker, shared module and CSS
  copied from the installed Horizon frontend dependency of that exact version.
- PMTiles JS 4.5.0: https://github.com/protomaps/PMTiles
  (BSD-3-Clause; vendor/pmtiles-LICENSE.txt).
- Natural Earth 1:110m countries and lakes: https://www.naturalearthdata.com/
  Public-domain GeoJSON from nvkelso/natural-earth-vector/geojson on GitHub.
  This is a world overview, not detailed navigation data.
- Noto Sans Regular glyphs, ranges 0–1023: protomaps/basemaps-assets/fonts on
  GitHub; SIL Open Font License in data/fonts/LICENSE.txt. Local labels cover
  these Latin/Greek ranges; other scripts are not bundled in this reconstruction.
- Online street tiles: https://tile.openstreetmap.org/ with OpenStreetMap
  attribution. Only the current viewport is requested; no bulk download feature.

Imported offline archives remain user-supplied data. Their SHA-256 values identify
the bytes and do not authenticate origin or qualify map accuracy.
