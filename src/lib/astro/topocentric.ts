import { DEG, RAD, type Vec3, wrap360 } from './vec.ts';
import { MOON_RADIUS_KM } from './ephemeris.ts';

export interface SiteFrame {
  pos: Vec3;
  up: Vec3;
  east: Vec3;
  north: Vec3;
}

/** Local East-North-Up frame at a selenographic site (planetocentric lat, east-positive lon). */
export function siteFrame(latDeg: number, lonDeg: number, altKm = 0): SiteFrame {
  // Avoid the undefined azimuth reference exactly at a pole.
  const lat = Math.max(-89.9999, Math.min(89.9999, latDeg)) * DEG;
  const lon = lonDeg * DEG;
  const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
  const r = MOON_RADIUS_KM + altKm;
  const up: Vec3 = [cl * co, cl * so, sl];
  return {
    pos: [r * up[0], r * up[1], r * up[2]],
    up,
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
  };
}

/** Azimuth (deg, from north through east) and elevation (deg) of a Moon-fixed target as seen from the site. */
export function azEl(f: SiteFrame, target: Vec3): { az: number; el: number } {
  const x = target[0] - f.pos[0], y = target[1] - f.pos[1], z = target[2] - f.pos[2];
  const r = Math.hypot(x, y, z);
  const u = (x * f.up[0] + y * f.up[1] + z * f.up[2]) / r;
  const e = x * f.east[0] + y * f.east[1] + z * f.east[2];
  const n = x * f.north[0] + y * f.north[1] + z * f.north[2];
  return { az: wrap360(Math.atan2(e, n) * RAD), el: Math.asin(Math.max(-1, Math.min(1, u))) * RAD };
}
