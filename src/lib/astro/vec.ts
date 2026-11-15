export type Vec3 = [number, number, number];

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => scale(a, 1 / norm(a));

/** Frame rotation about X (passive rotation, angle in radians). */
export const rotX = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]];
};
/** Frame rotation about Z (passive rotation, angle in radians). */
export const rotZ = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
};

export const wrap360 = (x: number) => ((x % 360) + 360) % 360;
export const wrap180 = (x: number) => {
  const w = wrap360(x);
  return w > 180 ? w - 360 : w;
};
