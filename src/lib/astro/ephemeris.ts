/**
 * Analytic Sun / Moon ephemeris + IAU lunar orientation.
 *
 *  - Sun:  Meeus, "Astronomical Algorithms" 2nd ed., ch. 25 (low-precision, ~0.01°)
 *  - Moon: Meeus ch. 47 (ELP-2000/82 truncated series, ~10" in longitude, 4" in latitude)
 *  - Lunar orientation: IAU WGCCRE 2009 rotation model (Archinal et al. 2011),
 *    which approximates the Mean-Earth / polar-axis (ME) frame used by LOLA.
 *
 * All outputs are geometric directions (light-time and aberration ignored — both are
 * well below 0.01° for this application). Accuracy versus JPL Horizons (DE441) is
 * quantified by `npm run validate` and reported in docs/DATA_ACCURACY.md.
 */
import { DEG, type Vec3, rotX, rotZ, wrap360 } from './vec.ts';

export const AU_KM = 149597870.7;
export const MOON_RADIUS_KM = 1737.4;
/** TT − UTC = 32.184 s + 37 leap seconds (valid since 2017; no leap second announced through 2026). */
export const TT_MINUS_UTC_S = 69.184;

export function julianDayUTC(ms: number) {
  return ms / 86400000 + 2440587.5;
}
export function julianDayTT(ms: number) {
  return julianDayUTC(ms) + TT_MINUS_UTC_S / 86400;
}

// ---------------------------------------------------------------------------------
// Moon (Meeus Table 47.A / 47.B)
// columns: D, M, M', F, Σl [1e-6 deg], Σr [1e-3 km]
const LR: number[][] = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925], [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138], [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661], [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208], [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003], [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884], [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0], [4, -1, -1, 0, 1215, -3958], [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258], [2, 1, 1, 0, -810, 2616], [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117], [2, 2, -1, 0, -700, 2354], [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0], [4, 0, 1, 0, 549, -1423], [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571], [1, 0, -2, 0, -487, -1739], [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421], [1, 1, 1, 0, 351, 0], [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0], [2, -1, 2, 0, 327, 0], [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0], [2, 0, 3, 0, 294, 0], [2, 0, -1, -2, 0, 8752],
];
// columns: D, M, M', F, Σb [1e-6 deg]
const B: number[][] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833], [0, 0, 1, -3, 777], [4, 0, -2, 1, 671],
  [2, 0, 0, -3, 607], [2, 0, 2, -1, 596], [2, -1, 1, -1, 491], [2, 0, -2, 1, -451],
  [0, 0, 3, -1, 439], [2, 0, 2, 1, 422], [2, 0, -3, -1, 421], [2, 1, -1, 1, -366],
  [2, 1, 0, 1, -351], [4, 0, 0, 1, 331], [2, -1, 1, 1, 315], [2, -2, 0, -1, 302],
  [0, 0, 1, 3, -283], [2, 1, 1, -1, -229], [1, 1, 0, -1, 223], [1, 1, 0, 1, 223],
  [0, 1, -2, -1, -220], [2, 1, -1, -1, -220], [1, 0, 1, 1, -185], [2, -1, -2, -1, 181],
  [0, 1, 2, 1, -177], [4, 0, -2, -1, 176], [4, -1, -1, -1, 166], [1, 0, 1, -1, -164],
  [4, 0, 1, -1, 132], [1, 0, -1, -1, -119], [4, -1, 0, -1, 115], [2, -2, 0, 1, 107],
];

/** Geocentric Moon, ecliptic of date: [lon deg, lat deg, distance km]. */
export function moonEcliptic(T: number): [number, number, number] {
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;

  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, cl, cr] of LR) {
    const arg = (d * D + m * M + mp * Mp + f * F) * DEG;
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sl += cl * e * Math.sin(arg);
    sr += cr * e * Math.cos(arg);
  }
  for (const [d, m, mp, f, cb] of B) {
    const arg = (d * D + m * M + mp * Mp + f * F) * DEG;
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sb += cb * e * Math.sin(arg);
  }
  sl += 3958 * Math.sin(A1 * DEG) + 1962 * Math.sin((Lp - F) * DEG) + 318 * Math.sin(A2 * DEG);
  sb += -2235 * Math.sin(Lp * DEG) + 382 * Math.sin(A3 * DEG) + 175 * Math.sin((A1 - F) * DEG)
    + 175 * Math.sin((A1 + F) * DEG) + 127 * Math.sin((Lp - Mp) * DEG) - 115 * Math.sin((Lp + Mp) * DEG);

  return [wrap360(Lp + sl / 1e6), sb / 1e6, 385000.56 + sr / 1000];
}

