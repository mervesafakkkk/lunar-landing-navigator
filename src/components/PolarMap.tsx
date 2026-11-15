import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { geometryGrid } from '../lib/providers/analytic.ts';
import { moonGeometry } from '../lib/astro/ephemeris.ts';
import { azEl, siteFrame } from '../lib/astro/topocentric.ts';
import { loadDem } from '../lib/providers/lola.ts';
import { SITES, makeCustomSite, fmtLatLon } from '../lib/sites.ts';
import { DAY, HOUR, fmtUTC } from '../lib/format.ts';
import { COMPARE_COLORS } from '../lib/colors.ts';
import { ProvBadge, Seg } from './ui.tsx';

type Layer = 'shadow' | 'sun' | 'earth' | 'both';
const SIZE = 520, R = 240, C = SIZE / 2, GRID = 64, SHADOW_PX = 420;
const RAD = Math.PI / 180;

/**
 * South-polar stereographic map (same projection as the LOLA polar DEM),
 * 0°E at the top, 90°E to the right.
 */
export function PolarMap() {
  const { state, site, set, siteById } = useStore();
  const [extent, setExtent] = useState(10);
  const [layer, setLayer] = useState<Layer>('shadow');
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [cov, setCov] = useState<{ sun: Float32Array; earth: Float32Array; both: Float32Array } | null>(null);
  const [shadowBusy, setShadowBusy] = useState(false);
  const [shadowErr, setShadowErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLCanvasElement>(null);
  const worker = useRef<Worker | null>(null);
  const reqId = useRef(0);

  const tExt = Math.tan((extent * RAD) / 2);
  const project = (lat: number, lon: number) => {
    const r = (Math.tan(((90 + lat) * RAD) / 2) / tExt) * R;
    return { x: C + r * Math.sin(lon * RAD), y: C - r * Math.cos(lon * RAD), inside: 90 + lat <= extent };
  };
  const unproject = (x: number, y: number) => {
    const dx = x - C, dy = C - y;
    const r = Math.hypot(dx, dy);
    return { lat: -90 + (2 * Math.atan((r / R) * tExt)) / RAD, lon: Math.atan2(dx, dy) / RAD, inside: r <= R };
  };

  // ---- LOLA shadow layer (web worker) ------------------------------------------------
  useEffect(() => {
    const w = new Worker(new URL('../workers/shadow.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    loadDem()
      .then((dem) => w.postMessage({ type: 'init', buf: dem.h.slice().buffer }))
      .catch((e: Error) => setShadowErr(e.message));
    w.onmessage = (e: MessageEvent<{ id: number; size: number; out: Float32Array }>) => {
      if (e.data.id !== reqId.current) return;
      setShadowBusy(false);
      const cv = shadowRef.current;
      if (!cv) return;
      const { size, out } = e.data;
      cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d')!;
      const img = ctx.createImageData(size, size);
      for (let k = 0; k < out.length; k++) {
        const v = out[k];
        if (v < 0) continue;
        if (v === 0) img.data.set([6, 10, 22, 255], k * 4);
        else {
          const g = Math.min(1, 0.25 + v * 0.95);
          img.data.set([Math.round(225 * g + 20), Math.round(212 * g + 16), Math.round(185 * g + 10), 255], k * 4);
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (layer !== 'shadow' || shadowErr) return;
    const id = setTimeout(() => {
      const g = moonGeometry(state.cursorMs);
      reqId.current += 1;
      setShadowBusy(true);
      worker.current?.postMessage({ type: 'render', id: reqId.current, sun: g.sun, extentDeg: extent, size: SHADOW_PX });
    }, 60);
    return () => clearTimeout(id);
  }, [layer, extent, state.cursorMs, shadowErr]);

  // ---- geometric coverage layers ------------------------------------------------------
  const covKey = `${extent}|${state.landingMs}|${state.durationDays}|${state.commMinEl}`;
  useEffect(() => {
    if (layer === 'shadow') return;
    setCov(null);
    const id = setTimeout(() => {
      const geom = geometryGrid(state.landingMs, state.landingMs + state.durationDays * DAY, state.durationDays > 20 ? 2 * HOUR : HOUR);
      const sun = new Float32Array(GRID * GRID).fill(NaN), earth = new Float32Array(GRID * GRID).fill(NaN), both = new Float32Array(GRID * GRID).fill(NaN);
      for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
        const u = unproject(((i + 0.5) / GRID) * SIZE, ((j + 0.5) / GRID) * SIZE);
        if (!u.inside) continue;
        const f = siteFrame(u.lat, u.lon);
        let s = 0, e = 0, b = 0;
        for (const g of geom) {
          const su = azEl(f, g.sun).el > 0, ea = azEl(f, g.earth).el > state.commMinEl;
          s += +su; e += +ea; b += +(su && ea);
        }
        const k = j * GRID + i;
        sun[k] = s / geom.length; earth[k] = e / geom.length; both[k] = b / geom.length;
      }
      setCov({ sun, earth, both });
    }, 30);
    return () => clearTimeout(id);
  }, [covKey, layer === 'shadow']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cov || layer === 'shadow') return;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(GRID, GRID);
    const data = cov[layer];
    for (let k = 0; k < GRID * GRID; k++) {
      const v = data[k];
      if (Number.isNaN(v)) continue;
      img.data.set([...ramp(layer, v), 235], k * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [cov, layer]);

  const sub = useMemo(() => {
    const g = moonGeometry(state.cursorMs);
    return { sunLon: Math.atan2(g.sun[1], g.sun[0]) / RAD, earthLon: Math.atan2(g.earth[1], g.earth[0]) / RAD };
  }, [state.cursorMs]);

  const all = state.custom ? [...SITES, state.custom] : SITES;
  const compare = state.compareIds.map(siteById);
  const rings = [1, 2, 3, 4, 5].map((k) => (extent / 5) * k);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const u = unproject(((e.clientX - b.left) / b.width) * SIZE, ((e.clientY - b.top) / b.height) * SIZE);
    setHover(u.inside ? { lat: u.lat, lon: u.lon } : null);
  };
  const onClick = () => { if (hover) set({ custom: makeCustomSite(+hover.lat.toFixed(4), +hover.lon.toFixed(4)), siteId: 'custom' }); };
  const ray = (lon: number, len: number) => ({ x: C + len * Math.sin(lon * RAD), y: C - len * Math.cos(lon * RAD) });
  const sunTip = ray(sub.sunLon, R + 18), earthTip = ray(sub.earthLon, R + 18);
  const clip = { clipPath: `circle(${(R / SIZE) * 100}% at 50% 50%)` };

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-2">
        <Seg size="xs" value={layer} onChange={setLayer} options={[{ v: 'shadow', label: 'LOLA shadows (now)' }, { v: 'sun', label: 'Sunlit %' }, { v: 'earth', label: 'Earth %' }, { v: 'both', label: 'Both %' }]} />
        <Seg size="xs" value={extent} onChange={setExtent} options={[{ v: 3, label: '87°S' }, { v: 6, label: '84°S' }, { v: 10, label: '80°S' }, { v: 14, label: '76°S' }]} />
      </div>
      <div className="absolute bottom-3 left-3 z-10 max-w-[270px] rounded-md border border-edge/70 bg-void/80 p-2 text-[10px] leading-snug text-ink-faint backdrop-blur">
        {layer === 'shadow' ? (
          <>
            <div className="mb-1 flex items-center gap-1.5"><ProvBadge p="derived" /> {shadowBusy && <Loader2 size={11} className="animate-spin text-earth" />}</div>
            Sunlight and terrain shadows at <span className="text-ink-mute">{fmtUTC(state.cursorMs)}</span>, ray-traced over NASA LOLA topography (480 m). Animate the timeline to watch the shadows sweep around the pole.
            {shadowErr && <div className="mt-1 text-risk">DEM unavailable: {shadowErr}</div>}
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-1.5"><ProvBadge p="computed" /> <span>geometric horizon only</span></div>
            Coverage over the {state.durationDays}-day mission window, terrain ignored. Compare with the LOLA shadow layer to see how much terrain matters.
            <Legend layer={layer} />
          </>
        )}
        <div className="mt-1">Click the map to drop a site.</div>
      </div>
      {hover && (
        <div className="absolute right-3 top-3 z-10 rounded-md border border-edge bg-void/85 px-2 py-1 font-mono text-[10.5px] text-ink-mute">{fmtLatLon(hover.lat, hover.lon)}</div>
      )}
      <div className="flex h-full items-center justify-center p-2">
        <div className="relative aspect-square h-full max-h-full max-w-full">
          <canvas ref={shadowRef} className={`absolute inset-0 h-full w-full ${layer === 'shadow' ? '' : 'hidden'}`} style={clip} />
          <canvas ref={canvasRef} width={GRID} height={GRID} className={`absolute inset-0 h-full w-full ${layer === 'shadow' ? 'hidden' : ''}`} style={clip} />
          {layer !== 'shadow' && !cov && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-earth" /></div>}
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="#22d3ee" strokeOpacity={0.4} />
            {rings.map((d) => {
              const rr = (Math.tan((d * RAD) / 2) / tExt) * R;
              return (
                <g key={d}>
                  <circle cx={C} cy={C} r={rr} fill="none" stroke="#e6edf7" strokeOpacity={0.14} strokeDasharray="2 4" />
                  <text x={C + 3} y={C - rr - 3} fontSize={9} className="fill-ink-mute font-mono" stroke="#03060d" strokeWidth={2.5} paintOrder="stroke">{(-90 + d).toFixed(d % 1 ? 1 : 0)}°</text>
                </g>
              );
            })}
            {Array.from({ length: 12 }, (_, k) => k * 30).map((lon) => {
              const p = ray(lon, R), t = ray(lon, R + 11);
              return (
                <g key={lon}>
                  <line x1={C} y1={C} x2={p.x} y2={p.y} stroke="#e6edf7" strokeOpacity={0.08} />
                  <text x={t.x} y={t.y + 3} textAnchor="middle" fontSize={9} className="fill-ink-faint font-mono">{lon > 180 ? `${360 - lon}°W` : lon === 180 ? '180°' : `${lon}°E`}</text>
                </g>
              );
            })}
            <line x1={C} y1={C} x2={sunTip.x} y2={sunTip.y} stroke="#f5b82e" strokeOpacity={0.5} strokeDasharray="6 4" />
            <circle cx={sunTip.x} cy={sunTip.y} r={6} fill="#f5b82e"><title>Direction of the Sun (sub-solar longitude)</title></circle>
            <line x1={C} y1={C} x2={earthTip.x} y2={earthTip.y} stroke="#22d3ee" strokeOpacity={0.5} strokeDasharray="6 4" />
            <circle cx={earthTip.x} cy={earthTip.y} r={5} fill="#22d3ee"><title>Direction of Earth (sub-Earth longitude)</title></circle>

            {all.map((s) => {
              const p = project(s.lat, s.lon);
              if (!p.inside) return null;
              const ci = compare.findIndex((c) => c.id === s.id);
              const selected = s.id === site.id;
              const col = selected ? '#ffffff' : ci >= 0 ? COMPARE_COLORS[ci] : '#c7d0de';
              return (
                <g key={s.id} onClick={(e) => { e.stopPropagation(); set({ siteId: s.id }); }} className="cursor-pointer">
                  {selected && <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="#22d3ee" strokeWidth={2} className="pulse-ring" />}
                  <circle cx={p.x} cy={p.y} r={selected ? 5 : 3.5} fill={col} stroke="#03060d" strokeWidth={1.5} />
                  <text x={p.x + 8} y={p.y + 3} fontSize={10.5} fontWeight={selected ? 700 : 500} fill={col} stroke="#03060d" strokeWidth={3} paintOrder="stroke" className="font-sans">{s.name.split(' · ')[0]}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

function ramp(layer: Exclude<Layer, 'shadow'>, v: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, v));
  const end = layer === 'sun' ? [245, 184, 46] : layer === 'earth' ? [34, 211, 238] : [230, 237, 247];
  const start = [10, 16, 30];
  const g = Math.pow(t, 0.8);
  return [start[0] + (end[0] - start[0]) * g, start[1] + (end[1] - start[1]) * g, start[2] + (end[2] - start[2]) * g];
}

function Legend({ layer }: { layer: Exclude<Layer, 'shadow'> }) {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((v) => `rgb(${ramp(layer, v).join(',')}) ${v * 100}%`).join(',');
  return (
    <div className="mt-1.5">
      <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="mt-0.5 flex justify-between font-mono text-[9px]"><span>0%</span><span>50%</span><span>100%</span></div>
    </div>
  );
}
