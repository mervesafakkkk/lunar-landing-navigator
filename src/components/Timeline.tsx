import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, ChartSpline, Pause, Play, Rocket } from 'lucide-react';
import { rangeMs, useStore, type ViewRange } from '../state/store.tsx';
import { usePrimary } from '../state/primary.tsx';
import { crossings, indexAt } from '../lib/analysis.ts';
import { DAY, HOUR, fmtShortUTC, fmtUTC } from '../lib/format.ts';
import { Card, ProvBadge, Seg } from './ui.tsx';
import { VisibilityStrip } from './VisibilityStrip.tsx';

const SPEEDS = [
  { v: 1, label: '1 h/s' },
  { v: 6, label: '6 h/s' },
  { v: 24, label: '1 d/s' },
];

export function Timeline() {
  const { state, set, setCursor } = useStore();
  const { series, vis, mask, missionEnd } = usePrimary();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const len = rangeMs(state.viewRange);
  const dataStart = series.t[0], dataEnd = series.t[series.t.length - 1];
  const vs = Math.max(dataStart, Math.min(state.viewStartMs, dataEnd - len));
  const ve = vs + len;

  const data = useMemo(() => {
    const i0 = indexAt(series, vs), i1 = indexAt(series, ve);
    const stride = Math.max(1, Math.floor((i1 - i0) / 600));
    const out = [];
    const terrain = mask.kind !== 'geometric';
    for (let i = i0; i <= i1; i += stride) {
      out.push({
        t: series.t[i], sun: +series.sunEl[i].toFixed(3), earth: +series.earthEl[i].toFixed(3),
        ...(terrain ? { sunH: +vis.sunHorizon[i].toFixed(2), earthH: +vis.earthHorizon[i].toFixed(2) } : {}),
      });
    }
    return out;
  }, [series, vis, mask, vs, ve]);

  const events = useMemo(() => crossings(series, vis, Math.max(vs, state.cursorMs), ve).slice(0, 10), [series, vis, vs, ve, state.cursorMs]);

  // playback
  const last = useRef<number | null>(null);
  const cursorRef = useRef(state.cursorMs);
  cursorRef.current = state.cursorMs;
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        const next = cursorRef.current + ((now - last.current) / 1000) * speed * HOUR;
        if (next >= dataEnd) { setPlaying(false); setCursor(dataEnd); return; }
        setCursor(next);
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, dataEnd, setCursor]);

  const tickFmt = (t: number) => {
    const d = new Date(t);
    if (state.viewRange === '24h') return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
    return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`;
  };
  const ticks = useMemo(() => {
    const stepT = state.viewRange === '24h' ? 3 * HOUR : state.viewRange === '7d' ? DAY : 3 * DAY;
    const first = Math.ceil(vs / stepT) * stepT;
    const out = [];
    for (let t = first; t <= ve; t += stepT) out.push(t);
    return out;
  }, [vs, ve, state.viewRange]);

  const shiftView = (dir: number) => set({ viewStartMs: Math.max(dataStart, Math.min(dataEnd - len, vs + dir * len)), cursorMs: Math.max(dataStart, Math.min(dataEnd, state.cursorMs + dir * len)) });

  return (
    <Card
      title="Interactive Timeline"
      icon={<ChartSpline size={14} className="text-earth" />}
      right={<div className="flex items-center gap-2"><ProvBadge p={series.provenance} /><span className="hidden font-mono text-[10px] text-ink-faint md:inline">step {series.stepMs / 60000} min</span></div>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg value={state.viewRange} onChange={(v: ViewRange) => set({ viewRange: v, viewStartMs: Math.max(dataStart, state.cursorMs - rangeMs(v) / 2) })}
          options={[{ v: '24h', label: '24 h' }, { v: '7d', label: '7 days' }, { v: '30d', label: '30 days' }]} />
        <div className="flex gap-1">
          <button className="btn" onClick={() => shiftView(-1)} aria-label="Previous window"><ChevronLeft size={14} /></button>
          <button className="btn" onClick={() => shiftView(1)} aria-label="Next window"><ChevronRight size={14} /></button>
        </div>
        <button className="btn" onClick={() => set({ cursorMs: state.landingMs, viewStartMs: state.landingMs })}><Rocket size={13} /> Landing</button>
        <div className="ml-auto flex items-center gap-2">
          <button className={`btn ${playing ? 'btn-primary' : ''} min-w-[84px]`} onClick={() => setPlaying((p) => !p)}>
            {playing ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Animate</>}
          </button>
          <Seg size="xs" value={speed} onChange={setSpeed} options={SPEEDS} />
        </div>
      </div>

      <div className="h-[230px] w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            onClick={(e) => { if (e && typeof e.activeLabel === 'number') setCursor(e.activeLabel); }}>
            <CartesianGrid strokeDasharray="2 4" />
            <XAxis dataKey="t" type="number" domain={[vs, ve]} ticks={ticks} tickFormatter={tickFmt} stroke="#1a2a47" allowDataOverflow />
            <YAxis stroke="#1a2a47" tickFormatter={(v: number) => `${v}°`} domain={['auto', 'auto']} width={48} />
            <ReferenceArea x1={Math.max(vs, state.landingMs)} x2={Math.min(ve, missionEnd)} fill="#22d3ee" fillOpacity={0.04} ifOverflow="hidden" />
            <ReferenceLine y={0} stroke="#e6edf7" strokeOpacity={0.35} strokeDasharray="3 3" label={{ value: 'geometric horizon', position: 'insideBottomLeft', fill: '#566b8c', fontSize: 9 }} />
            {state.landingMs >= vs && state.landingMs <= ve && <ReferenceLine x={state.landingMs} stroke="#34d399" strokeDasharray="4 3" label={{ value: 'LANDING', position: 'insideTopLeft', fill: '#34d399', fontSize: 9 }} />}
            {missionEnd >= vs && missionEnd <= ve && <ReferenceLine x={missionEnd} stroke="#ff8a3d" strokeDasharray="4 3" label={{ value: 'MISSION END', position: 'insideTopRight', fill: '#ff8a3d', fontSize: 9 }} />}
            {mask.kind !== 'geometric' && <Line dataKey="sunH" stroke="#8a6a1f" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="Terrain at Sun az" />}
            {mask.kind !== 'geometric' && <Line dataKey="earthH" stroke="#0e6d80" dot={false} strokeWidth={1} strokeDasharray="3 3" isAnimationActive={false} name="Terrain at Earth az" />}
            <Line dataKey="sun" stroke="#f5b82e" dot={false} strokeWidth={2} isAnimationActive={false} name="Sun elevation" />
            <Line dataKey="earth" stroke="#22d3ee" dot={false} strokeWidth={2} isAnimationActive={false} name="Earth elevation" />
            <ReferenceLine x={state.cursorMs} stroke="#ffffff" strokeWidth={1.5} />
            <Tooltip
              contentStyle={{ background: 'rgba(7,13,26,0.95)', border: '1px solid #1a2a47', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11 }}
              labelFormatter={(t: number) => fmtUTC(t)}
              formatter={(v: number, n: string) => [`${v.toFixed(2)}°`, n]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 pr-[12px]">
        <VisibilityStrip series={series} vis={vis} start={vs} end={ve} cursor={state.cursorMs} onPick={setCursor} />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="font-mono text-[10.5px] text-ink-faint">{fmtShortUTC(vs)}</span>
        <input type="range" min={vs} max={ve} step={(ve - vs) / 2000} value={Math.min(ve, Math.max(vs, state.cursorMs))} onChange={(e) => set({ cursorMs: +e.target.value })} aria-label="Time cursor" />
        <span className="font-mono text-[10.5px] text-ink-faint">{fmtShortUTC(ve)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-[10.5px] uppercase tracking-wider text-ink-faint">Upcoming in view:</span>
        {events.length === 0 && <span className="font-mono text-[11px] text-ink-faint">no rise/set events</span>}
        {events.map((e) => (
          <button key={`${e.t}${e.body}`} onClick={() => setCursor(e.t)}
            className={`rounded-md border px-2 py-0.5 font-mono text-[10.5px] transition hover:brightness-125 ${
              e.body === 'sun' ? (e.kind === 'rise' ? 'border-sun/40 text-sun' : 'border-risk/40 text-risk') : e.kind === 'rise' ? 'border-earth/40 text-earth' : 'border-risk-warn/40 text-risk-warn'
            }`}>
            {e.body === 'sun' ? (e.kind === 'rise' ? 'Sunrise' : 'Sunset') : e.kind === 'rise' ? 'Earthrise' : 'Earthset'} · {fmtShortUTC(e.t)}
          </button>
        ))}
      </div>
    </Card>
  );
}
