import { useEffect, useMemo, useState } from 'react';
import type { Site } from '../lib/sites.ts';
import { analyticSeriesSync } from '../lib/providers/analytic.ts';
import { horizonsProvider } from '../lib/providers/horizons.ts';
import type { SkySeries } from '../lib/providers/types.ts';
import { stepFor, visibility, windowMetrics } from '../lib/analysis.ts';
import { DAY } from '../lib/format.ts';
import { useStore } from './store.tsx';
import { useHorizonMask } from './useHorizonMask.ts';

/** Days of extra data computed past mission end, so "next sunset" etc. can be found. */
export const LOOKAHEAD_DAYS = 30;

export interface ScenarioInput {
  site: Site;
  landingMs: number;
  durationDays: number;
}

export type ProviderStatus =
  | { state: 'ok'; providerId: 'analytic' | 'horizons' }
  | { state: 'loading' }
  | { state: 'fallback'; error: string };

/**
 * Full analysis of one scenario. The analytic model is always computed synchronously
 * (instant feedback). When JPL Horizons is selected, its data replaces the analytic
 * result once it arrives. On failure, the analytic result stays and is flagged.
 */
export function useScenarioAnalysis(sc: ScenarioInput) {
  const { state } = useStore();
  const { provider, commMinEl } = state;
  const spanDays = sc.durationDays + LOOKAHEAD_DAYS;
  const start = sc.landingMs;
  const end = sc.landingMs + spanDays * DAY;
  const step = stepFor(spanDays);

  const analytic = useMemo(() => analyticSeriesSync(sc.site, start, end, step), [sc.site.lat, sc.site.lon, start, end, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const [remote, setRemote] = useState<{ key: string; series?: SkySeries; error?: string } | null>(null);
  const key = `${sc.site.lat}|${sc.site.lon}|${start}|${end}|${step}`;
  useEffect(() => {
    if (provider !== 'horizons') return;
    const ctrl = new AbortController();
    setRemote({ key });
    horizonsProvider
      .getSeries(sc.site, start, end, step, ctrl.signal)
      .then((series) => setRemote({ key, series }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setRemote({ key, error: e.message }); });
    return () => ctrl.abort();
  }, [provider, key]); // eslint-disable-line react-hooks/exhaustive-deps

  let series = analytic;
  let status: ProviderStatus = { state: 'ok', providerId: 'analytic' };
  if (provider === 'horizons') {
    if (remote?.key === key && remote.series) { series = remote.series; status = { state: 'ok', providerId: 'horizons' }; }
    else if (remote?.key === key && remote.error) status = { state: 'fallback', error: remote.error };
    else status = { state: 'loading' };
  }

  const { mask, note: maskNote, loading: maskLoading } = useHorizonMask(sc.site);
  const vis = useMemo(() => visibility(series, { mask, commMinEl }), [series, mask, commMinEl]);
  const missionEnd = sc.landingMs + sc.durationDays * DAY;
  const metrics = useMemo(() => windowMetrics(series, vis, sc.landingMs, missionEnd), [series, vis, sc.landingMs, missionEnd]);

  return { series, vis, metrics, mask, maskNote, maskLoading, status, missionEnd };
}

export type ScenarioAnalysis = ReturnType<typeof useScenarioAnalysis>;
