"""Fetch checksum-pinned starter grids; other operating areas use region preparation."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
manifest = json.loads(Path(__file__).with_name("grids.json").read_text())
for entry in manifest:
    path = destination / entry["name"]
    if not path.exists():
        with urllib.request.urlopen(entry["source"], timeout=60) as response:
            payload = response.read()
        if hashlib.sha256(payload).hexdigest() != entry["sha256"]:
            raise SystemExit("Grid checksum mismatch: " + entry["name"])
        path.write_bytes(payload)
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
        raise SystemExit("Grid checksum mismatch: " + entry["name"])
print(f"Verified {len(manifest)} starter grids in {destination}")
