import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Crosshair, Database, Loader2, MapPin, Mountain, Pin, Search, Timer, Trash2, Upload, X } from 'lucide-react';
import { maskKey, useStore } from '../state/store.tsx';
import { SITES, SITE_GROUPS, fmtLatLon, makeCustomSite } from '../lib/sites.ts';
import { usePrimary } from '../state/primary.tsx';
import { inLolaCoverage } from '../lib/providers/lola.ts';
import { searchNearby, type Candidate } from '../lib/bestLit.ts';
import { DAY, HOUR, fmtUTC, fromInputValue, toInputValue } from '../lib/format.ts';
import { parseHorizonCsv } from '../lib/providers/terrain.ts';
import { Card, InfoTip, Label, ProvBadge, Seg } from './ui.tsx';

export function Sidebar() {
  return (
    <div className="flex flex-col gap-3">
      <SitePicker />
      <DateControls />
      <DataSources />
    </div>
  );
}

function SitePicker() {
  const { state, set, site } = useStore();
  const [lat, setLat] = useState(String(site.lat));
  const [lon, setLon] = useState(String(site.lon));
  const [err, setErr] = useState('');
  useEffect(() => { setLat(String(site.lat)); setLon(String(site.lon)); }, [site.lat, site.lon]);

  const apply = () => {
    const la = Number(lat);
    let lo = Number(lon);
    if (!Number.isFinite(la) || la < -90 || la > 90) return setErr('Latitude must be between −90 and 90.');
    if (!Number.isFinite(lo) || lo < -180 || lo > 360) return setErr('Longitude must be between −180 and 360.');
    if (lo > 180) lo -= 360;
    setErr('');
    set({ custom: makeCustomSite(la, lo), siteId: 'custom' });
  };

  return (
    <Card title="Landing Site" icon={<MapPin size={14} className="text-earth" />} right={<InfoTip topic="southPole" align="right" />}>
      <div className="-mx-1 max-h-[340px] space-y-1 overflow-y-auto px-1">
        {SITE_GROUPS.map((g) => (
          <div key={g}>
          <div className="sticky top-0 z-10 bg-panel/95 px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint backdrop-blur">{g}</div>
          {SITES.filter((s) => s.group === g).map((s) => {
          const active = s.id === state.siteId;
          return (
            <button
              key={s.id}
              onClick={() => set({ siteId: s.id })}
              className={`group w-full rounded-lg border px-2.5 py-2 text-left transition ${
                active ? 'border-earth/60 bg-earth/10 shadow-glow' : 'border-transparent hover:border-edge hover:bg-deep'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[13px] font-medium ${active ? 'text-ink' : 'text-ink-mute group-hover:text-ink'}`}>{s.name}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${s.region === 'south-polar' ? 'bg-sun' : s.region === 'high-latitude' ? 'bg-earth' : 'bg-ink-faint'}`} />
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">{fmtLatLon(s.lat, s.lon)}</div>
            </button>
          );
        })}
          </div>
        ))}
        {state.custom && (
          <button
            onClick={() => set({ siteId: 'custom' })}
            className={`w-full rounded-lg border px-2.5 py-2 text-left ${state.siteId === 'custom' ? 'border-sun/60 bg-sun/10' : 'border-dashed border-edge hover:bg-deep'}`}
          >
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-sun-soft"><Crosshair size={12} /> {state.custom.name}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">{fmtLatLon(state.custom.lat, state.custom.lon)}</div>
          </button>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-edge/70 bg-void/40 p-2.5 text-[11px] leading-snug text-ink-faint">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <ProvBadge p={site.provenance === 'custom' ? 'computed' : 'sourced'} extra={site.source} />
          <span className="text-ink-mute">{site.provenance === 'feature-centre' ? 'Feature centre' : site.provenance === 'published' ? 'Published point' : 'User input'}</span>
        </div>
        {site.source}
        {site.note && <div className="mt-1 text-risk-warn/90">{site.note}</div>}
      </div>

      <BestNearby />

      <div className="mt-3">
        <Label>Custom coordinates</Label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-ink-faint">LAT (°N+)
            <input className="field mt-0.5" value={lat} onChange={(e) => setLat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} inputMode="decimal" />
          </label>
          <label className="text-[10px] text-ink-faint">LON (°E+)
            <input className="field mt-0.5" value={lon} onChange={(e) => setLon(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply()} inputMode="decimal" />
          </label>
        </div>
        {err && <p className="mt-1 text-[11px] text-risk">{err}</p>}
        <button className="btn btn-primary mt-2 w-full" onClick={apply}><Crosshair size={13} /> Set custom site</button>
        <p className="mt-1.5 text-[10.5px] text-ink-faint">Tip: double-click the globe or click the polar map to drop a site.</p>
      </div>
    </Card>
  );
}

function DateControls() {
  const { state, set, setLanding } = useStore();
  const [val, setVal] = useState(toInputValue(state.landingMs));
  useEffect(() => setVal(toInputValue(state.landingMs)), [state.landingMs]);
  const commit = (v: string) => {
    const ms = fromInputValue(v);
    if (Number.isFinite(ms)) setLanding(ms);
  };
  const shift = (d: number) => setLanding(state.landingMs + d);

  return (
    <Card title="Mission Timing" icon={<CalendarClock size={14} className="text-sun" />}>
      <Label>Landing date &amp; time (UTC)</Label>
      <input type="datetime-local" className="field" value={val} onChange={(e) => setVal(e.target.value)} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit(val)} />
      <div className="mt-2 grid grid-cols-4 gap-1">
        <button className="btn" onClick={() => shift(-DAY)}>−1 d</button>
        <button className="btn" onClick={() => shift(-6 * HOUR)}>−6 h</button>
        <button className="btn" onClick={() => shift(6 * HOUR)}>+6 h</button>
        <button className="btn" onClick={() => shift(DAY)}>+1 d</button>
      </div>

      <div className="mt-4">
        <Label><Timer size={11} /> Mission duration</Label>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={60} value={state.durationDays} onChange={(e) => set({ durationDays: +e.target.value })} />
          <span className="w-14 text-right font-mono text-sm text-ink">{state.durationDays} d</span>
        </div>
        <div className="mt-2 flex gap-1">
          {[3, 7, 14, 28].map((d) => (
            <button key={d} className={`btn flex-1 ${state.durationDays === d ? 'btn-primary' : ''}`} onClick={() => set({ durationDays: d })}>{d} d</button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Label>Alternative landing dates</Label>
        <button
          className="btn w-full"
          disabled={state.altDates.includes(state.landingMs) || state.altDates.length >= 6}
          onClick={() => set({ altDates: [...state.altDates, state.landingMs].sort((a, b) => a - b) })}
        >
          <Pin size={13} /> Pin current landing time
        </button>
        {state.altDates.length > 0 && (
          <ul className="mt-2 space-y-1">
            {state.altDates.map((t) => (
              <li key={t} className={`flex items-center justify-between rounded-md border px-2 py-1 font-mono text-[11px] ${t === state.landingMs ? 'border-sun/50 text-sun-soft' : 'border-edge text-ink-mute'}`}>
                <button className="hover:text-ink" onClick={() => setLanding(t)} title="Use as landing time">{fmtUTC(t)}</button>
                <button className="text-ink-faint hover:text-risk" onClick={() => set({ altDates: state.altDates.filter((x) => x !== t) })} aria-label="Remove"><X size={12} /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[10.5px] text-ink-faint">Pinned dates are marked in the landing-window scan.</p>
      </div>
    </Card>
  );
}

function DataSources() {
  const { state, set, site } = useStore();
  const primary = usePrimary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const key = maskKey(site);
  const hasUser = !!state.userMasks[key];

  const onFile = async (f: File) => {
    try {
      const mask = parseHorizonCsv(await f.text(), `Uploaded: ${f.name}`);
      set((s) => ({ userMasks: { ...s.userMasks, [key]: mask }, terrain: 'user' }));
      setMsg({ ok: true, text: `Loaded horizon mask for ${site.name}.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <Card title="Data Sources" icon={<Database size={14} className="text-earth" />} right={<InfoTip topic="provenance" align="right" />}>
      <Label>Ephemeris provider</Label>
      <Seg
        value={state.provider}
        onChange={(v) => set({ provider: v })}
        options={[{ v: 'analytic', label: 'Analytic' }, { v: 'horizons', label: 'JPL Horizons' }]}
      />
      <p className="mt-1.5 text-[10.5px] leading-snug text-ink-faint">
        {state.provider === 'analytic'
          ? 'Offline Meeus + IAU 2009 model, tested against JPL DE441 to < 0.01°.'
          : 'Live NASA/JPL Horizons DE441 az/el for a lunar-surface observer (via /api/horizons proxy).'}
      </p>

      <div className="mt-4">
        <Label tip="terrain"><Mountain size={11} /> Horizon / terrain model</Label>
        <Seg
          size="xs"
          value={state.terrain}
          onChange={(v) => set({ terrain: v })}
          options={[{ v: 'lola', label: 'LOLA' }, { v: 'geometric', label: 'Geometric' }, { v: 'illustrative', label: 'Demo' }, { v: 'user', label: 'Upload' }]}
        />
        <div className="mt-2 text-[10.5px] leading-snug">
          {state.terrain === 'lola' && (primary.maskNote
            ? <span className={primary.maskLoading ? 'text-earth-soft' : 'text-risk-warn'}>{primary.maskNote}</span>
            : <span className="text-ok">Real NASA LRO LOLA topography: {primary.mask.label}. Horizon includes mountains, crater walls and lunar curvature.</span>)}
          {state.terrain === 'geometric' && <span className="text-ink-faint">Smooth sphere: results are <b className="text-ink-mute">geometric-horizon-only</b>.</span>}
          {state.terrain === 'illustrative' && <span className="text-risk-warn">Synthetic demo terrain. It is NOT LOLA data. Use it only to see how terrain changes results.</span>}
          {state.terrain === 'user' && (hasUser
            ? <span className="text-ok">Using uploaded horizon mask for this site.</span>
            : <span className="text-risk-warn">No mask uploaded for this site. Falling back to the geometric horizon.</span>)}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        <div className="mt-2 flex gap-1">
          <button className="btn flex-1" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload horizon CSV</button>
          {hasUser && (
            <button className="btn" title="Remove uploaded mask" onClick={() => set((s) => { const m = { ...s.userMasks }; delete m[key]; return { userMasks: m }; })}><Trash2 size={13} /></button>
          )}
        </div>
        {msg && <p className={`mt-1 text-[10.5px] ${msg.ok ? 'text-ok' : 'text-risk'}`}>{msg.text}</p>}
        <p className="mt-1 text-[10px] text-ink-faint">Format: <code className="text-ink-mute">azimuth_deg,elevation_deg</code> per row (e.g. output of <code>tools/lola_masks.py --site</code>).</p>
      </div>

      <div className="mt-4">
        <Label tip="commMask">Comm elevation mask</Label>
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={10} step={0.5} value={state.commMinEl} onChange={(e) => set({ commMinEl: +e.target.value })} />
          <span className="w-12 text-right font-mono text-sm">{state.commMinEl.toFixed(1)}°</span>
        </div>
      </div>
    </Card>
  );
}

function BestNearby() {
  const { state, set, site } = useStore();
  const [radius, setRadius] = useState(10);
  const [goal, setGoal] = useState<'sunPct' | 'bothPct'>('sunPct');
  const [prog, setProg] = useState<number | null>(null);
  const [res, setRes] = useState<{ key: string; list: Candidate[] } | null>(null);
  const cancel = useRef({ cancelled: false });
  const key = `${site.lat},${site.lon},${state.landingMs},${state.durationDays},${state.commMinEl},${radius}`;
  useEffect(() => () => { cancel.current.cancelled = true; }, []);
  if (!inLolaCoverage(site.lat)) return null;

  const run = async () => {
    cancel.current.cancelled = true;
    const sig = { cancelled: false };
    cancel.current = sig;
    setProg(0);
    try {
      const list = await searchNearby({ lat: site.lat, lon: site.lon, radiusKm: radius, startMs: state.landingMs, durationDays: state.durationDays, commMinEl: state.commMinEl, onProgress: setProg, signal: sig });
      if (!sig.cancelled) setRes({ key, list });
    } finally { if (!sig.cancelled) setProg(null); }
  };
  const ranked = res?.key === key ? [...res.list].sort((a, b) => b[goal] - a[goal] || a.distKm - b.distKm).slice(0, 4) : null;
  const base = res?.key === key ? res.list.find((c) => c.distKm === 0) : undefined;
  const baseName = site.name.replace(/^Best .*? near /, '');

  return (
    <div className="mt-3 rounded-lg border border-sun/25 bg-sun/[0.04] p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-sun-soft"><Search size={12} /> Best-lit spot nearby <span className="font-normal normal-case tracking-normal text-ink-faint">(LOLA)</span></div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Seg size="xs" value={radius} onChange={setRadius} options={[{ v: 5, label: '5 km' }, { v: 10, label: '10 km' }, { v: 20, label: '20 km' }]} />
        <Seg size="xs" value={goal} onChange={setGoal} options={[{ v: 'sunPct', label: 'Sun' }, { v: 'bothPct', label: 'Sun+Earth' }]} />
      </div>
      <button className="btn btn-primary mt-2 w-full" onClick={() => void run()} disabled={prog !== null}>
        {prog !== null ? <><Loader2 size={13} className="animate-spin" /> Scanning terrain… {Math.round(prog * 100)}%</> : <>Search {radius} km around this site</>}
      </button>
      {ranked && (
        <ul className="mt-2 space-y-1">
          {base && <li className="font-mono text-[10px] text-ink-faint">this site: sun {base.sunPct.toFixed(0)}% · earth {base.earthPct.toFixed(0)}% · both {base.bothPct.toFixed(0)}%</li>}
          {ranked.map((c) => (
            <li key={`${c.lat},${c.lon}`}>
              <button
                className="w-full rounded-md border border-edge px-2 py-1 text-left font-mono text-[10.5px] transition hover:border-sun/50 hover:bg-sun/5"
                onClick={() => set({ custom: makeCustomSite(+c.lat.toFixed(4), +c.lon.toFixed(4), `Best ${goal === 'sunPct' ? 'sunlit' : 'Sun+Earth'} spot near ${baseName}`), siteId: 'custom' })}
              >
                <span className="text-sun-soft">☀ {c.sunPct.toFixed(0)}%</span> <span className="text-earth-soft">🌍 {c.earthPct.toFixed(0)}%</span> <span className="text-ink">both {c.bothPct.toFixed(0)}%</span>
                <span className="block text-ink-faint">{c.distKm.toFixed(1)} km away · {(c.heightM / 1000).toFixed(2)} km elev · {fmtLatLon(c.lat, c.lon)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[10px] leading-snug text-ink-faint">Screens ~110 points over the mission window using 480 m LOLA terrain. Click a result to analyse it at full detail.</p>
    </div>
  );
}
