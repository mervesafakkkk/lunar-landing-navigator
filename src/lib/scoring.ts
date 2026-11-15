import type { WindowMetrics } from './analysis.ts';

/**
 * Transparent, user-weighted PLANNING HEURISTIC. Every component is shown in the UI.
 * This is not an official NASA feasibility determination.
 */
export interface Criterion {
  key: 'sun' | 'earth' | 'both' | 'dark' | 'blackout';
  label: string;
  explain: string;
  value: (m: WindowMetrics) => number; // 0–100, higher = better
}

/** Reference durations at which the “resilience” criteria reach 0. */
export const DARK_REF_H = 120;
export const BLACKOUT_REF_H = 120;

export const CRITERIA: Criterion[] = [
  { key: 'sun', label: 'Illumination availability', explain: '% of mission time the solar disk centre is above the local horizon.', value: (m) => m.sunPct },
  { key: 'earth', label: 'Communication availability', explain: '% of time Earth clears the horizon plus the comm elevation mask.', value: (m) => m.earthPct },
  { key: 'both', label: 'Simultaneous Sun + Earth', explain: '% of time with both sunlight and a direct-to-Earth line of sight.', value: (m) => m.bothPct },
  { key: 'dark', label: 'Darkness resilience', explain: `100 × (1 − longest darkness / ${DARK_REF_H} h), floored at 0.`, value: (m) => 100 * Math.max(0, 1 - m.longestDarkH / DARK_REF_H) },
  { key: 'blackout', label: 'Blackout resilience', explain: `100 × (1 − longest comm blackout / ${BLACKOUT_REF_H} h), floored at 0.`, value: (m) => 100 * Math.max(0, 1 - m.longestBlackoutH / BLACKOUT_REF_H) },
];

export type Weights = Record<Criterion['key'], number>;
export const DEFAULT_WEIGHTS: Weights = { sun: 3, earth: 2, both: 2, dark: 2, blackout: 1 };

export function planningIndex(m: WindowMetrics, w: Weights) {
  let num = 0, den = 0;
  for (const c of CRITERIA) {
    num += w[c.key] * c.value(m);
    den += w[c.key];
  }
  return den === 0 ? 0 : num / den;
}
