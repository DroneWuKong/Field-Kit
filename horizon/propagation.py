"""P.525 free space and P.526-16 sections 3.1.1, 3.2 and 4.5.

Independent transcription of the published equations. Profile distances/heights
are metres; practical-unit formulae explicitly convert distance/radius to km.
Returns diffraction *in addition to* free space. No ITM loss is added.
"""

import math

import numpy as np

C = 299792458.0
EARTH_M = 6371000.0
MODEL_VERSION = "p525-p526-16-complete-v1"


def fspl(distance_m: float, frequency_mhz: float) -> float:
    if distance_m <= 0 or frequency_mhz <= 0:
        raise ValueError("Distance and frequency must be positive")
    return 20 * math.log10(4 * math.pi * distance_m * frequency_mhz * 1e6 / C)


def horizon_m(h1: float, h2: float, k: float = 4 / 3) -> float:
    return math.sqrt(2 * EARTH_M * k) * (math.sqrt(h1) + math.sqrt(h2))


def knife_edge(v: float) -> float:
    return 0.0 if v <= -0.78 else 6.9 + 20 * math.asinh(v - 0.1) / math.log(10)


def spherical_first(d_m, h1, h2, f_mhz, radius_m, polarization="vertical", epsilon=15, sigma=0.005):
    """P.526 equations 11a–18b; loss, not field strength."""
    a, d = radius_m / 1000, d_m / 1000
    kh = 0.36 * (a * f_mhz) ** (-1 / 3) * ((epsilon - 1) ** 2 + (18000 * sigma / f_mhz) ** 2) ** (-0.25)
    admittance = (
        kh * math.sqrt(epsilon**2 + (18000 * sigma / f_mhz) ** 2) if polarization == "vertical" else kh
    )
    beta = (1 + 1.6 * admittance**2 + 0.67 * admittance**4) / (1 + 4.5 * admittance**2 + 1.53 * admittance**4)
    x = 2.188 * beta * f_mhz ** (1 / 3) * a ** (-2 / 3) * d
    fx = 11 + 10 * math.log10(x) - 17.6 * x if x >= 1.6 else -20 * math.log10(x) - 5.6488 * x**1.425

    def gain(h):
        y = 9.575e-3 * beta * f_mhz ** (2 / 3) * a ** (-1 / 3) * h
        b = beta * y
        gy = (
            17.6 * math.sqrt(b - 1.1) - 5 * math.log10(b - 1.1) - 8
            if b > 2
            else 20 * math.log10(max(b + 0.1 * b**3, 1e-100))
        )
        return max(gy, 2 + 20 * math.log10(admittance))

    return -(fx + gain(h1) + gain(h2))


def spherical_loss(d_m, h1, h2, f_mhz, radius_m, polarization="vertical", epsilon=15, sigma=0.005):
    """P.526 equations 21–25, including sub-horizon interpolation."""
    h1, h2 = max(h1, 1e-6), max(h2, 1e-6)
    dlos = math.sqrt(2 * radius_m) * (math.sqrt(h1) + math.sqrt(h2))
    args = (polarization, epsilon, sigma)
    if d_m >= dlos:
        return max(0.0, spherical_first(d_m, h1, h2, f_mhz, radius_m, *args))
    c = (h1 - h2) / (h1 + h2)
    m = d_m**2 / (4 * radius_m * (h1 + h2))
    acos_arg = np.clip(1.5 * c * math.sqrt(3 * m / (m + 1) ** 3), -1, 1)
    b = 2 * math.sqrt((m + 1) / (3 * m)) * math.cos(math.pi / 3 + math.acos(acos_arg) / 3)
    d1 = np.clip(d_m / 2 * (1 + b), 1e-9, d_m - 1e-9)
    d2 = d_m - d1
    clearance = ((h1 - d1**2 / (2 * radius_m)) * d2 + (h2 - d2**2 / (2 * radius_m)) * d1) / d_m
    required = 0.552 * math.sqrt(d1 * d2 * (C / (f_mhz * 1e6)) / d_m)
    if clearance >= required:
        return 0.0
    marginal_radius = 0.5 * (d_m / (math.sqrt(h1) + math.sqrt(h2))) ** 2
    ah = spherical_first(d_m, h1, h2, f_mhz, marginal_radius, *args)
    return max(0.0, (1 - clearance / required) * ah)


