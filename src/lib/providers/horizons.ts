import type { Site } from '../sites.ts';
import type { EphemerisProvider, SkySeries } from './types.ts';

/**
 * NASA/JPL Horizons provider (https://ssd.jpl.nasa.gov/horizons/).
 * Requests apparent azimuth/elevation (QUANTITIES=4) of the Sun (10) and Earth (399)
 * for an observer on the lunar surface (CENTER=coord@301, MEAN_ME frame, DE441).
 *
 * Horizons sends no CORS headers, so requests go through the same-origin proxy
 * `/api/horizons` configured in vite.config.ts. A static deployment must provide an
 * equivalent proxy (see README) or the app falls back to the analytic model.
 */
const ENDPOINT = `${import.meta.env.BASE_URL}api/horizons`;
const cache = new Map<string, Promise<{ t: number[]; az: number[]; el: number[] }>>();

function fmt(ms: number) {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

// Horizons rejects concurrent requests from one client with HTTP 503, so every request
// goes through a single-file queue and 503s are retried with backoff.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

async function fetchWithRetry(url: string) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.status !== 503 || attempt >= 4) return res;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

async function query(target: '10' | '399', site: Site, startMs: number, endMs: number, stepMin: number) {
  const p = new URLSearchParams({
    format: 'json', MAKE_EPHEM: 'YES', EPHEM_TYPE: "'OBSERVER'", COMMAND: `'${target}'`,
    CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${site.lon},${site.lat},0'`,
    START_TIME: `'${fmt(startMs)}'`, STOP_TIME: `'${fmt(endMs)}'`, STEP_SIZE: `'${stepMin}m'`,
    QUANTITIES: "'4'", CSV_FORMAT: "'YES'", CAL_FORMAT: "'JD'", OBJ_DATA: "'NO'",
  });
  const res = await enqueue(() => fetchWithRetry(`${ENDPOINT}?${p}`));
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: string };
  if (json.error) throw new Error(json.error);
  const text = json.result ?? '';
  const soe = text.indexOf('$$SOE'), eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) throw new Error('Unexpected Horizons response (no $$SOE block)');
  const t: number[] = [], az: number[] = [], el: number[] = [];
  for (const line of text.slice(soe + 5, eoe).trim().split('\n')) {
    const c = line.split(',').map((x) => x.trim());
    const jd = parseFloat(c[0]);
    t.push(Math.round((jd - 2440587.5) * 86400000));
    az.push(parseFloat(c[3]));
    el.push(parseFloat(c[4]));
  }
  return { t, az, el };
}

// Requests are shared through the cache and never aborted, so a cancelled consumer
// (e.g. React StrictMode's double effect) cannot poison the cache for the next one.
function cached(target: '10' | '399', site: Site, s: number, e: number, step: number) {
  const key = `${target}|${site.lat}|${site.lon}|${s}|${e}|${step}`;
  let p = cache.get(key);
  if (!p) {
    p = query(target, site, s, e, step);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export const horizonsProvider: EphemerisProvider = {
  id: 'horizons',
  label: 'NASA/JPL Horizons (DE441)',
  provenance: 'sourced',
  description:
    'Live apparent az/el from JPL Horizons for a lunar surface observer (DE441 ephemeris, MEAN_ME frame). Needs network access and the /api/horizons proxy.',
  async getSeries(site, startMs, endMs, stepMs, signal): Promise<SkySeries> {
    const stepMin = Math.max(1, Math.round(stepMs / 60000));
    const [sun, earth] = await Promise.all([
      cached('10', site, startMs, endMs, stepMin),
      cached('399', site, startMs, endMs, stepMin),
    ]);
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const n = Math.min(sun.t.length, earth.t.length);
    if (n < 2) throw new Error('Horizons returned too few rows');
    return {
      t: Float64Array.from(sun.t.slice(0, n)),
      sunAz: Float32Array.from(sun.az.slice(0, n)), sunEl: Float32Array.from(sun.el.slice(0, n)),
      earthAz: Float32Array.from(earth.az.slice(0, n)), earthEl: Float32Array.from(earth.el.slice(0, n)),
      stepMs: stepMin * 60000, providerId: 'horizons', provenance: 'sourced',
    };
  },
};
