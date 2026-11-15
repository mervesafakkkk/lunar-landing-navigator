/**
 * Validates the built-in analytic ephemeris against NASA/JPL Horizons (DE441).
 * Run: npm run validate      (requires internet access to ssd.jpl.nasa.gov)
 *
 * For each test site it requests apparent azimuth/elevation of the Sun (10) and
 * Earth (399) from a lunar surface observer (CENTER=coord@301, MEAN_ME frame), then
 * recomputes the same quantities with src/lib/astro and reports the differences.
 */
import { moonGeometry } from '../src/lib/astro/ephemeris.ts';
import { siteFrame, azEl } from '../src/lib/astro/topocentric.ts';

const SITES = [
  { name: 'Shackleton (center)', lat: -89.67, lon: 129.78 },
  { name: 'Malapert crater', lat: -84.9, lon: 12.9 },
  { name: 'Apollo 11', lat: 0.67408, lon: 23.47297 },
];
const START = '2026-12-01', STOP = '2027-01-01', STEP = '3h';

async function horizons(target: string, lat: number, lon: number) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: `'${target}'`, CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${lon},${lat},0'`, EPHEM_TYPE: "'OBSERVER'", START_TIME: `'${START}'`,
    STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${STEP}'`, QUANTITIES: "'4'", CSV_FORMAT: "'YES'",
    TIME_DIGITS: "'MINUTES'",
  });
  const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${p}`);
  const { result } = (await res.json()) as { result: string };
  const body = result.split('$$SOE')[1].split('$$EOE')[0];
  return body.trim().split('\n').map((line) => {
    const c = line.split(',').map((s) => s.trim());
    return { t: Date.parse(c[0].replace(/-(\w{3})-/, ' $1 ') + ' UTC'), az: +c[3], el: +c[4] };
  });
}

const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

for (const s of SITES) {
  const f = siteFrame(s.lat, s.lon);
  for (const [label, id] of [['Sun', '10'], ['Earth', '399']] as const) {
    const rows = await horizons(id, s.lat, s.lon);
    let maxEl = 0, sumEl2 = 0, maxAz = 0;
    for (const r of rows) {
      const g = moonGeometry(r.t);
      const m = azEl(f, label === 'Sun' ? g.sun : g.earth);
      const dEl = m.el - r.el;
      // azimuth error weighted by cos(el) = true angular error on the sky
      const dAz = angDiff(m.az, r.az) * Math.cos((r.el * Math.PI) / 180);
      maxEl = Math.max(maxEl, Math.abs(dEl));
      maxAz = Math.max(maxAz, Math.abs(dAz));
      sumEl2 += dEl * dEl;
    }
    console.log(`${s.name.padEnd(22)} ${label.padEnd(6)} n=${rows.length}  elev RMS ${Math.sqrt(sumEl2 / rows.length).toFixed(4)}°  max ${maxEl.toFixed(4)}°  |  az·cos(el) max ${maxAz.toFixed(4)}°`);
  }
}