def bullington(distances_m, terrain_m, tx_m, rx_m, wavelength_m, radius_m):
    """P.526 equations 49–57. Endpoints excluded from the obstruction search."""
    x = np.asarray(distances_m)[1:-1] / 1000
    h = np.asarray(terrain_m)[1:-1]
    d = distances_m[-1] / 1000
    ce = 1000 / radius_m
    curved = h + 500 * ce * x * (d - x)
    stim = float(np.max((curved - tx_m) / x))
    straight = (rx_m - tx_m) / d
    if stim < straight:
        v = float(
            np.max(
                (curved - (tx_m * (d - x) + rx_m * x) / d) * np.sqrt(0.002 * d / (wavelength_m * x * (d - x)))
            )
        )
    else:
        srm = float(np.max((curved - rx_m) / (d - x)))
        db = (rx_m - tx_m + srm * d) / (stim + srm)
        db = np.clip(db, 1e-12, d - 1e-12)
        v = (tx_m + stim * db - (tx_m * (d - db) + rx_m * db) / d) * math.sqrt(
            0.002 * d / (wavelength_m * db * (d - db))
        )
    luc = knife_edge(v)
    return luc + (1 - math.exp(-luc / 6)) * (10 + 0.02 * d)


def diffraction(
    distances_m,
    terrain_m,
    tx_m,
    rx_m,
    frequency_mhz,
    k=4 / 3,
    polarization="vertical",
    epsilon=15,
    sigma=0.005,
):
    """Complete delta-Bullington method: P.526 equations 58–66."""
    x, h = np.asarray(distances_m, dtype=float), np.asarray(terrain_m, dtype=float)
    if len(x) < 3 or len(x) != len(h) or x[0] != 0 or np.any(np.diff(x) <= 0):
        raise ValueError("Need at least three increasing profile points starting at zero")
    if not np.all(np.isfinite(h)) or not np.all(np.isfinite(x)):
        raise ValueError("Cannot propagate across missing terrain")
    if tx_m <= h[0] or rx_m <= h[-1]:
        raise ValueError("Both antennas must be above the sampled ground")
    d = x[-1]
    radius = EARTH_M * k
    wavelength = C / (frequency_mhz * 1e6)
    actual = bullington(x, h, tx_m, rx_m, wavelength, radius)
    v1 = np.sum(np.diff(x) * (h[1:] + h[:-1]))
    v2 = np.sum(np.diff(x) * (h[1:] * (2 * x[1:] + x[:-1]) + h[:-1] * (x[1:] + 2 * x[:-1])))
    hstip = (2 * v1 * d - v2) / d**2
    hsrip = (v2 - v1 * d) / d**2
    obstruction = h[1:-1] - (tx_m * (d - x[1:-1]) + rx_m * x[1:-1]) / d
    hobs = float(np.max(obstruction))
    if hobs > 0:
        at = float(np.max(obstruction / x[1:-1]))
        ar = float(np.max(obstruction / (d - x[1:-1])))
        hstip -= hobs * at / (at + ar)
        hsrip -= hobs * ar / (at + ar)
    ht = tx_m - min(hstip, h[0])
    hr = rx_m - min(hsrip, h[-1])
    smooth = bullington(x, np.zeros_like(h), ht, hr, wavelength, radius)
    sphere = spherical_loss(d, ht, hr, frequency_mhz, radius, polarization, epsilon, sigma)
    return float(max(0.0, actual + max(sphere - smooth, 0)))


def clearance(distances_m, terrain_m, tx_m, rx_m, frequency_mhz, k=4 / 3):
    x = np.asarray(distances_m, dtype=float)
    d = x[-1]
    line = tx_m + (rx_m - tx_m) * x / d
    bulge = x * (d - x) / (2 * EARTH_M * k)
    # Fresnel radius perpendicular to the sloping ray; use slant path lengths.
    slant = math.hypot(d, rx_m - tx_m)
    f1 = np.sqrt((C / (frequency_mhz * 1e6)) * (x / d) * (1 - x / d) * slant)
    normal_clearance = (line - np.asarray(terrain_m) - bulge) * d / slant
    fractions = normal_clearance[1:-1] / f1[1:-1]
    worst = int(np.argmin(fractions)) + 1
    return {
        "fraction": float(fractions[worst - 1]),
        "obstruction_m": float(x[worst]),
        "clearance_m": float(normal_clearance[worst]),
        "los": bool(np.all(normal_clearance > 0)),
        "line": line,
        "bulge": bulge,
        "fresnel": f1,
    }
