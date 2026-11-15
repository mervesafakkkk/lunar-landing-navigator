#!/usr/bin/env python3
"""
Build terrain horizon masks from NASA LOLA polar elevation data (PDS3 GDR IMG).

Input  : LDEM_75S_240M.IMG from the PDS Geosciences Node
         https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
         (16-bit LSB integers, height = DN * 0.5 m above a 1737.4 km sphere,
          polar stereographic, Mean Earth/polar axis frame, 240 m/pixel, 3812 x 3812)
Outputs: src/data/lola-masks.json          horizon masks for the curated south-polar sites
         public/terrain/ldem_75s_480m.bin  2x2-averaged DEM (int16, 0.5 m units) for in-browser
                                           horizon computation at custom sites
         (optional) --site LAT LON -o file.csv   a single mask as azimuth_deg,elevation_deg

Orientation: the PDS catalog (DSMAP_POLAR.CAT) gives inconsistent signs for the
east-west axis. It was resolved empirically: with the convention below, gazetteer crater
centres (Shackleton, de Gerlache, Shoemaker, Malapert, Cabeus) all fall 0.9-3.5 km below
their surroundings. With the opposite sign they do not.
Only numpy is required:  python tools/lola_masks.py path/to/ldem_75s_240m.img
"""
import argparse
import json
import math
import re
from pathlib import Path

import numpy as np

R = 1737400.0
N = 3812
SCALE = 240.0
OBS_HEIGHT_M = 2.0   # observer (e.g. solar array / antenna) height above the terrain
MAX_RANGE_M = 200e3  # a 5 km peak drops below the geometric horizon beyond ~130 km
ROOT = Path(__file__).resolve().parent.parent


def to_pixel(lat, lon, n=N, scale=SCALE):
    """Planetocentric lat/lon (deg, south pole map) -> fractional (row, col), 0-based."""
    rho = 2 * R * np.tan(np.radians(90 + np.asarray(lat)) / 2)
    lo = np.radians(lon)
    col = rho * np.sin(lo) / scale + n / 2 - 0.5
    row = -rho * np.cos(lo) / scale + n / 2 - 0.5
    return row, col


def bilinear(dem, row, col):
    n = dem.shape[0]
    r0 = np.floor(row).astype(int)
    c0 = np.floor(col).astype(int)
    ok = (r0 >= 0) & (c0 >= 0) & (r0 < n - 1) & (c0 < n - 1)
    out = np.full(np.shape(row), np.nan)
    fr, fc, r, c = row[ok] - r0[ok], col[ok] - c0[ok], r0[ok], c0[ok]
    out[ok] = (dem[r, c] * (1 - fr) * (1 - fc) + dem[r, c + 1] * (1 - fr) * fc
               + dem[r + 1, c] * fr * (1 - fc) + dem[r + 1, c + 1] * fr * fc)
    return out


def destination(lat0, lon0, az_deg, dist_m):
    p1, l1, a = math.radians(lat0), math.radians(lon0), np.radians(az_deg)[:, None]
    d = (np.asarray(dist_m) / R)[None, :]
    p2 = np.arcsin(np.sin(p1) * np.cos(d) + np.cos(p1) * np.sin(d) * np.cos(a))
    l2 = l1 + np.arctan2(np.sin(a) * np.sin(d) * np.cos(p1), np.cos(d) - np.sin(p1) * np.sin(p2))
    return np.degrees(p2), np.degrees(l2)


def horizon_mask(dem, lat, lon, n=N, scale=SCALE, step=None):
    """Max terrain elevation angle (deg) for azimuths 0..359 (from north through east)."""
    step = step or scale / 2
    dists = np.arange(step, MAX_RANGE_M + step, step)
    az = np.arange(360.0)
    r0, c0 = to_pixel(np.array([lat]), np.array([lon]), n, scale)
    h0 = float(bilinear(dem, r0, c0)[0])
    if math.isnan(h0):
        raise ValueError(f'site {lat},{lon} outside DEM')
    ho = h0 + OBS_HEIGHT_M
    la, lo = destination(lat, lon, az, dists)
    rr, cc = to_pixel(la, lo, n, scale)
    ht = bilinear(dem, rr, cc)
    theta = dists[None, :] / R
    el = np.degrees(np.arctan2((R + ht) * np.cos(theta) - (R + ho), (R + ht) * np.sin(theta)))
    covered = np.isfinite(ht).mean()
    with np.errstate(all='ignore'):
        mask = np.nanmax(np.where(np.isfinite(el), el, -90.0), axis=1)
    return mask, h0, covered


def curated_sites():
    """Read predefined sites straight from src/lib/sites.ts so the two never drift apart."""
    text = (ROOT / 'src/lib/sites.ts').read_text(encoding='utf-8')
    return [(m[0], float(m[1]), float(m[2])) for m in
            re.findall(r"id: '([\w-]+)', name: '[^']*', lat: (-?[\d.]+), lon: (-?[\d.]+)", text)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('img', help='ldem_75s_240m.img')
    ap.add_argument('--site', nargs=2, type=float, metavar=('LAT', 'LON'))
    ap.add_argument('-o', '--out')
    a = ap.parse_args()
    dem = np.fromfile(a.img, dtype='<i2').reshape(N, N).astype(np.float64) * 0.5

    if a.site:
        mask, h0, cov = horizon_mask(dem, *a.site)
        out = a.out or 'horizon_mask.csv'
        with open(out, 'w') as f:
            f.write(f'# LOLA-derived horizon (LDEM_75S_240M); lat={a.site[0]} lon={a.site[1]}; '
                    f'site height {h0:.0f} m; observer +{OBS_HEIGHT_M} m; DEM coverage {cov:.0%}\n')
            f.write('azimuth_deg,elevation_deg\n')
            f.writelines(f'{i},{v:.3f}\n' for i, v in enumerate(mask))
        print('wrote', out)
        return

    masks = {}
    for sid, lat, lon in curated_sites():
        if lat > -76:
            print(f'{sid:16s} outside LOLA 75S coverage -> skipped')
            continue
        mask, h0, cov = horizon_mask(dem, lat, lon)
        masks[sid] = {'lat': lat, 'lon': lon, 'siteHeightM': round(h0, 1), 'coverage': round(float(cov), 3),
                      'elev': [round(float(v), 3) for v in mask]}
        print(f'{sid:16s} h={h0:7.0f} m  horizon min/mean/max {mask.min():5.2f}/{mask.mean():5.2f}/{mask.max():5.2f} deg  coverage {cov:.0%}')

    meta = {'product': 'LRO LOLA GDR LDEM_75S_240M (PDS3, V2.0)', 'resolutionM': SCALE,
            'observerHeightM': OBS_HEIGHT_M, 'maxRangeKm': MAX_RANGE_M / 1000,
            'source': 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/'}
    out = ROOT / 'src/data/lola-masks.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({'meta': meta, 'masks': masks}))
    print('wrote', out)

    # 2x2 block average -> 1906 x 1906 int16 (0.5 m units) for the browser
    raw = np.fromfile(a.img, dtype='<i2').reshape(N, N).astype(np.float32)
    small = raw.reshape(N // 2, 2, N // 2, 2).mean(axis=(1, 3))
    bin_out = ROOT / 'public/terrain/ldem_75s_480m.bin'
    bin_out.parent.mkdir(parents=True, exist_ok=True)
    np.round(small).astype('<i2').tofile(bin_out)
    print('wrote', bin_out, small.shape)


if __name__ == '__main__':
    main()