/** Geocentric Sun, ecliptic of date: [lon deg, distance km]. */
export function sunEcliptic(T: number): [number, number] {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const Mr = M * DEG;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
  const v = (M + C) * DEG;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(v));
  return [wrap360(L0 + C), R * AU_KM];
}

const EPS_J2000 = 23.4392911 * DEG;

/** Ecliptic-of-date spherical → ICRF/J2000 equatorial Cartesian (approximate precession). */
function eclDateToICRF(lonDeg: number, latDeg: number, r: number, T: number): Vec3 {
  // General precession in longitude (Lieske 1977); ecliptic motion (<0.5"/yr) neglected.
  const lon = (lonDeg - (1.3969713 * T + 0.0003086 * T * T)) * DEG;
  const lat = latDeg * DEG;
  const ecl: Vec3 = [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
  return rotX(ecl, -EPS_J2000);
}

/** IAU WGCCRE 2009 lunar pole (α0, δ0) and prime meridian W, degrees. */
export function moonOrientation(d: number, T: number) {
  const s = (x: number) => Math.sin(x * DEG), c = (x: number) => Math.cos(x * DEG);
  const E1 = 125.045 - 0.0529921 * d, E2 = 250.089 - 0.1059842 * d, E3 = 260.008 + 13.0120009 * d;
  const E4 = 176.625 + 13.3407154 * d, E5 = 357.529 + 0.9856003 * d, E6 = 311.589 + 26.4057084 * d;
  const E7 = 134.963 + 13.064993 * d, E8 = 276.617 + 0.3287146 * d, E9 = 34.226 + 1.7484877 * d;
  const E10 = 15.134 - 0.1589763 * d, E11 = 119.743 + 0.0036096 * d, E12 = 239.961 + 0.1643573 * d;
  const E13 = 25.053 + 12.9590088 * d;
  const alpha0 = 269.9949 + 0.0031 * T - 3.8787 * s(E1) - 0.1204 * s(E2) + 0.07 * s(E3) - 0.0172 * s(E4)
    + 0.0072 * s(E6) - 0.0052 * s(E10) + 0.0043 * s(E13);
  const delta0 = 66.5392 + 0.013 * T + 1.5419 * c(E1) + 0.0239 * c(E2) - 0.0278 * c(E3) + 0.0068 * c(E4)
    - 0.0029 * c(E6) + 0.0009 * c(E7) + 0.0008 * c(E10) - 0.0009 * c(E13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * s(E1) + 0.1208 * s(E2) - 0.0642 * s(E3)
    + 0.0158 * s(E4) + 0.0252 * s(E5) - 0.0066 * s(E6) - 0.0047 * s(E7) - 0.0046 * s(E8) + 0.0028 * s(E9)
    + 0.0052 * s(E10) + 0.004 * s(E11) + 0.0019 * s(E12) - 0.0044 * s(E13);
  return { alpha0, delta0, W };
}

export function icrfToMoonFixed(v: Vec3, o: { alpha0: number; delta0: number; W: number }): Vec3 {
  return rotZ(rotX(rotZ(v, (90 + o.alpha0) * DEG), (90 - o.delta0) * DEG), o.W * DEG);
}

export interface MoonGeometry {
  /** Unix ms (UTC). */
  t: number;
  /** Sun position relative to Moon centre, Moon body-fixed (ME-approx) frame, km. */
  sun: Vec3;
  /** Earth position relative to Moon centre, Moon body-fixed frame, km. */
  earth: Vec3;
}

/** Site-independent geometry at one instant. Sun/Earth vectors from the Moon centre, Moon-fixed. */
export function moonGeometry(ms: number): MoonGeometry {
  const jd = julianDayTT(ms);
  const d = jd - 2451545.0;
  const T = d / 36525;
  const [ml, mb, mr] = moonEcliptic(T);
  const [sl, sr] = sunEcliptic(T);
  const moon = eclDateToICRF(ml, mb, mr, T);
  const sun = eclDateToICRF(sl, 0, sr, T);
  const o = moonOrientation(d, T);
  const sunFromMoon: Vec3 = [sun[0] - moon[0], sun[1] - moon[1], sun[2] - moon[2]];
  const earthFromMoon: Vec3 = [-moon[0], -moon[1], -moon[2]];
  return { t: ms, sun: icrfToMoonFixed(sunFromMoon, o), earth: icrfToMoonFixed(earthFromMoon, o) };
}
