import type { Site } from '../sites.ts';

/** How trustworthy a number is. Shown as a badge next to every result. */
export type Provenance = 'sourced' | 'derived' | 'computed' | 'illustrative';

/** Columnar time series of Sun/Earth topocentric directions at one site. */
export interface SkySeries {
  t: Float64Array; // unix ms UTC
  sunAz: Float32Array;
  sunEl: Float32Array;
  earthAz: Float32Array;
  earthEl: Float32Array;
  stepMs: number;
  providerId: string;
  provenance: Provenance;
}

/**
 * Ephemeris provider contract. Any source (built-in analytic model, JPL Horizons,
 * SPICE kernels via a backend…) can be swapped in by implementing this.
 */
export interface EphemerisProvider {
  id: string;
  label: string;
  provenance: Provenance;
  description: string;
  getSeries(site: Site, startMs: number, endMs: number, stepMs: number, signal?: AbortSignal): Promise<SkySeries>;
}

/**
 * Local horizon elevation (deg) as a function of azimuth. Independent of the ephemeris.
 * `elev` holds 360 one-degree bins (azimuth 0…359, from north through east).
 */
export interface HorizonMask {
  kind: 'geometric' | 'lola' | 'illustrative' | 'user';
  label: string;
  provenance: Provenance;
  source: string;
  elev: Float32Array;
}
