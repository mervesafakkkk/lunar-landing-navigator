import type { Site } from '../sites.ts';
import type { HorizonMask } from './types.ts';

export type TerrainMode = 'lola' | 'geometric' | 'illustrative' | 'user';

export const GEOMETRIC_MASK: HorizonMask = {
  kind: 'geometric', label: 'Geometric horizon (0°)', provenance: 'computed',
  source: 'Smooth sphere, R = 1737.4 km. Terrain is ignored.', elev: new Float32Array(360),
};

/** Deterministic PRNG so the illustrative mask for a given site is always the same. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ILLUSTRATIVE ONLY. Synthetic, plausible-looking horizon (0–~4° near the pole, the order
 * of magnitude reported for south-polar horizons). It demonstrates how terrain changes the
 * results. It is NOT derived from LOLA data and must not be used for planning.
 */
export function illustrativeMask(site: Site): HorizonMask {
  const rnd = mulberry32(Math.round((site.lat * 1000 + 91) * 7919 + (site.lon * 1000 + 181) * 104729));
  const polar = Math.min(1, Math.max(0.25, (Math.abs(site.lat) - 60) / 30));
  const elev = new Float32Array(360);
  const comps = Array.from({ length: 7 }, (_, k) => ({ f: k + 1 + Math.floor(rnd() * 3), p: rnd() * Math.PI * 2, a: rnd() / (k + 1) }));
  const ridges = Array.from({ length: 3 }, () => ({ c: rnd() * 360, w: 8 + rnd() * 30, h: 0.8 + rnd() * 2.2 }));
  for (let i = 0; i < 360; i++) {
    let v = 0.6;
    for (const c of comps) v += c.a * 1.4 * Math.sin((i * Math.PI * 2 * c.f) / 360 + c.p);
    for (const r of ridges) {
      const d = Math.min(Math.abs(i - r.c), 360 - Math.abs(i - r.c));
      v += r.h * Math.exp(-(d * d) / (2 * r.w * r.w));
    }
    elev[i] = Math.max(-0.5, v * polar * 1.1);
  }
  return {
    kind: 'illustrative', label: 'Illustrative terrain (synthetic)', provenance: 'illustrative',
    source: 'Synthetic demonstration profile. NOT LOLA data.', elev,
  };
}

/**
 * Parse a user horizon mask CSV: two numeric columns `azimuth_deg, elevation_deg`
 * (any order of rows, header optional). Interpolated to 1° bins, wrapping at 360°.
 * Compatible with the output of tools/lola_masks.py --site.
 */
export function parseHorizonCsv(text: string, label: string): HorizonMask {
  const pts: [number, number][] = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) pts.push([((c[0] % 360) + 360) % 360, c[1]]);
  }
  if (pts.length < 4) throw new Error('Need at least 4 "azimuth,elevation" rows');
  pts.sort((a, b) => a[0] - b[0]);
  const elev = new Float32Array(360);
  for (let i = 0; i < 360; i++) {
    let j = pts.findIndex((p) => p[0] >= i);
    const hi = j < 0 ? [pts[0][0] + 360, pts[0][1]] : pts[j];
    const lo = j <= 0 ? [pts[pts.length - 1][0] - 360, pts[pts.length - 1][1]] : pts[j - 1];
    const span = hi[0] - lo[0];
    elev[i] = span === 0 ? hi[1] : lo[1] + ((hi[1] - lo[1]) * (i - lo[0])) / span;
  }
  // Files that declare themselves synthetic/demo are never promoted to "sourced".
  const synthetic = /synthetic|illustrative|demo|not lola/i.test(text);
  return {
    kind: 'user', label, provenance: synthetic ? 'illustrative' : 'sourced',
    source: synthetic
      ? 'User-supplied file that declares itself synthetic. Not a measurement.'
      : 'User-supplied horizon profile. Its provenance is the user’s responsibility.',
    elev,
  };
}

/** Horizon elevation at an arbitrary azimuth (linear interpolation, wraps). */
export function maskAt(m: HorizonMask, az: number) {
  const a = ((az % 360) + 360) % 360;
  const i = Math.floor(a), f = a - i;
  return m.elev[i] * (1 - f) + m.elev[(i + 1) % 360] * f;
}

export function resolveMask(mode: TerrainMode, site: Site, userMasks: Record<string, HorizonMask>): HorizonMask {
  if (mode === 'illustrative') return illustrativeMask(site);
  if (mode === 'user' && userMasks[site.id]) return userMasks[site.id];
  return GEOMETRIC_MASK;
}
