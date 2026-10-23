import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .terrain import grid_requirements, register

TNM = "https://tnmaccess.nationalmap.gov/api/v1"
DATASETS = {
    "10m": "National Elevation Dataset (NED) 1/3 arc-second Current",
    "1m": "Digital Elevation Model (DEM) 1 meter",
}


def search(bounds, resolution="10m"):
    if resolution not in DATASETS:
        raise ValueError("Choose 10m or 1m terrain")
    items, offset = [], 0
    with httpx.Client(timeout=60, follow_redirects=False) as client:
        while True:
            r = client.get(
                TNM + "/products",
                params={
                    "datasets": DATASETS[resolution],
                    "bbox": ",".join(map(str, bounds)),
                    "max": 100,
                    "offset": offset,
                    "outputFormat": "JSON",
                },
            )
            r.raise_for_status()
            data = r.json()
            if data.get("errors"):
                raise ValueError(str(data["errors"]))
            page = data.get("items", [])
            items.extend(page)
            if len(items) >= data.get("total", 0) or not page:
                break
            offset += len(page)
            if len(items) >= 5000:
                raise ValueError("Select a smaller area; catalog exceeds 5,000 products")
    return [
        {
            k: i.get(k)
            for k in (
                "sourceId",
                "title",
                "publicationDate",
                "lastUpdated",
                "sizeInBytes",
                "format",
                "downloadURL",
                "downloadURLRaster",
                "boundingBox",
                "datasets",
            )
        }
        for i in items
        if "tif" in (i.get("format") or "").lower()
    ]


def download(url, destination, tick=lambda: None, progress=lambda n: None, allowed_host=None):
    u = urlparse(url)
    host = u.hostname or ""
    if u.scheme != "https" or (allowed_host and host != allowed_host):
        raise ValueError("Download must use the expected HTTPS source")
    if not allowed_host and host not in {"prd-tnm.s3.amazonaws.com", "rockyweb.usgs.gov"}:
        raise ValueError("Only official USGS product downloads are accepted")
    dest = Path(destination)
    partial = dest.with_suffix(dest.suffix + ".part")
    validator_file = dest.with_suffix(dest.suffix + ".etag")
    for attempt in range(3):
        tick()
        offset = partial.stat().st_size if partial.exists() else 0
        validator = validator_file.read_text() if validator_file.exists() else ""
        # Resume only when the origin can prove the partial object is unchanged.
        if not validator:
            offset = 0
        headers = {"Range": f"bytes={offset}-", "If-Range": validator} if offset else {}
        try:
            with httpx.stream("GET", url, headers=headers, timeout=60, follow_redirects=False) as response:
                response.raise_for_status()
                append = (
                    offset > 0
                    and response.status_code == 206
                    and response.headers.get("Content-Range", "").startswith(f"bytes {offset}-")
                )
                if response.status_code == 206 and not append:
                    raise ValueError("Unexpected range response")
                received_validator = response.headers.get("ETag", "")
                if append and received_validator != validator:
                    raise ValueError("Product changed during resumed download; remove partial file and retry")
                validator_file.write_text(
                    received_validator if not received_validator.startswith("W/") else ""
                )
                size = offset if append else 0
                with partial.open("ab" if append else "wb") as f:
                    for block in response.iter_bytes(1024 * 1024):
                        tick()
                        size += len(block)
                        if size > 8 * 1024**3:
                            raise ValueError("Product exceeds 8 GiB; import it manually")
                        f.write(block)
                        progress(size)
            partial.replace(dest)
            return dest
        except (httpx.TransportError, httpx.HTTPStatusError):
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))


def download_products(store, products, datum, tick, progress):
    output = []
    for i, product in enumerate(products):
        tick()
        # Catalog identity is persisted; URL path is not used to classify currency.
        url = product.get("downloadURL") or product.get("downloadURLRaster")
        if not url:
            raise ValueError("Product has no download URL")
        from .storage import fingerprint

        path = store.root / "downloads" / (fingerprint(url) + ".tif")
        if not path.exists():
            download(url, path, tick, lambda n: progress(i, len(products), n))
        output.append(register(store, path, datum, product))
        progress(i + 1, len(products), 0)
    return output


def prepare_grids(store, ids, tick=lambda: None):
    downloaded = []
    for name, url in grid_requirements(store, ids).items():
        tick()
        download(url, store.root / "grids" / Path(name).name, tick, allowed_host="cdn.proj.org")
        downloaded.append(name)
    # A second pass verifies that the requested operation is actually usable.
    remaining = grid_requirements(store, ids)
    return {"downloaded": downloaded, "remaining": list(remaining)}
