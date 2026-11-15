import { moonGeometry, type MoonGeometry } from '../astro/ephemeris.ts';
import { azEl, siteFrame } from '../astro/topocentric.ts';
import type { Site } from '../sites.ts';
import type { EphemerisProvider, SkySeries } from './types.ts';

/** Site-independent geometry grids are cached and shared by every site/scenario. */
const geomCache = new Map<string, MoonGeometry[]>();

export function geometryGrid(startMs: number, endMs: number, stepMs: number): MoonGeometry[] {
  const key = `${startMs}|${endMs}|${stepMs}`;
  const hit = geomCache.get(key);
  if (hit) return hit;
  const out: MoonGeometry[] = [];
  for (let t = startMs; t <= endMs; t += stepMs) out.push(moonGeometry(t));
  geomCache.set(key, out);
  if (geomCache.size > 24) geomCache.delete(geomCache.keys().next().value!);
  return out;
}

export function seriesFromGeometry(site: Site, geom: MoonGeometry[], stepMs: number): SkySeries {
  const f = siteFrame(site.lat, site.lon);
  const n = geom.length;
  const s: SkySeries = {
    t: new Float64Array(n), sunAz: new Float32Array(n), sunEl: new Float32Array(n),
    earthAz: new Float32Array(n), earthEl: new Float32Array(n), stepMs,
    providerId: 'analytic', provenance: 'computed',
  };
  for (let i = 0; i < n; i++) {
    const g = geom[i];
    const a = azEl(f, g.sun), b = azEl(f, g.earth);
    s.t[i] = g.t; s.sunAz[i] = a.az; s.sunEl[i] = a.el; s.earthAz[i] = b.az; s.earthEl[i] = b.el;
  }
  return s;
}

export function analyticSeriesSync(site: Site, startMs: number, endMs: number, stepMs: number): SkySeries {
  return seriesFromGeometry(site, geometryGrid(startMs, endMs, stepMs), stepMs);
}

export const analyticProvider: EphemerisProvider = {
  id: 'analytic',
  label: 'Built-in analytic model',
  provenance: 'computed',
  description:
    'Meeus Sun & Moon theories plus the IAU WGCCRE 2009 lunar rotation model. It runs offline in the browser and agrees with JPL Horizons DE441 to < 0.01° in tests.',
  async getSeries(site, startMs, endMs, stepMs) {
    return analyticSeriesSync(site, startMs, endMs, stepMs);
  },
};
