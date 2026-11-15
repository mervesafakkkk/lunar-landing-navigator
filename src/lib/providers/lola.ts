/**
 * NASA LOLA terrain horizons.
 *
 *  - Curated south-polar sites: masks precomputed by tools/lola_masks.py from the full-
 *    resolution LDEM_75S_240M product (PDS Geosciences Node), bundled as JSON.
 *  - Any other site south of ~76°S: computed in the browser from a 2×2-averaged copy of the
 *    same DEM (480 m/pixel, public/terrain/ldem_75s_480m.bin), loaded on first use.
 *
 * The algorithm is identical in both places: march along great circles every 1°, out to 200 km,
 * and keep the maximum terrain elevation angle including lunar curvature.
 */
import data from '../../data/lola-masks.json' with { type: 'json' };
import type { HorizonMask } from './types.ts';

export const LOLA_META = data.meta;
const R = 1737400;
const OBS_H = data.meta.observerHeightM;
const MAX_RANGE = data.meta.maxRangeKm * 1000;
export const LOLA_MIN_LAT = -76;

export interface Dem { n: number; scale: number; h: Int16Array }

const bundled = data.masks as Record<string, { lat: number; lon: number; siteHeightM: number; coverage: number; elev: number[] }>;

export function inLolaCoverage(lat: number) {
  return lat <= LOLA_MIN_LAT;
}

function makeMask(elev: ArrayLike<number>, label: string, source: string): HorizonMask {
  return { kind: 'lola', label, provenance: 'derived', source, elev: Float32Array.from(elev) };
}

/** Precomputed full-resolution mask for a curated site, if available. */
export function bundledMask(siteId: string, lat: number, lon: number): HorizonMask | null {
  const m = bundled[siteId];
  if (!m || Math.abs(m.lat - lat) > 1e-6 || Math.abs(m.lon - lon) > 1e-6) return null;
  return makeMask(m.elev, 'LOLA terrain (240 m)',
    `Horizon computed from ${data.meta.product}; observer ${OBS_H} m above terrain (site height ${m.siteHeightM.toFixed(0)} m).`);
}

