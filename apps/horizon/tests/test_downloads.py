from contextlib import contextmanager

import httpx
import pytest

from horizon.catalog import download


def test_resume_requires_matching_etag(tmp_path, monkeypatch):
    dest = tmp_path / "product.tif"
    dest.with_suffix(".tif.part").write_bytes(b"abc")
    dest.with_suffix(".tif.etag").write_text('"v1"')

    @contextmanager
    def stream(method, url, **kwargs):
        assert kwargs["headers"] == {"Range": "bytes=3-", "If-Range": '"v1"'}
        yield httpx.Response(
            206,
            headers={"ETag": '"v1"', "Content-Range": "bytes 3-5/6"},
            content=b"def",
            request=httpx.Request(method, url),
        )

    monkeypatch.setattr(httpx, "stream", stream)
    download("https://prd-tnm.s3.amazonaws.com/test.tif", dest)
    assert dest.read_bytes() == b"abcdef"


def test_changed_object_restarts_from_full_response(tmp_path, monkeypatch):
    dest = tmp_path / "product.tif"
    dest.with_suffix(".tif.part").write_bytes(b"old")
    dest.with_suffix(".tif.etag").write_text('"v1"')

    @contextmanager
    def stream(method, url, **kwargs):
        yield httpx.Response(
            200, headers={"ETag": '"v2"'}, content=b"new product", request=httpx.Request(method, url)
        )

    monkeypatch.setattr(httpx, "stream", stream)
    download("https://prd-tnm.s3.amazonaws.com/test.tif", dest)
    assert dest.read_bytes() == b"new product"


def test_unvalidated_partial_is_not_resumed(tmp_path, monkeypatch):
    dest = tmp_path / "product.tif"
    dest.with_suffix(".tif.part").write_bytes(b"old")

    @contextmanager
    def stream(method, url, **kwargs):
        assert kwargs["headers"] == {}
        yield httpx.Response(200, content=b"full", request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, "stream", stream)
    download("https://prd-tnm.s3.amazonaws.com/test.tif", dest)
    assert dest.read_bytes() == b"full"
    with pytest.raises(ValueError, match="official"):
        download("https://unrelated.example/test.tif", dest)
