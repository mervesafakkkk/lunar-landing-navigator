/// <reference lib="webworker" />
/**
 * Renders a terrain-shadow map of the lunar south pole for one instant, from the LOLA DEM.
 * For each output pixel: compute the Sun's local elevation/azimuth, then march across the
 * DEM toward the Sun and test whether terrain (with lunar curvature) blocks it.
 * Polar stereographic is conformal, so the local azimuth maps to a straight direction in the
 * map plane. Over the ≤200 km ray length, straight map lines approximate great circles well.
 */
const R = 1737400;
const OBS = 2;
const MAX_RANGE = 200e3;

let n = 0, scale = 480, dem: Int16Array | null = null, hMax = 0;

interface RenderMsg { type: 'render'; id: number; sun: [number, number, number]; extentDeg: number; size: number }
interface InitMsg { type: 'init'; buf: ArrayBuffer }

function hAt(row: number, col: number) {
  const r = Math.floor(row), c = Math.floor(col);
  if (r < 0 || c < 0 || r >= n - 1 || c >= n - 1) return NaN;
  const fr = row - r, fc = col - c, i = r * n + c, h = dem!;
  return 0.5 * (h[i] * (1 - fr) * (1 - fc) + h[i + 1] * (1 - fr) * fc + h[i + n] * fr * (1 - fc) + h[i + n + 1] * fr * fc);
}

let pending: RenderMsg | null = null;

self.onmessage = (e: MessageEvent<InitMsg | RenderMsg>) => {
  const m = e.data;
  if (m.type === 'init') {
    dem = new Int16Array(m.buf);
    n = Math.round(Math.sqrt(dem.length));
    let mx = -1e9;
    for (let i = 0; i < dem.length; i++) if (dem[i] > mx) mx = dem[i];
    hMax = mx * 0.5;
    if (pending) { const p = pending; pending = null; render(p); }
    return;
  }
  // a render request can arrive before the DEM: keep the latest one and run it after init
  if (!dem) { pending = m; return; }
  render(m);
};

function render(m: RenderMsg) {
  const { size, extentDeg, sun, id } = m;
  const sl = Math.hypot(sun[0], sun[1], sun[2]);
  const sx = sun[0] / sl, sy = sun[1] / sl, sz = sun[2] / sl;
  const out = new Float32Array(size * size).fill(-1); // -1 outside, 0 dark, >0 lit brightness
  const stepPx = 1; // one DEM pixel per step
  const stepM = scale * stepPx;
  const nSteps = Math.ceil(MAX_RANGE / stepM);
  const maxR = 2 * R * Math.tan((extentDeg * Math.PI) / 360); // stereographic radius of the map edge, m

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // map pixel -> stereographic metres (x right = toward 90°E, y up = toward 0°E)
      const x = ((i + 0.5) / size * 2 - 1) * maxR;
      const y = (1 - (j + 0.5) / size * 2) * maxR;
      const rho = Math.hypot(x, y);
      if (rho > maxR) continue;
      const lon = Math.atan2(x, y);
      const colat = 2 * Math.atan(rho / (2 * R));
      const lat = -Math.PI / 2 + colat;
      // DEM pixel (same convention as lola.ts toPixel)
      const col0 = (rho * Math.sin(lon)) / scale + n / 2 - 0.5;
      const row0 = (-rho * Math.cos(lon)) / scale + n / 2 - 0.5;
      const h0 = hAt(row0, col0);
      if (Number.isNaN(h0)) continue;
      // local frame & solar direction
      const cl = Math.cos(lat), sla = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
      const up = cl * co * sx + cl * so * sy + sla * sz;
      const east = -so * sx + co * sy;
      const north = -sla * co * sx - sla * so * sy + cl * sz;
      const elSun = Math.asin(Math.max(-1, Math.min(1, up)));
      const k = j * size + i;
      if (elSun < -0.005) { out[k] = 0; continue; }
      // slope shading from DEM gradient (map plane ~ local plane)
      const dzdc = (hAt(row0, col0 + 1) - hAt(row0, col0 - 1)) / (2 * scale);
      const dzdr = (hAt(row0 + 1, col0) - hAt(row0 - 1, col0)) / (2 * scale);
      // unit vectors of local north/east in map (col,row) space
      const nC = rho > 1 ? Math.sin(lon) : 0, nR = rho > 1 ? -Math.cos(lon) : -1; // radially outward = north
      const eC = Math.cos(lon), eR = Math.sin(lon);
      const dzdN = dzdc * nC + dzdr * nR, dzdE = dzdc * eC + dzdr * eR;
      const nlen = Math.hypot(dzdN, dzdE, 1);
      const shade = Math.max(0, (-dzdE * east - dzdN * north + up) / nlen);
      // march toward the Sun azimuth
      const az = Math.atan2(east, north), ca = Math.cos(az), sa = Math.sin(az);
      const dC = ca * nC + sa * eC, dR = ca * nR + sa * eR;
      const k0 = 2 / (1 + Math.cos(colat)); // stereographic scale factor at the site
      const tanEl = Math.tan(elSun);
      const ho = R + h0 + OBS;
      let lit = true;
      for (let s = 1; s <= nSteps; s++) {
        // central angle; series for cos/sin are accurate to metres over 200 km
        const th = (s * stepM) / k0 / R, t2 = th * th;
        const c = 1 - t2 / 2 + (t2 * t2) / 24, sn = th - (th * t2) / 6;
        // even the highest terrain can no longer block -> stop
        if ((R + hMax) * c - ho < tanEl * (R + hMax) * sn) break;
        const ht = hAt(row0 + dR * s * stepPx, col0 + dC * s * stepPx);
        if (Number.isNaN(ht)) break;
        if ((R + ht) * c - ho > tanEl * (R + ht) * sn) { lit = false; break; }
      }
      out[k] = lit ? Math.max(0.06, shade) : 0;
    }
  }
  (self as unknown as Worker).postMessage({ id, size, out }, [out.buffer]);
}
