import { useMemo } from 'react';
import { Activity, Radio, Sun as SunIcon, Earth, TriangleAlert } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { usePrimary } from '../state/primary.tsx';
import { nextTransition, sampleAt } from '../lib/analysis.ts';
import { maskAt } from '../lib/providers/terrain.ts';
import { compass, fmtDeg, fmtDur, fmtPct, fmtShortUTC, HOUR } from '../lib/format.ts';
import { Card, InfoTip, ProvBadge } from './ui.tsx';

export function StatusPanel() {
  const { state } = useStore();
  const a = usePrimary();
  const { series, vis, mask, metrics: m } = a;
  const now = sampleAt(series, state.cursorMs);
  const sunNext = useMemo(() => nextTransition(series, vis.sun, (i) => series.sunEl[i] - vis.sunHorizon[i], state.cursorMs), [series, vis, state.cursorMs]);
  const earthNext = useMemo(
    () => nextTransition(series, vis.earth, (i) => series.earthEl[i] - vis.earthHorizon[i] - state.commMinEl, state.cursorMs),
    [series, vis, state.cursorMs, state.commMinEl],
  );
  const sunH = maskAt(mask, now.sunAz), earthH = maskAt(mask, now.earthAz);

  return (
    <div className="flex flex-col gap-3">
      <BodyCard
        kind="sun" title="Sun" icon={<SunIcon size={14} />} el={now.sunEl} az={now.sunAz} horizon={sunH}
        next={sunNext} cursor={state.cursorMs} upWord="Sunset" downWord="Sunrise" tip="sunlight"
      />
      <BodyCard
        kind="earth" title="Earth · DTE link" icon={<Earth size={14} />} el={now.earthEl} az={now.earthAz} horizon={earthH + state.commMinEl}
        next={earthNext} cursor={state.cursorMs} upWord="Earthset" downWord="Earthrise" tip="earthVisibility"
      />

      <Card
        title="Mission Feasibility"
        icon={<Activity size={14} className="text-earth" />}
        right={<div className="flex gap-1"><ProvBadge p={series.provenance} /><ProvBadge p={mask.provenance} extra={mask.label} /></div>}
      >
        <p className="-mt-1 mb-3 font-mono text-[10.5px] text-ink-faint">
          Window: {state.durationDays} d from landing · {mask.kind === 'geometric' ? 'geometric horizon only' : mask.label}
        </p>
        {a.maskNote && <p className={`-mt-2 mb-3 text-[10.5px] ${a.maskLoading ? 'text-earth-soft' : 'text-risk-warn'}`}>{a.maskNote}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Gauge label="Sun above horizon" value={m.sunPct} color="sun" />
          <Gauge label="Earth visible" value={m.earthPct} color="earth" />
          <Gauge label="Sun + Earth together" value={m.bothPct} color="both" wide />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <RiskStat label="Longest darkness" hours={m.longestDarkH} open={m.longestDarkOpen} />
          <RiskStat label="Longest comm blackout" hours={m.longestBlackoutH} open={m.longestBlackoutOpen} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-edge/70 bg-void/40 px-3 py-2">
          <span className="flex items-center gap-1 text-[11px] text-ink-mute">Mean solar-disk visibility <InfoTip topic="power" align="right" /></span>
          <span className="font-mono text-sm text-sun-soft">{(m.meanSunDisk * 100).toFixed(1)}%</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10.5px] text-ink-faint">
          <div>Sun el range <span className="block text-ink-mute">{fmtDeg(m.sunElMin, 1)} … {fmtDeg(m.sunElMax, 1)}</span></div>
          <div>Earth el range <span className="block text-ink-mute">{fmtDeg(m.earthElMin, 1)} … {fmtDeg(m.earthElMax, 1)}</span></div>
        </div>
      </Card>
    </div>
  );
}

