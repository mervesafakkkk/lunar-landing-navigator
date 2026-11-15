import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarSearch, Pin, Target } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { useHorizonMask } from '../state/useHorizonMask.ts';
import { analyticSeriesSync } from '../lib/providers/analytic.ts';
import { visibility } from '../lib/analysis.ts';
import { DAY, HOUR, fmtShortUTC, fmtUTC } from '../lib/format.ts';
import { Card, InfoTip, ProvBadge, Seg } from './ui.tsx';

const STEP = 30 * 60000;

/** Scans candidate landing times and reports mission-window coverage for each. Answers "When should we land?" */
export function WindowFinder() {
  const { state, site, set, setLanding } = useStore();
  const [anchor, setAnchor] = useState(() => Math.floor(state.landingMs / DAY) * DAY);
  const [scanDays, setScanDays] = useState(60);
  const [goal, setGoal] = useState<'both' | 'sun' | 'earth'>('both');
  const { mask, loading: maskLoading } = useHorizonMask(site);

  const rows = useMemo(() => {
    const winSteps = Math.round((state.durationDays * DAY) / STEP);
    const series = analyticSeriesSync(site, anchor, anchor + (scanDays + state.durationDays) * DAY, STEP);
    const v = visibility(series, { mask, commMinEl: state.commMinEl });
    const n = series.t.length;
    const ps = new Float64Array(n + 1), pe = new Float64Array(n + 1), pb = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { ps[i + 1] = ps[i] + v.sun[i]; pe[i + 1] = pe[i] + v.earth[i]; pb[i + 1] = pb[i] + v.both[i]; }
    const out = [];
    const cstep = Math.round((scanDays > 120 ? 24 * HOUR : 6 * HOUR) / STEP);
    for (let i = 0; i + winSteps < n; i += cstep) {
      const j = i + winSteps + 1;
      out.push({ t: series.t[i], sun: (100 * (ps[j] - ps[i])) / (j - i), earth: (100 * (pe[j] - pe[i])) / (j - i), both: (100 * (pb[j] - pb[i])) / (j - i) });
    }
    return { out, provenance: mask.provenance };
  }, [site, anchor, scanDays, state.durationDays, state.commMinEl, mask]);

  const ticks = useMemo(() => {
    const every = scanDays <= 30 ? 3 : scanDays <= 60 ? 7 : scanDays <= 120 ? 14 : 30;
    const out: number[] = [];
    for (let t = anchor; t <= anchor + scanDays * DAY; t += every * DAY) out.push(t);
    return out;
  }, [anchor, scanDays]);
  const bestRow = rows.out.reduce((b, r) => (r[goal] > b[goal] ? r : b), rows.out[0]);
  const fmtTick = (t: number) => { const d = new Date(t); return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`; };

  return (
    <Card
      title="Landing-Window Scan · When should we land?"
      icon={<CalendarSearch size={14} className="text-sun" />}
      right={<div className="flex items-center gap-2"><ProvBadge p="computed" extra="analytic model, 30-min sampling" /><ProvBadge p={rows.provenance} extra={mask.label} /><InfoTip topic="window" align="right" /></div>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg size="xs" value={goal} onChange={setGoal} options={[{ v: 'both', label: 'Optimise Sun + Earth' }, { v: 'sun', label: 'Sunlight' }, { v: 'earth', label: 'Earth' }]} />
        <Seg size="xs" value={scanDays} onChange={setScanDays} options={[{ v: 30, label: '30 d' }, { v: 60, label: '60 d' }, { v: 120, label: '120 d' }, { v: 365, label: '1 year' }]} />
        <button className="btn" onClick={() => setAnchor(Math.floor(state.landingMs / DAY) * DAY)}>Scan from current landing</button>
        <span className="font-mono text-[10.5px] text-ink-faint">
          {site.name} · {state.durationDays}-day mission · {maskLoading ? 'computing terrain… · ' : ''}candidates every {scanDays > 120 ? '24' : '6'} h from {fmtUTC(anchor).slice(0, 10)}
        </span>
      </div>

      {bestRow && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-ok/30 bg-ok/5 px-3 py-2">
          <Target size={16} className="text-ok" />
          <span className="text-[13px] text-ink">
            Best landing in the scan for <b>{goal === 'both' ? 'Sun + Earth' : goal === 'sun' ? 'sunlight' : 'Earth visibility'}</b>:{' '}
            <span className="font-mono text-ok">{fmtUTC(bestRow.t)}</span>{' '}
            <span className="font-mono text-ink-mute">(Sun {bestRow.sun.toFixed(1)}% · Earth {bestRow.earth.toFixed(1)}% · both {bestRow.both.toFixed(1)}%)</span>
          </span>
          <div className="ml-auto flex gap-1">
            <button className="btn btn-primary" onClick={() => setLanding(bestRow.t)}>Use this landing time</button>
            <button className="btn" onClick={() => !state.altDates.includes(bestRow.t) && set({ altDates: [...state.altDates, bestRow.t].sort((a, b) => a - b).slice(-6) })}><Pin size={12} /> Pin</button>
          </div>
        </div>
      )}

      <div className="h-[220px]">
        <ResponsiveContainer>
          <LineChart data={rows.out} margin={{ top: 6, right: 12, bottom: 0, left: -14 }} onClick={(e) => { if (e && typeof e.activeLabel === 'number') setLanding(e.activeLabel); }}>
            <CartesianGrid strokeDasharray="2 4" />
            <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} ticks={ticks} tickFormatter={fmtTick} stroke="#1a2a47" />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} stroke="#1a2a47" width={48} />
            <Tooltip contentStyle={{ background: 'rgba(7,13,26,0.95)', border: '1px solid #1a2a47', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11 }}
              labelFormatter={(t: number) => `Land at ${fmtShortUTC(t)} UTC`} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
            <Line dataKey="sun" name="Sunlit" stroke="#f5b82e" dot={false} strokeWidth={goal === 'sun' ? 2.5 : 1.3} isAnimationActive={false} />
            <Line dataKey="earth" name="Earth visible" stroke="#22d3ee" dot={false} strokeWidth={goal === 'earth' ? 2.5 : 1.3} isAnimationActive={false} />
            <Line dataKey="both" name="Both" stroke="#e6edf7" dot={false} strokeWidth={goal === 'both' ? 2.5 : 1.3} isAnimationActive={false} />
            {state.altDates.map((t) => <ReferenceLine key={t} x={t} stroke="#c084fc" strokeDasharray="3 3" ifOverflow="hidden" />)}
            <ReferenceLine x={state.landingMs} stroke="#34d399" strokeWidth={1.5} ifOverflow="hidden" label={{ value: 'PLANNED', fill: '#34d399', fontSize: 9, position: 'insideTopLeft' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10.5px] text-ink-faint">Click the chart to set the landing time. Purple lines = pinned alternative dates. Each point is the % of the following {state.durationDays} days with the condition met.</p>
    </Card>
  );
}
