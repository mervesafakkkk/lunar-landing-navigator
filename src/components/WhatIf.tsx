import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, FlaskRound, RotateCcw, Sparkles } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { usePrimary } from '../state/primary.tsx';
import { useScenarioAnalysis, type ScenarioAnalysis } from '../state/useAnalysis.ts';
import { indexAt, type WindowMetrics } from '../lib/analysis.ts';
import { planningIndex } from '../lib/scoring.ts';
import { DAY, fmtDur, fmtUTC } from '../lib/format.ts';
import { SITES } from '../lib/sites.ts';
import { Delta, InfoTip, Label, ProvBadge, Seg } from './ui.tsx';
import { VisibilityStrip } from './VisibilityStrip.tsx';

const DELAYS = [0, 1, 7, 14, 30];

export function WhatIf() {
  const { state, set, site, siteById } = useStore();
  const base = usePrimary();
  const w = state.whatIf;
  const altSite = w.altSiteId ? siteById(w.altSiteId) : site;
  const modLanding = state.landingMs + w.delayDays * DAY;
  const modDuration = state.durationDays + w.extendDays;
  const mod = useScenarioAnalysis({ site: altSite, landingMs: modLanding, durationDays: modDuration });
  const setW = (p: Partial<typeof w>) => set({ whatIf: { ...w, ...p } });
  const unchanged = w.delayDays === 0 && w.extendDays === 0 && altSite.id === site.id;

  const spanDays = Math.max(state.durationDays, modDuration);
  const chart = useMemo(() => buildOverlay(base, state.landingMs, mod, modLanding, spanDays), [base, mod, state.landingMs, modLanding, spanDays]);
  const piA = planningIndex(base.metrics, state.weights), piB = planningIndex(mod.metrics, state.weights);
  const story = narrative(base.metrics, mod.metrics, w.delayDays, altSite.name !== site.name ? altSite.name : null, w.extendDays);

  return (
    <section className="panel relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(800px_300px_at_10%_0%,rgba(245,184,46,0.08),transparent),radial-gradient(800px_300px_at_90%_100%,rgba(34,211,238,0.08),transparent)]" />
      <div className="h-px bg-gradient-to-r from-sun via-earth to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <FlaskRound className="text-sun" size={20} />
            <span className="bg-gradient-to-r from-sun-soft to-earth-soft bg-clip-text text-transparent">What If? Mission Simulator</span>
          </h2>
          <p className="text-[12.5px] text-ink-mute">Delay the landing, switch sites or extend the mission, then compare the visibility windows instantly.</p>
        </div>
        <button className="btn" onClick={() => setW({ delayDays: 0, altSiteId: null, extendDays: 0 })}><RotateCcw size={13} /> Reset</button>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div>
            <Label>Landing delay</Label>
            <Seg value={w.delayDays} onChange={(v) => setW({ delayDays: v })} options={DELAYS.map((d) => ({ v: d, label: d === 0 ? 'None' : `+${d} d` }))} />
          </div>
          <div>
            <Label>Landing site</Label>
            <select className="field" value={w.altSiteId ?? ''} onChange={(e) => setW({ altSiteId: e.target.value || null })}>
              <option value="">Same as plan ({site.name})</option>
              {SITES.filter((s) => s.id !== site.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Extend mission duration</Label>
            <div className="flex items-center gap-3">
              <input type="range" className="sun" min={0} max={30} value={w.extendDays} onChange={(e) => setW({ extendDays: +e.target.value })} />
              <span className="w-14 text-right font-mono text-sm">+{w.extendDays} d</span>
            </div>
          </div>
          <div className="rounded-lg border border-edge bg-void/50 p-3 font-mono text-[11px] leading-relaxed">
            <div className="text-ink-faint">ORIGINAL</div>
            <div className="text-ink">{site.name}</div>
            <div className="text-ink-mute">{fmtUTC(state.landingMs)} · {state.durationDays} d</div>
            <ArrowRight size={14} className="my-1 text-earth" />
            <div className="text-ink-faint">MODIFIED</div>
            <div className="text-sun-soft">{altSite.name}</div>
            <div className="text-ink-mute">{fmtUTC(modLanding)} · {modDuration} d</div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className={`flex gap-2 rounded-lg border px-3 py-2.5 text-[13px] leading-snug ${unchanged ? 'border-edge text-ink-mute' : 'border-earth/30 bg-earth/5 text-ink'}`}>
            <Sparkles size={16} className="mt-0.5 shrink-0 text-earth" />
            <span>{unchanged ? 'Pick a delay, alternative site or extension to see the impact.' : story}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12.5px]">
              <thead className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
                <tr><th className="py-1.5 font-medium">Metric</th><th className="font-medium">Original</th><th className="font-medium">Modified</th><th className="font-medium">Change</th></tr>
              </thead>
              <tbody className="divide-y divide-edge/60 font-mono">
                <Row label="Sun above horizon" a={base.metrics.sunPct} b={mod.metrics.sunPct} pct cls="text-sun-soft" />
                <Row label="Earth visible" a={base.metrics.earthPct} b={mod.metrics.earthPct} pct cls="text-earth-soft" />
                <Row label="Sun + Earth" a={base.metrics.bothPct} b={mod.metrics.bothPct} pct />
                <Row label="Longest darkness" a={base.metrics.longestDarkH} b={mod.metrics.longestDarkH} hours better="down" />
                <Row label="Longest comm blackout" a={base.metrics.longestBlackoutH} b={mod.metrics.longestBlackoutH} hours better="down" />
                <Row label="Mean solar-disk visibility" a={base.metrics.meanSunDisk * 100} b={mod.metrics.meanSunDisk * 100} pct />
                <Row label={<span className="inline-flex items-center gap-1">Planning index <InfoTip topic="index" /></span>} a={piA} b={piB} />
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Visibility windows · mission elapsed time</span>
              <div className="flex gap-1"><ProvBadge p={mod.series.provenance} /><ProvBadge p={mod.mask.provenance} extra={mod.mask.label} /></div>
            </div>
            <div className="space-y-2 rounded-lg border border-edge/60 bg-void/40 p-3">
              <div className="font-mono text-[10px] text-ink-faint">ORIGINAL · {site.name}</div>
              <VisibilityStrip series={base.series} vis={base.vis} start={state.landingMs} end={state.landingMs + spanDays * DAY} compact />
              <div className="pt-1 font-mono text-[10px] text-sun-soft">MODIFIED · {altSite.name}</div>
              <VisibilityStrip series={mod.series} vis={mod.vis} start={modLanding} end={modLanding + spanDays * DAY} compact />
              <div className="flex justify-between pl-9 font-mono text-[9.5px] text-ink-faint">
                {Array.from({ length: 6 }, (_, k) => <span key={k}>MET {Math.round((spanDays * k) / 5)} d</span>)}
              </div>
            </div>
          </div>

          <div className="h-[200px]">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 4, right: 10, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="2 4" />
                <XAxis dataKey="met" type="number" domain={[0, spanDays]} tickFormatter={(v: number) => `${v.toFixed(0)} d`} stroke="#1a2a47" />
                <YAxis stroke="#1a2a47" tickFormatter={(v: number) => `${v}°`} width={48} />
                <Tooltip contentStyle={{ background: 'rgba(7,13,26,0.95)', border: '1px solid #1a2a47', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11 }}
                  labelFormatter={(v: number) => `MET ${v.toFixed(2)} d`} formatter={(v: number, n: string) => [`${v.toFixed(2)}°`, n]} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Line dataKey="sunA" name="Sun · original" stroke="#f5b82e" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                <Line dataKey="sunB" name="Sun · modified" stroke="#ffd770" dot={false} strokeWidth={1.8} strokeDasharray="5 4" isAnimationActive={false} />
                <Line dataKey="earthA" name="Earth · original" stroke="#22d3ee" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                <Line dataKey="earthB" name="Earth · modified" stroke="#7ce8fa" dot={false} strokeWidth={1.8} strokeDasharray="5 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, a, b, pct, hours, better = 'up', cls = 'text-ink' }: {
  label: React.ReactNode; a: number; b: number; pct?: boolean; hours?: boolean; better?: 'up' | 'down'; cls?: string;
}) {
  const f = (v: number) => (hours ? (v === 0 ? 'None' : fmtDur(v)) : pct ? `${v.toFixed(1)}%` : v.toFixed(1));
  return (
    <tr>
      <td className="py-1.5 font-sans text-ink-mute">{label}</td>
      <td className={cls}>{f(a)}</td>
      <td className={cls}>{f(b)}</td>
      <td><Delta value={b - a} unit={hours ? ' h' : pct ? ' pt' : ''} better={better} /></td>
    </tr>
  );
}

function buildOverlay(a: ScenarioAnalysis, la: number, b: ScenarioAnalysis, lb: number, spanDays: number) {
  const N = 400;
  const out = [];
  for (let k = 0; k <= N; k++) {
    const met = (spanDays * k) / N;
    const ia = indexAt(a.series, la + met * DAY), ib = indexAt(b.series, lb + met * DAY);
    out.push({ met, sunA: a.series.sunEl[ia], sunB: b.series.sunEl[ib], earthA: a.series.earthEl[ia], earthB: b.series.earthEl[ib] });
  }
  return out;
}

function narrative(a: WindowMetrics, b: WindowMetrics, delay: number, newSite: string | null, extend: number) {
  const parts: string[] = [];
  if (delay) parts.push(`delaying the landing by ${delay} day${delay > 1 ? 's' : ''}`);
  if (newSite) parts.push(`moving to ${newSite}`);
  if (extend) parts.push(`extending the mission by ${extend} day${extend > 1 ? 's' : ''}`);
  const what = parts.join(', ').replace(/, ([^,]*)$/, ' and $1');
  const d = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)} pts`;
  const dB = b.bothPct - a.bothPct;
  let s = `${what[0].toUpperCase()}${what.slice(1)} changes sunlight ${d(b.sunPct - a.sunPct)}, Earth visibility ${d(b.earthPct - a.earthPct)} and simultaneous coverage ${d(dB)}.`;
  const dk = b.longestDarkH - a.longestDarkH, bl = b.longestBlackoutH - a.longestBlackoutH;
  if (Math.abs(dk) >= 1) s += ` Longest darkness ${dk > 0 ? 'grows' : 'shrinks'} from ${a.longestDarkH ? fmtDur(a.longestDarkH) : 'none'} to ${b.longestDarkH ? fmtDur(b.longestDarkH) : 'none'}.`;
  if (Math.abs(bl) >= 1) s += ` Longest comm blackout ${bl > 0 ? 'grows' : 'shrinks'} from ${a.longestBlackoutH ? fmtDur(a.longestBlackoutH) : 'none'} to ${b.longestBlackoutH ? fmtDur(b.longestBlackoutH) : 'none'}.`;
  if (dB <= -10 || dk >= 24 || bl >= 24) s += ' ⚠ This is a significant operational degradation.';
  else if (dB >= 10) s += ' ✓ This materially improves the operating windows.';
  return s;
}