function BodyCard({ kind, title, icon, el, az, horizon, next, cursor, upWord, downWord, tip }: {
  kind: 'sun' | 'earth'; title: string; icon: React.ReactNode; el: number; az: number; horizon: number;
  next: ReturnType<typeof nextTransition>; cursor: number; upWord: string; downWord: string; tip: 'sunlight' | 'earthVisibility';
}) {
  const up = next.up;
  const c = kind === 'sun' ? 'text-sun' : 'text-earth';
  const soft = kind === 'sun' ? 'text-sun-soft' : 'text-earth-soft';
  const hrs = next.at ? (next.at - cursor) / HOUR : null;
  const clearance = el - horizon;
  return (
    <Card accent={kind} title={<span className={soft}>{title}</span>} icon={<span className={c}>{icon}</span>} right={<InfoTip topic={tip} align="right" />}>
      <div className="flex items-end justify-between">
        <div>
          <div className={`font-mono text-3xl font-semibold tabular-nums ${soft}`}>{fmtDeg(el)}</div>
          <div className="font-mono text-[11px] text-ink-faint">elevation · az {az.toFixed(1)}° {compass(az)}</div>
        </div>
        <span className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold tracking-wider ${
          up ? (kind === 'sun' ? 'bg-sun/15 text-sun shadow-sunglow' : 'bg-earth/15 text-earth shadow-glow') : 'bg-risk/15 text-risk'
        }`}>
          {kind === 'sun' ? (up ? 'SUNLIT' : 'DARK') : up ? <span className="inline-flex items-center gap-1"><Radio size={11} />LINK OK</span> : 'BLACKOUT'}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-edge/60">
        <div
          className={`h-full rounded-full ${clearance > 0 ? (kind === 'sun' ? 'bg-sun' : 'bg-earth') : 'bg-risk'}`}
          style={{ width: `${Math.min(100, Math.abs(clearance) * 20)}%` }}
        />
      </div>
      <div className="mt-1 font-mono text-[10.5px] text-ink-faint">
        clearance over local horizon{kind === 'earth' ? ' + mask' : ''}: <span className={clearance > 0 ? 'text-ink-mute' : 'text-risk'}>{fmtDeg(clearance)}</span>
      </div>
      <div className={`mt-3 rounded-lg border px-3 py-2 ${up ? 'border-edge/70 bg-void/40' : 'border-risk/30 bg-risk/5'}`}>
        <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">{up ? `Time until next ${upWord.toLowerCase()}` : `${downWord} in`}</div>
        {hrs !== null && next.at ? (
          <div className="flex items-baseline justify-between">
            <span className={`font-mono text-lg font-semibold ${up ? 'text-ink' : 'text-risk'}`}>{fmtDur(hrs)}</span>
            <span className="font-mono text-[10.5px] text-ink-faint">{fmtShortUTC(next.at)} UTC</span>
          </div>
        ) : (
          <div className="font-mono text-sm text-ink-mute">None within the next {fmtDur(next.searchedH)}{up ? '. Continuous!' : ''}</div>
        )}
      </div>
    </Card>
  );
}

function Gauge({ label, value, color, wide }: { label: string; value: number; color: 'sun' | 'earth' | 'both'; wide?: boolean }) {
  const bar = color === 'sun' ? 'bg-sun' : color === 'earth' ? 'bg-earth' : 'bg-gradient-to-r from-sun to-earth';
  const txt = color === 'sun' ? 'text-sun-soft' : color === 'earth' ? 'text-earth-soft' : 'text-ink';
  return (
    <div className={`rounded-lg border border-edge/70 bg-void/40 px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[10.5px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className={`font-mono text-2xl font-semibold tabular-nums ${txt}`}>{fmtPct(value)}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-edge/60">
        <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RiskStat({ label, hours, open }: { label: string; hours: number; open: boolean }) {
  const lvl = hours > 24 ? 'risk' : hours > 6 ? 'warn' : 'ok';
  const cls = lvl === 'risk' ? 'border-risk/40 bg-risk/10 text-risk' : lvl === 'warn' ? 'border-risk-warn/40 bg-risk-warn/10 text-risk-warn' : 'border-ok/30 bg-ok/5 text-ok';
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`} title="Colour bands: >24 h red, >6 h orange (display thresholds only, not requirements)">
      <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider opacity-80">{lvl !== 'ok' && <TriangleAlert size={11} />}{label}</div>
      <div className="font-mono text-lg font-semibold">{open && hours > 0 ? '≥ ' : ''}{hours === 0 ? 'None' : fmtDur(hours)}</div>
    </div>
  );
}
