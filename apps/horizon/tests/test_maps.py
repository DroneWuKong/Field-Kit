import io

import numpy as np
from PIL import Image

from horizon.maps import display_range, tile


def test_palette_uses_shared_dataset_range_and_explicit_empty_state(store, raster_factory):
    assert not display_range(str(store.root), ())["available"]
    values = np.linspace(100, 400, 300 * 300, dtype="float32").reshape(300, 300)
    record = raster_factory(values)
    palette = display_range(str(store.root), (record["id"],))
    assert palette["available"]
    assert palette["low"] == 100 and palette["high"] == 400
    assert len(palette["colors"]) == 8
    image = np.asarray(Image.open(io.BytesIO(tile(str(store.root), (), 5, 8, 11))))
    assert image.shape == (256, 256, 4)
    assert not np.any(image[:, :, 3])
