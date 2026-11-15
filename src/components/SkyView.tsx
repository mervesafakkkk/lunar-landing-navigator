import { useMemo } from 'react';
import { Telescope } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { usePrimary } from '../state/primary.tsx';
import { indexAt, sampleAt } from '../lib/analysis.ts';
import { HOUR, fmtUTC } from '../lib/format.ts';
import { Card, InfoTip, ProvBadge } from './ui.tsx';

const W = 960, H = 250, PADL = 34, PADR = 10, PADT = 14, PADB = 26;
const TRAIL_H = 36;

export function SkyView() {
  const { state } = useStore();
  const { series, mask } = usePrimary();
  const now = sampleAt(series, state.cursorMs);

  const { trails, yMin, yMax } = useMemo(() => {
    const i0 = indexAt(series, state.cursorMs - TRAIL_H * HOUR);
    const i1 = indexAt(series, state.cursorMs + TRAIL_H * HOUR);
    const stride = Math.max(1, Math.floor((i1 - i0) / 240));
    const sun: [number, number, number][] = [], earth: [number, number, number][] = [];
    let lo = -2, hi = 4;
    for (let i = i0; i <= i1; i += stride) {
      sun.push([series.sunAz[i], series.sunEl[i], series.t[i]]);
      earth.push([series.earthAz[i], series.earthEl[i], series.t[i]]);
      hi = Math.max(hi, series.sunEl[i], series.earthEl[i]);
      lo = Math.min(lo, series.sunEl[i], series.earthEl[i]);
    }
    for (let k = 0; k < 360; k++) hi = Math.max(hi, mask.elev[k]);
    return { trails: { sun, earth }, yMin: Math.max(-12, Math.floor(lo - 1)), yMax: Math.min(90, Math.ceil(hi + 1.5)) };
  }, [series, mask, state.cursorMs]);

  const x = (az: number) => PADL + (az / 360) * (W - PADL - PADR);
  const y = (el: number) => PADT + ((yMax - el) / (yMax - yMin)) * (H - PADT - PADB);
  const exaggeration = ((H - PADT - PADB) / (yMax - yMin)) / ((W - PADL - PADR) / 360);

  const terrainPath = useMemo(() => {
    let d = `M ${x(0)} ${y(yMin)}`;
    for (let a = 0; a <= 360; a++) d += ` L ${x(a)} ${y(mask.elev[a % 360])}`;
    return d + ` L ${x(360)} ${y(yMin)} Z`;
  }, [mask, yMin, yMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const trailPaths = (pts: [number, number, number][]) => {
    const past: string[] = [], future: string[] = [];
    let prev: [number, number, number] | null = null;
    for (const p of pts) {
      const target = p[2] <= state.cursorMs ? past : future;
      const jump = !prev || Math.abs(p[0] - prev[0]) > 180;
      target.push(`${jump || (prev && (prev[2] <= state.cursorMs) !== (p[2] <= state.cursorMs)) ? 'M' : 'L'} ${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`);
      prev = p;
    }
    return { past: past.join(' '), future: future.join(' ') };
  };
  const st = trailPaths(trails.sun), et = trailPaths(trails.earth);
  const sunUp = now.sunEl > maskElevation(mask.elev, now.sunAz);
  const earthUp = now.earthEl > maskElevation(mask.elev, now.earthAz) + state.commMinEl;

  const ticks = [];
  const stepY = yMax - yMin > 40 ? 15 : yMax - yMin > 15 ? 5 : yMax - yMin > 8 ? 2 : 1;
  for (let v = Math.ceil(yMin / stepY) * stepY; v <= yMax; v += stepY) ticks.push(v);

  return (
    <Card
      title="Lunar Horizon · Sun & Earth"
      icon={<Telescope size={14} className="text-earth" />}
      right={
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10.5px] text-ink-faint sm:inline">{fmtUTC(state.cursorMs)}</span>
          <ProvBadge p={mask.provenance} extra={mask.label} />
          <InfoTip topic="libration" align="right" />
        </div>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-edge/60"><div className="relative min-w-[640px] overflow-hidden bg-gradient-to-b from-[#02040a] to-[#060b16]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Panoramic view of the local horizon showing Sun and Earth positions">
          <defs>
            <radialGradient id="sunGlow"><stop offset="0%" stopColor="#fff3c4" /><stop offset="35%" stopColor="#f5b82e" stopOpacity="0.9" /><stop offset="100%" stopColor="#f5b82e" stopOpacity="0" /></radialGradient>
            <radialGradient id="earthGlow"><stop offset="0%" stopColor="#c8f6ff" /><stop offset="40%" stopColor="#22d3ee" stopOpacity="0.8" /><stop offset="100%" stopColor="#22d3ee" stopOpacity="0" /></radialGradient>
            <linearGradient id="terrain" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3a4456" /><stop offset="100%" stopColor="#0d121c" /></linearGradient>
            <pattern id="stars" width="120" height="80" patternUnits="userSpaceOnUse">
              {[[10, 12], [45, 30], [90, 8], [70, 60], [20, 70], [110, 45], [58, 15]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r={i % 3 === 0 ? 0.9 : 0.5} fill="#fff" opacity={0.35} />)}
            </pattern>
          </defs>
          <rect x={0} y={0} width={W} height={H} fill="url(#stars)" />

          {ticks.map((v) => (
            <g key={v}>
              <line x1={PADL} x2={W - PADR} y1={y(v)} y2={y(v)} stroke="#8da2c0" strokeOpacity={v === 0 ? 0 : 0.07} />
              <text x={PADL - 6} y={y(v) + 3} textAnchor="end" className="fill-ink-faint font-mono" fontSize={10}>{v}°</text>
            </g>
          ))}
          {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'].map((d, i) => (
            <g key={i}>
              <line x1={x(i * 45)} x2={x(i * 45)} y1={PADT} y2={H - PADB} stroke="#8da2c0" strokeOpacity={0.06} />
              <text x={x(i * 45)} y={H - 8} textAnchor="middle" className="fill-ink-mute font-mono" fontSize={10.5} fontWeight={600}>{d}</text>
            </g>
          ))}

          {/* trails */}
          <path d={st.past} fill="none" stroke="#f5b82e" strokeOpacity={0.35} strokeWidth={1.5} />
          <path d={st.future} fill="none" stroke="#f5b82e" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" />
          <path d={et.past} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeWidth={1.5} />
          <path d={et.future} fill="none" stroke="#22d3ee" strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="4 4" />

          {/* terrain + geometric horizon */}
          <path d={terrainPath} fill="url(#terrain)" stroke="#9aa6ba" strokeOpacity={0.6} strokeWidth={1} />
          <line x1={PADL} x2={W - PADR} y1={y(0)} y2={y(0)} stroke="#e6edf7" strokeOpacity={0.45} strokeDasharray="2 3" />
          <text x={W - PADR - 4} y={y(0) - 4} textAnchor="end" className="fill-ink-faint font-mono" fontSize={9}>GEOMETRIC HORIZON 0°</text>
          {state.commMinEl > 0 && (
            <path d={maskPath(mask.elev, state.commMinEl, x, y)} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="1 3" />
          )}

          {/* bodies */}
          <g transform={`translate(${x(now.earthAz)} ${y(now.earthEl)})`} opacity={earthUp ? 1 : 0.45}>
            <circle r={22} fill="url(#earthGlow)" opacity={earthUp ? 0.7 : 0.2} />
            <circle r={7} fill="#0e4f8a" stroke="#7ce8fa" strokeWidth={1.5} />
            <path d="M -4 -2 q 2 -3 5 -1 q 1 2 -1 3 q -3 0 -4 -2 Z M 1 3 q 2 0 3 -1" fill="#3fbf7f" opacity={0.9} />
            <text y={-14} textAnchor="middle" fontSize={10} className="fill-earth-soft font-mono" fontWeight={700}>EARTH</text>
          </g>
          <g transform={`translate(${x(now.sunAz)} ${y(now.sunEl)})`} opacity={sunUp ? 1 : 0.45}>
            <circle r={30} fill="url(#sunGlow)" opacity={sunUp ? 0.85 : 0.25} />
            <circle r={8} fill="#ffe08a" stroke="#fff6d5" strokeWidth={1} />
            <text y={-16} textAnchor="middle" fontSize={10} className="fill-sun-soft font-mono" fontWeight={700}>SUN</text>
          </g>
        </svg>
        <div className="pointer-events-none absolute left-11 top-2 flex flex-wrap gap-3 font-mono text-[10px] text-ink-faint">
          <span><span className="text-sun">━</span> Sun ±{TRAIL_H} h</span>
          <span><span className="text-earth">━</span> Earth ±{TRAIL_H} h</span>
          <span>solid = past · dashed = future</span>
          <span>vertical exaggeration ×{exaggeration.toFixed(0)}</span>
        </div>
      </div></div>
    </Card>
  );
}

function maskElevation(elev: Float32Array, az: number) {
  const a = ((az % 360) + 360) % 360, i = Math.floor(a), f = a - i;
  return elev[i] * (1 - f) + elev[(i + 1) % 360] * f;
}

function maskPath(elev: Float32Array, add: number, x: (a: number) => number, y: (e: number) => number) {
  let d = '';
  for (let a = 0; a <= 360; a++) d += `${a ? 'L' : 'M'} ${x(a)} ${y(elev[a % 360] + add)} `;
  return d;
}