let demPromise: Promise<Dem> | null = null;
export function loadDem(): Promise<Dem> {
  if (!demPromise) {
    demPromise = fetch(`${import.meta.env.BASE_URL}terrain/ldem_75s_480m.bin`)
      .then((r) => { if (!r.ok) throw new Error(`DEM HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((buf) => {
        const h = new Int16Array(buf);
        const n = Math.round(Math.sqrt(h.length));
        return { n, scale: 480, h };
      });
    demPromise.catch(() => { demPromise = null; });
  }
  return demPromise;
}

/** Polar-stereographic (south) projection of the LOLA GDR, 0-based fractional pixel. */
export function toPixel(dem: Dem, latDeg: number, lonDeg: number): [number, number] {
  const rho = 2 * R * Math.tan(((90 + latDeg) * Math.PI) / 360);
  const lo = (lonDeg * Math.PI) / 180;
  return [(-rho * Math.cos(lo)) / dem.scale + dem.n / 2 - 0.5, (rho * Math.sin(lo)) / dem.scale + dem.n / 2 - 0.5];
}

/** Height in metres (bilinear), NaN outside the grid. */
export function heightAt(dem: Dem, row: number, col: number) {
  const r = Math.floor(row), c = Math.floor(col);
  if (r < 0 || c < 0 || r >= dem.n - 1 || c >= dem.n - 1) return NaN;
  const fr = row - r, fc = col - c, i = r * dem.n + c, h = dem.h;
  return 0.5 * (h[i] * (1 - fr) * (1 - fc) + h[i + 1] * (1 - fr) * fc + h[i + dem.n] * fr * (1 - fc) + h[i + dem.n + 1] * fr * fc);
}

/** Horizon elevation (deg) for azimuths 0..359 in `azStep` increments (interpolated to 1°). */
export function computeMaskElev(dem: Dem, lat: number, lon: number, azStep = 1, stepM = dem.scale / 2): { elev: Float32Array; siteHeight: number } {
  const [r0, c0] = toPixel(dem, lat, lon);
  const h0 = heightAt(dem, r0, c0);
  if (Number.isNaN(h0)) throw new Error('Site outside LOLA DEM coverage');
  const ho = h0 + OBS_H;
  const step = stepM;
  const p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const sp1 = Math.sin(p1), cp1 = Math.cos(p1);
  const nAz = Math.round(360 / azStep);
  const coarse = new Float32Array(nAz);
  for (let k = 0; k < nAz; k++) {
    const a = (k * azStep * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a);
    let best = -90;
    for (let d = step; d <= MAX_RANGE; d += step) {
      const th = d / R, st = Math.sin(th), ct = Math.cos(th);
      const sp2 = sp1 * ct + cp1 * st * ca;
      const p2 = Math.asin(sp2);
      const l2 = l1 + Math.atan2(sa * st * cp1, ct - sp1 * sp2);
      const [rr, cc] = toPixel(dem, (p2 * 180) / Math.PI, (l2 * 180) / Math.PI);
      const ht = heightAt(dem, rr, cc);
      if (Number.isNaN(ht)) continue;
      const el = Math.atan2((R + ht) * ct - (R + ho), (R + ht) * st);
      if (el > best) best = el;
    }
    coarse[k] = (best * 180) / Math.PI;
  }
  const elev = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    const x = i / azStep, k = Math.floor(x), f = x - k;
    elev[i] = coarse[k % nAz] * (1 - f) + coarse[(k + 1) % nAz] * f;
  }
  return { elev, siteHeight: h0 };
}

/**
 * Fast screening variant used by the best-lit search: marches straight lines across the
 * polar-stereographic grid (conformal, so local azimuths are straight over ≤200 km) with
 * series cos/sin, i.e. no trigonometry inside the loop. Within ~0.1° of computeMaskElev
 * away from steep near-field slopes.
 */
export function fastMaskElev(dem: Dem, lat: number, lon: number, azStep = 3): { elev: Float32Array; siteHeight: number } {
  const [row0, col0] = toPixel(dem, lat, lon);
  const h0 = heightAt(dem, row0, col0);
  if (Number.isNaN(h0)) throw new Error('Site outside LOLA DEM coverage');
  const ho = R + h0 + OBS_H;
  const lo = (lon * Math.PI) / 180;
  const colat = ((90 + lat) * Math.PI) / 180;
  const k0 = 2 / (1 + Math.cos(colat));
  const polar = colat < 1e-6;
  const nC = polar ? 0 : Math.sin(lo), nR = polar ? -1 : -Math.cos(lo); // local north in (col,row)
  const eC = Math.cos(lo), eR = Math.sin(lo);                           // local east  in (col,row)
  const nSteps = Math.ceil(MAX_RANGE / dem.scale);
  const nAz = Math.round(360 / azStep);
  const coarse = new Float32Array(nAz);
  for (let k = 0; k < nAz; k++) {
    const a = (k * azStep * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const dC = ca * nC + sa * eC, dR = ca * nR + sa * eR;
    let best = -Infinity; // tan of best elevation
    for (let s = 1; s <= nSteps; s++) {
      const th = (s * dem.scale) / k0 / R, t2 = th * th;
      const c = 1 - t2 / 2 + (t2 * t2) / 24, sn = th - (th * t2) / 6;
      const ht = heightAt(dem, row0 + dR * s, col0 + dC * s);
      if (Number.isNaN(ht)) break;
      const tanEl = ((R + ht) * c - ho) / ((R + ht) * sn);
      if (tanEl > best) best = tanEl;
    }
    coarse[k] = (Math.atan(best) * 180) / Math.PI;
  }
  const elev = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    const x = i / azStep, j = Math.floor(x), f = x - j;
    elev[i] = coarse[j % nAz] * (1 - f) + coarse[(j + 1) % nAz] * f;
  }
  return { elev, siteHeight: h0 };
}

const computedCache = new Map<string, HorizonMask>();

/** LOLA mask for any site in coverage: bundled (240 m) if curated, else computed from the 480 m DEM. */
export async function lolaMask(siteId: string, lat: number, lon: number): Promise<HorizonMask> {
  const b = bundledMask(siteId, lat, lon);
  if (b) return b;
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  const hit = computedCache.get(key);
  if (hit) return hit;
  const dem = await loadDem();
  const { elev, siteHeight } = computeMaskElev(dem, lat, lon);
  const m = makeMask(elev, 'LOLA terrain (480 m)',
    `Horizon computed in-browser from ${data.meta.product}, 2×2 averaged to 480 m; observer ${OBS_H} m above terrain (site height ${siteHeight.toFixed(0)} m).`);
  computedCache.set(key, m);
  return m;
}
