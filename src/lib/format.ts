export const HOUR = 3600000;
export const DAY = 86400000;

export function fmtUTC(ms: number, withSeconds = false) {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, withSeconds ? 19 : 16)} UTC`;
}

export function fmtShortUTC(ms: number) {
  const d = new Date(ms);
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${mon} ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function fmtDur(hours: number) {
  if (!Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) {
    const h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return m ? `${h} h ${m} m` : `${h} h`;
  }
  const d = Math.floor(hours / 24), h = Math.round(hours - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function fmtPct(x: number, digits = 1) {
  return `${x.toFixed(digits)}%`;
}

export function fmtDeg(x: number, digits = 2) {
  return `${x >= 0 ? '+' : ''}${x.toFixed(digits)}°`;
}

/** `datetime-local` input value <-> UTC ms (we treat the input as UTC). */
export function toInputValue(ms: number) {
  return new Date(ms).toISOString().slice(0, 16);
}
export function fromInputValue(v: string) {
  return Date.parse(`${v}:00Z`);
}

export function compass(az: number) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(az / 22.5) % 16];
}
