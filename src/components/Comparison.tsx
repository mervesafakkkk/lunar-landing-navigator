import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GitCompareArrows, Scale } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { useScenarioAnalysis, type ScenarioAnalysis } from '../state/useAnalysis.ts';
import { CRITERIA, DEFAULT_WEIGHTS, planningIndex } from '../lib/scoring.ts';
import { DAY, fmtDur } from '../lib/format.ts';
import { SITES, fmtLatLon, type Site } from '../lib/sites.ts';
import { COMPARE_COLORS } from '../lib/colors.ts';
import { Card, InfoTip, ProvBadge } from './ui.tsx';
import { VisibilityStrip } from './VisibilityStrip.tsx';

export function Comparison() {
  const { state, set, siteById, allSites } = useStore();
  const ids = state.compareIds;
  const sites = ids.map(siteById);
  // Hooks are called a fixed number of times (3); unused slots repeat the first site.
  const pad = (i: number): Site => sites[i] ?? sites[0] ?? SITES[0];
  const scen = { landingMs: state.landingMs, durationDays: state.durationDays };
  const r0 = useScenarioAnalysis({ site: pad(0), ...scen });
  const r1 = useScenarioAnalysis({ site: pad(1), ...scen });
  const r2 = useScenarioAnalysis({ site: pad(2), ...scen });
  const results: ScenarioAnalysis[] = [r0, r1, r2].slice(0, sites.length);
  const pis = results.map((r) => planningIndex(r.metrics, state.weights));

  const setSlot = (i: number, id: string) => {
    const next = [...ids];
    if (id === '') next.splice(i, 1);
    else next[i] = id;
    set({ compareIds: Array.from(new Set(next)).slice(0, 3) });
  };

  const bars = [
    { k: 'Sunlit %', ...Object.fromEntries(results.map((r, i) => [`s${i}`, +r.metrics.sunPct.toFixed(1)])) },
    { k: 'Earth visible %', ...Object.fromEntries(results.map((r, i) => [`s${i}`, +r.metrics.earthPct.toFixed(1)])) },
    { k: 'Both %', ...Object.fromEntries(results.map((r, i) => [`s${i}`, +r.metrics.bothPct.toFixed(1)])) },
    { k: 'Planning index', ...Object.fromEntries(pis.map((p, i) => [`s${i}`, +p.toFixed(1)])) },
  ];

  const best = (vals: number[], dir: 'up' | 'down') => {
    const v = dir === 'up' ? Math.max(...vals) : Math.min(...vals);
    return vals.map((x) => vals.length > 1 && Math.abs(x - v) < 1e-9);
  };

  return (
    <Card title="Landing Site Comparison" icon={<GitCompareArrows size={14} className="text-earth" />} right={<InfoTip topic="index" align="right" />}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-void/40 p-2" style={{ borderColor: sites[i] ? `${COMPARE_COLORS[i]}66` : '#1a2a47' }}>
            <select className="field border-0 bg-transparent px-0 font-sans text-sm" style={{ color: sites[i] ? COMPARE_COLORS[i] : '#8da2c0' }}
              value={ids[i] ?? ''} onChange={(e) => setSlot(i, e.target.value)} disabled={i > ids.length}>
              <option value="">{i === 0 ? 'Select site…' : '— none —'}</option>
              {allSites.map((s) => <option key={s.id} value={s.id} disabled={ids.includes(s.id) && ids[i] !== s.id}>{s.name}</option>)}
            </select>
            {sites[i] && <div className="font-mono text-[10.5px] text-ink-faint">{fmtLatLon(sites[i].lat, sites[i].lon)}</div>}
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th className="py-1.5 font-medium">Criterion</th>
                  {sites.map((s, i) => <th key={s.id} className="font-medium" style={{ color: COMPARE_COLORS[i] }}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/60 font-mono">
                <MetricRow label="Illumination availability" vals={results.map((r) => r.metrics.sunPct)} fmt={(v) => `${v.toFixed(1)}%`} hi={best(results.map((r) => r.metrics.sunPct), 'up')} />
                <MetricRow label="Communication availability" vals={results.map((r) => r.metrics.earthPct)} fmt={(v) => `${v.toFixed(1)}%`} hi={best(results.map((r) => r.metrics.earthPct), 'up')} />
                <MetricRow label="Simultaneous Sun + Earth" vals={results.map((r) => r.metrics.bothPct)} fmt={(v) => `${v.toFixed(1)}%`} hi={best(results.map((r) => r.metrics.bothPct), 'up')} />
                <MetricRow label="Longest darkness" vals={results.map((r) => r.metrics.longestDarkH)} fmt={(v) => (v ? fmtDur(v) : 'None')} hi={best(results.map((r) => r.metrics.longestDarkH), 'down')} />
                <MetricRow label="Longest comm blackout" vals={results.map((r) => r.metrics.longestBlackoutH)} fmt={(v) => (v ? fmtDur(v) : 'None')} hi={best(results.map((r) => r.metrics.longestBlackoutH), 'down')} />
                <MetricRow label="Mean solar-disk visibility" vals={results.map((r) => r.metrics.meanSunDisk * 100)} fmt={(v) => `${v.toFixed(1)}%`} hi={best(results.map((r) => r.metrics.meanSunDisk), 'up')} />
                <tr className="bg-earth/5">
                  <td className="py-2 font-sans font-semibold text-ink">Planning index <span className="font-normal text-ink-faint">(heuristic)</span></td>
                  {pis.map((p, i) => (
                    <td key={i}>
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-base font-semibold" style={{ color: COMPARE_COLORS[i] }}>{p.toFixed(0)}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-edge/60"><div className="h-full rounded-full" style={{ width: `${p}%`, background: COMPARE_COLORS[i] }} /></div>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-3">
              <div className="h-[210px]">
                <ResponsiveContainer>
                  <BarChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="k" stroke="#1a2a47" />
                    <YAxis domain={[0, 100]} stroke="#1a2a47" />
                    <Tooltip cursor={{ fill: 'rgba(34,211,238,0.05)' }} contentStyle={{ background: 'rgba(7,13,26,0.95)', border: '1px solid #1a2a47', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {sites.map((s, i) => <Bar key={s.id} dataKey={`s${i}`} name={s.name} fill={COMPARE_COLORS[i]} radius={[3, 3, 0, 0]} isAnimationActive={false} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 rounded-lg border border-edge/60 bg-void/40 p-3">
                {results.map((r, i) => (
                  <div key={sites[i].id}>
                    <div className="mb-0.5 flex items-center justify-between font-mono text-[10px]" style={{ color: COMPARE_COLORS[i] }}>
                      <span>{sites[i].name}</span>
                      <span className="flex gap-1"><ProvBadge p={r.series.provenance} /><ProvBadge p={r.mask.provenance} extra={r.mask.label} /></span>
                    </div>
                    <VisibilityStrip series={r.series} vis={r.vis} start={state.landingMs} end={state.landingMs + state.durationDays * DAY} compact />
                  </div>
                ))}
              </div>
            </div>
            <WeightsPanel />
          </div>
        </>
      )}
      <p className="mt-3 text-[11px] leading-snug text-ink-faint">
        Comparison uses the same landing time, duration, ephemeris, horizon model and comm mask for every site. The planning index is a transparent, user-weighted heuristic for comparing scenarios inside this tool. <b className="text-ink-mute">It is not an official NASA feasibility determination.</b>
      </p>
    </Card>
  );
}

function MetricRow({ label, vals, fmt, hi }: { label: string; vals: number[]; fmt: (v: number) => string; hi: boolean[] }) {
  return (
    <tr>
      <td className="py-1.5 font-sans text-ink-mute">{label}</td>
      {vals.map((v, i) => <td key={i} className={hi[i] ? 'font-semibold text-ok' : 'text-ink'}>{fmt(v)}{hi[i] && ' ★'}</td>)}
    </tr>
  );
}

function WeightsPanel() {
  const { state, set } = useStore();
  const w = state.weights;
  return (
    <div className="rounded-lg border border-edge/70 bg-void/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint"><Scale size={12} /> Transparent criteria &amp; weights</span>
        <button className="text-[10.5px] text-earth hover:underline" onClick={() => set({ weights: DEFAULT_WEIGHTS })}>reset</button>
      </div>
      <div className="space-y-2.5">
        {CRITERIA.map((c) => (
          <div key={c.key}>
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-ink-mute" title={c.explain}>{c.label}</span>
              <span className="font-mono text-ink">×{w[c.key]}</span>
            </div>
            <input type="range" min={0} max={5} step={1} value={w[c.key]} onChange={(e) => set({ weights: { ...w, [c.key]: +e.target.value } })} aria-label={`Weight for ${c.label}`} />
            <div className="text-[10px] leading-tight text-ink-faint">{c.explain}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-edge/60 pt-2 font-mono text-[10px] text-ink-faint">index = Σ wᵢ·cᵢ / Σ wᵢ, each cᵢ ∈ [0, 100]</div>
    </div>
  );
}
