import type { HorizonMask, SkySeries } from './providers/types.ts';
import { maskAt } from './providers/terrain.ts';

/** Mean angular radius of the Sun as seen from the Moon (≈ 1 AU), degrees. */
export const SUN_RADIUS_DEG = 0.2666;

export interface Visibility {
  sun: Uint8Array;
  earth: Uint8Array;
  both: Uint8Array;
  /** Fraction (0–1) of the solar disk above the local horizon. A power-availability proxy. */
  sunDisk: Float32Array;
  sunHorizon: Float32Array;
  earthHorizon: Float32Array;
}

export interface AnalysisOptions {
  mask: HorizonMask;
  /** Extra elevation Earth must clear for a usable direct-to-Earth link, degrees. */
  commMinEl: number;
}

function diskFraction(x: number) {
  if (x >= 1) return 1;
  if (x <= -1) return 0;
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

export function visibility(s: SkySeries, o: AnalysisOptions): Visibility {
  const n = s.t.length;
  const v: Visibility = {
    sun: new Uint8Array(n), earth: new Uint8Array(n), both: new Uint8Array(n),
    sunDisk: new Float32Array(n), sunHorizon: new Float32Array(n), earthHorizon: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    const hs = maskAt(o.mask, s.sunAz[i]);
    const he = maskAt(o.mask, s.earthAz[i]);
    v.sunHorizon[i] = hs; v.earthHorizon[i] = he;
    v.sun[i] = s.sunEl[i] > hs ? 1 : 0;
    v.sunDisk[i] = diskFraction((s.sunEl[i] - hs) / SUN_RADIUS_DEG);
    v.earth[i] = s.earthEl[i] > he + o.commMinEl ? 1 : 0;
    v.both[i] = v.sun[i] & v.earth[i];
  }
  return v;
}

export interface Period { start: number; end: number; openStart: boolean; openEnd: boolean }

export interface WindowMetrics {
  startMs: number;
  endMs: number;
  samples: number;
  sunPct: number;
  earthPct: number;
  bothPct: number;
  meanSunDisk: number;
  longestDarkH: number;
  longestDarkOpen: boolean;
  longestBlackoutH: number;
  longestBlackoutOpen: boolean;
  longestNoBothH: number;
  darkPeriods: Period[];
  blackoutPeriods: Period[];
  sunElMin: number; sunElMax: number;
  earthElMin: number; earthElMax: number;
}

export function indexAt(s: SkySeries, ms: number) {
  const i = Math.round((ms - s.t[0]) / s.stepMs);
  return Math.max(0, Math.min(s.t.length - 1, i));
}

function periods(flags: Uint8Array, want: 0 | 1, i0: number, i1: number, s: SkySeries): Period[] {
  const out: Period[] = [];
  let start = -1;
  for (let i = i0; i <= i1; i++) {
    const hit = flags[i] === want;
    if (hit && start < 0) start = i;
    if ((!hit || i === i1) && start >= 0) {
      const endI = hit ? i : i - 1;
      out.push({ start: s.t[start], end: s.t[endI] + (endI === i1 ? 0 : s.stepMs), openStart: start === i0, openEnd: hit && i === i1 });
      start = -1;
    }
  }
  return out;
}

const longest = (p: Period[]) => p.reduce<Period | null>((m, x) => (!m || x.end - x.start > m.end - m.start ? x : m), null);

export function windowMetrics(s: SkySeries, v: Visibility, startMs: number, endMs: number): WindowMetrics {
  const i0 = indexAt(s, startMs), i1 = indexAt(s, endMs);
  let sun = 0, earth = 0, both = 0, disk = 0;
  let sMin = Infinity, sMax = -Infinity, eMin = Infinity, eMax = -Infinity;
  for (let i = i0; i <= i1; i++) {
    sun += v.sun[i]; earth += v.earth[i]; both += v.both[i]; disk += v.sunDisk[i];
    sMin = Math.min(sMin, s.sunEl[i]); sMax = Math.max(sMax, s.sunEl[i]);
    eMin = Math.min(eMin, s.earthEl[i]); eMax = Math.max(eMax, s.earthEl[i]);
  }
  const n = i1 - i0 + 1;
  const dark = periods(v.sun, 0, i0, i1, s);
  const black = periods(v.earth, 0, i0, i1, s);
  const noBoth = periods(v.both, 0, i0, i1, s);
  const ld = longest(dark), lb = longest(black), lnb = longest(noBoth);
  const H = 3600000;
  return {
    startMs, endMs, samples: n,
    sunPct: (100 * sun) / n, earthPct: (100 * earth) / n, bothPct: (100 * both) / n, meanSunDisk: disk / n,
    longestDarkH: ld ? (ld.end - ld.start) / H : 0, longestDarkOpen: !!ld && (ld.openStart || ld.openEnd),
    longestBlackoutH: lb ? (lb.end - lb.start) / H : 0, longestBlackoutOpen: !!lb && (lb.openStart || lb.openEnd),
    longestNoBothH: lnb ? (lnb.end - lnb.start) / H : 0,
    darkPeriods: dark, blackoutPeriods: black,
    sunElMin: sMin, sunElMax: sMax, earthElMin: eMin, earthElMax: eMax,
  };
}

export interface NextEvent {
  /** Is the body currently visible at the cursor? */
  up: boolean;
  /** Time of the next transition (set if up, rise if down), or null if none in the data span. */
  at: number | null;
  /** If none found: how far ahead we looked, hours. */
  searchedH: number;
}

/** Next state change after `ms`, refined to sub-step precision by linear interpolation of clearance. */
export function nextTransition(s: SkySeries, flags: Uint8Array, clearance: (i: number) => number, ms: number): NextEvent {
  const i0 = indexAt(s, ms);
  const up = flags[i0] === 1;
  for (let i = i0 + 1; i < s.t.length; i++) {
    if ((flags[i] === 1) !== up) {
      const a = clearance(i - 1), b = clearance(i);
      const f = a === b ? 0.5 : Math.max(0, Math.min(1, a / (a - b)));
      return { up, at: s.t[i - 1] + f * s.stepMs, searchedH: 0 };
    }
  }
  return { up, at: null, searchedH: (s.t[s.t.length - 1] - s.t[i0]) / 3600000 };
}

export interface Crossing { t: number; body: 'sun' | 'earth'; kind: 'rise' | 'set' }

export function crossings(s: SkySeries, v: Visibility, startMs: number, endMs: number): Crossing[] {
  const i0 = indexAt(s, startMs), i1 = indexAt(s, endMs);
  const out: Crossing[] = [];
  for (let i = i0 + 1; i <= i1; i++) {
    if (v.sun[i] !== v.sun[i - 1]) out.push({ t: s.t[i], body: 'sun', kind: v.sun[i] ? 'rise' : 'set' });
    if (v.earth[i] !== v.earth[i - 1]) out.push({ t: s.t[i], body: 'earth', kind: v.earth[i] ? 'rise' : 'set' });
  }
  return out;
}

/** Interpolated sky state at an arbitrary time (handles azimuth wrap). */
export function sampleAt(s: SkySeries, ms: number) {
  const x = (ms - s.t[0]) / s.stepMs;
  const i = Math.max(0, Math.min(s.t.length - 2, Math.floor(x)));
  const f = Math.max(0, Math.min(1, x - i));
  const lerp = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * f;
  const lerpAz = (a: Float32Array) => {
    let d = a[i + 1] - a[i];
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return (((a[i] + d * f) % 360) + 360) % 360;
  };
  return { sunAz: lerpAz(s.sunAz), sunEl: lerp(s.sunEl), earthAz: lerpAz(s.earthAz), earthEl: lerp(s.earthEl) };
}

/** Choose a sampling step that keeps series sizes reasonable. */
export function stepFor(spanDays: number) {
  if (spanDays <= 75) return 10 * 60000;
  if (spanDays <= 150) return 20 * 60000;
  return 30 * 60000;
}
