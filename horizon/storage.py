import hashlib
import json
import os
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def fingerprint(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, root=None):
        self.root = Path(root or os.environ.get("HORIZON_DATA", "data")).resolve()
        for name in ("terrain", "grids", "results", "basemaps", "downloads"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        bundled = os.environ.get("HORIZON_BUNDLED_GRIDS")
        if bundled:
            for source in Path(bundled).glob("*.tif"):
                target = self.root / "grids" / source.name
                if not target.exists():
                    shutil.copyfile(source, target)
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute(
                "CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, payload TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY(kind,id))"
            )
            db.execute("PRAGMA user_version=1")

    def connect(self):
        return sqlite3.connect(self.root / "planner.sqlite", timeout=30)

    def put(self, kind, ident, value):
        with self.connect() as db:
            db.execute(
                "INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload,updated=excluded.updated",
                (kind, ident, canonical(value), now()),
            )

    def get(self, kind, ident):
        with self.connect() as db:
            row = db.execute("SELECT payload FROM records WHERE kind=? AND id=?", (kind, ident)).fetchone()
        if row is None:
            raise KeyError(ident)
        return json.loads(row[0])

    def list(self, kind):
        with self.connect() as db:
            rows = db.execute(
                "SELECT payload FROM records WHERE kind=? ORDER BY updated DESC", (kind,)
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def update_job(self, ident, **changes):
        # Read-modify-write in a transaction so progress cannot undo cancellation.
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT payload FROM records WHERE kind='job' AND id=?", (ident,)).fetchone()
            if row is None:
                return
            data = json.loads(row[0])
            if data.get("status") == "cancelled" and changes.get("status") != "cancelled":
                return
            data.update(changes)
            db.execute(
                "UPDATE records SET payload=?,updated=? WHERE kind='job' AND id=?",
                (canonical(data), now(), ident),
            )

    def atomic_json(self, relative, data):
        path = self.root / relative
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(canonical(data))
        tmp.replace(path)
        return path
