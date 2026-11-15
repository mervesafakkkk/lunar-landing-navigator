/**
 * Regional alternative search: scan a grid of points around a site, compute each point's
 * LOLA terrain horizon, and rank the points by sunlight / Sun+Earth availability over the
 * mission window. Uses the 480 m DEM and a 3° azimuth step, so it is a fast screening tool.
 * Check any chosen point at full detail by selecting it, which recomputes its 1° horizon.
 */
import { geometryGrid } from './providers/analytic.ts';
import { fastMaskElev, loadDem } from './providers/lola.ts';
import { azEl, siteFrame } from './astro/topocentric.ts';
import { DAY, HOUR } from './format.ts';

export interface Candidate { lat: number; lon: number; distKm: number; sunPct: number; earthPct: number; bothPct: number; heightM: number }

const R_KM = 1737.4;

function offset(lat: number, lon: number, dxKm: number, dyKm: number) {
  const d = Math.hypot(dxKm, dyKm) / R_KM, az = Math.atan2(dxKm, dyKm);
  const p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(az));
  const l2 = l1 + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: (p2 * 180) / Math.PI, lon: ((((l2 * 180) / Math.PI) + 540) % 360) - 180 };
}

export async function searchNearby(opts: {
  lat: number; lon: number; radiusKm: number; startMs: number; durationDays: number; commMinEl: number;
  onProgress?: (f: number) => void; signal?: { cancelled: boolean };
}): Promise<Candidate[]> {
  const dem = await loadDem();
  const geom = geometryGrid(opts.startMs, opts.startMs + opts.durationDays * DAY, opts.durationDays > 20 ? 2 * HOUR : HOUR);
  const spacing = opts.radiusKm / 6;
  const pts: { lat: number; lon: number; distKm: number }[] = [];
  for (let gy = -6; gy <= 6; gy++) for (let gx = -6; gx <= 6; gx++) {
    const dist = Math.hypot(gx, gy) * spacing;
    if (dist > opts.radiusKm + 1e-9) continue;
    pts.push({ ...offset(opts.lat, opts.lon, gx * spacing, gy * spacing), distKm: dist });
  }
  const out: Candidate[] = [];
  let lastYield = performance.now();
  for (let k = 0; k < pts.length; k++) {
    if (opts.signal?.cancelled) break;
    const p = pts[k];
    try {
      const { elev, siteHeight } = fastMaskElev(dem, p.lat, p.lon, 3);
      const f = siteFrame(p.lat, p.lon);
      let s = 0, e = 0, b = 0;
      for (const g of geom) {
        const a = azEl(f, g.sun), ea = azEl(f, g.earth);
        const su = a.el > elev[Math.floor(a.az) % 360];
        const eu = ea.el > elev[Math.floor(ea.az) % 360] + opts.commMinEl;
        s += +su; e += +eu; b += +(su && eu);
      }
      const n = geom.length;
      out.push({ ...p, sunPct: (100 * s) / n, earthPct: (100 * e) / n, bothPct: (100 * b) / n, heightM: siteHeight });
    } catch { /* outside DEM */ }
    // yield to the UI about every 60 ms (not every point), so rendering doesn't slow the scan
    if (performance.now() - lastYield > 60) {
      opts.onProgress?.((k + 1) / pts.length);
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }
  opts.onProgress?.(1);
  return out;
}
