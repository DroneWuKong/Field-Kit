import math

import numpy as np
import pytest

from horizon.propagation import (
    EARTH_M,
    C,
    clearance,
    diffraction,
    fspl,
    horizon_m,
    knife_edge,
    spherical_loss,
)


def test_analytical_free_space_horizon_and_fresnel():
    assert fspl(10000, 915) == pytest.approx(111.676, abs=0.01)
    assert fspl(10000, 5800) - fspl(10000, 915) == pytest.approx(16.04, abs=0.02)
    assert horizon_m(10, 120) == pytest.approx(
        math.sqrt(2 * EARTH_M * 4 / 3) * (math.sqrt(10) + math.sqrt(120))
    )
    x = np.array([0, 5000, 10000])
    c = clearance(x, np.zeros(3), 100, 100, 915)
    assert c["fresnel"][1] == pytest.approx(math.sqrt(C / 915e6 * 2500))
    assert c["bulge"][1] == pytest.approx(1.471512, abs=1e-5)
    assert knife_edge(0) == pytest.approx(6.032853, abs=1e-5)


@pytest.mark.parametrize("frequency", [490, 915, 5800])
@pytest.mark.parametrize("distance", [1000, 10000, 50000, 100000])
@pytest.mark.parametrize("ridge", [0, 100])
def test_diffraction_against_independent_pycraf_delta_bullington(frequency, distance, ridge):
    """P.452 shares delta-Bullington with P.526; constants differ slightly.

    pycraf is test-only, with a separately implemented compiled reference.
    delta_N=39.25 sets k=4/3, land electrical properties epsilon=15, sigma=.005.
    """
    from astropy import units as u
    from pycraf import pathprof

    x = np.linspace(0, distance, 501)
    h = 100 + ridge * np.exp(-(((x / distance - 0.5) / 0.1) ** 2))
    pp = pathprof.PathProp(
        frequency / 1000 * u.GHz,
        290 * u.K,
        1013 * u.hPa,
        0 * u.deg,
        0 * u.deg,
        0.1 * u.deg,
        0 * u.deg,
        3 * u.m,
        60 * u.m,
        10 * u.m,
        50 * u.percent,
        delta_N=39.25 / u.km,
        N0=320 * u.dimensionless_unscaled,
        hprof_dists=x / 1000 * u.km,
        hprof_heights=h * u.m,
        hprof_bearing=90 * u.deg,
        hprof_backbearing=270 * u.deg,
        polarization=1,
    )
    expected = pathprof.loss_diffraction(pp)[0].value
    actual = diffraction(x, h, h[0] + 3, h[-1] + 60, frequency)
    assert actual == pytest.approx(expected, abs=0.03)


def test_multiple_ridges_reciprocity_and_height_response():
    x = np.linspace(0, 30000, 3001)
    h = 140 + 70 * np.exp(-(((x - 7000) / 1000) ** 2)) + 110 * np.exp(-(((x - 21000) / 800) ** 2))
    loss = diffraction(x, h, h[0] + 3, h[-1] + 60, 490)
    reverse = diffraction(x, h[::-1], h[-1] + 60, h[0] + 3, 490)
    assert loss == pytest.approx(reverse, abs=1e-8)
    assert diffraction(x, h, h[0] + 3, h[-1] + 400, 490) < loss


def test_missing_profile_and_endpoint_errors():
    with pytest.raises(ValueError, match="missing terrain"):
        diffraction([0, 500, 1000], [0, np.nan, 0], 10, 60, 915)
    with pytest.raises(ValueError, match="above"):
        diffraction([0, 500, 1000], [0, 0, 0], 0, 60, 915)
    with pytest.raises(ValueError):
        diffraction([0, 0, 1000], [0, 0, 0], 10, 60, 915)


def test_clear_smooth_path_no_diffraction_and_over_horizon_loss():
    assert spherical_loss(1000, 30, 100, 5800, EARTH_M * 4 / 3) == 0
    assert spherical_loss(100000, 3, 60, 915, EARTH_M * 4 / 3) > 50
