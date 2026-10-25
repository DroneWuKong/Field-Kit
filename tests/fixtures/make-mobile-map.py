"""Generate a tiny synthetic Protomaps-layer fixture; no real-world map claims.

Regeneration requires pmtiles and mapbox-vector-tile. The checked-in binary lets
the normal browser suite run without Python dependencies or external requests.
"""
from pathlib import Path
import mapbox_vector_tile
from pmtiles.writer import write
from pmtiles.tile import Compression, TileType

layers = [
    {"name": "earth", "features": [{"geometry": {"type": "Polygon", "coordinates": [[[0, 0], [4096, 0], [4096, 4096], [0, 4096], [0, 0]]]}, "properties": {}}]},
    {"name": "roads", "features": [{"geometry": {"type": "LineString", "coordinates": [[0, 2048], [4096, 2048]]}, "properties": {"name": "Test road"}}]},
    {"name": "places", "features": [{"geometry": {"type": "Point", "coordinates": [2048, 2048]}, "properties": {"name": "Offline test"}}]},
]
with write(str(Path(__file__).with_name("mobile-map.pmtiles"))) as writer:
    writer.write_tile(0, mapbox_vector_tile.encode(layers))
    writer.finalize({"tile_type": TileType.MVT, "tile_compression": Compression.NONE},
                    {"name": "Synthetic offline test", "vector_layers": [{"id": layer["name"]} for layer in layers]})
