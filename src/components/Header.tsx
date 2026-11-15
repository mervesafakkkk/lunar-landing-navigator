import { useEffect, useRef, useState } from 'react';
import { Download, GraduationCap, Link2, Loader2, Satellite, TriangleAlert, Check } from 'lucide-react';
import { useStore } from '../state/store.tsx';
import { usePrimary } from '../state/primary.tsx';
import { fmtUTC } from '../lib/format.ts';
import { exportCsv, exportJson } from '../lib/export.ts';
import { planningIndex } from '../lib/scoring.ts';
import { fmtLatLon } from '../lib/sites.ts';

export function Header() {
  const { state, set, site } = useStore();
  const a = usePrimary();
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const st = a.status;
  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Logo />
          <div className="leading-tight">
            <h1 className="font-display text-[17px] font-bold tracking-wide text-ink">
              LUNAR LANDING NAVIGATOR
            </h1>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-earth/80">Mission Control · South Pole Ops</p>
          </div>
        </div>

        <div className="hidden items-center gap-5 font-mono text-[11px] text-ink-mute lg:flex">
          <Stat k="TARGET" v={site.name} />
          <Stat k="COORD" v={fmtLatLon(site.lat, site.lon)} />
          <Stat k="T-CURSOR" v={fmtUTC(state.cursorMs)} hi />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10.5px] sm:inline-flex ${
            st.state === 'fallback' ? 'border-risk-warn/50 text-risk-warn' : st.state === 'loading' ? 'border-earth/40 text-earth-soft' : 'border-ok/30 text-ok'
          }`} title={st.state === 'fallback' ? st.error : undefined}>
            {st.state === 'loading' ? <Loader2 size={12} className="animate-spin" /> : st.state === 'fallback' ? <TriangleAlert size={12} /> : <Satellite size={12} />}
            {st.state === 'loading' ? 'QUERYING JPL HORIZONS' : st.state === 'fallback' ? 'HORIZONS UNAVAILABLE · ANALYTIC FALLBACK' : st.providerId === 'horizons' ? 'EPHEMERIS · JPL HORIZONS DE441' : 'EPHEMERIS · ANALYTIC (OFFLINE)'}
          </span>
          <button className={`btn ${state.eduMode ? 'btn-primary' : ''}`} onClick={() => set({ eduMode: !state.eduMode })} title="Toggle educational explanations">
            <GraduationCap size={14} /> <span className="hidden sm:inline">Learn</span>
          </button>
          <div className="relative" ref={ref}>
            <button className="btn" onClick={() => setMenu((m) => !m)}>
              <Download size={14} /> <span className="hidden sm:inline">Export</span>
            </button>
            {menu && (
              <div className="absolute right-0 top-9 z-50 w-60 rounded-lg border border-edge bg-deep p-1 shadow-2xl">
                <MenuItem onClick={() => { exportCsv(site, a.series, a.vis, state.landingMs, a.missionEnd); setMenu(false); }}>
                  Time series (CSV)
                </MenuItem>
                <MenuItem onClick={() => {
                  exportJson({ site, landingMs: state.landingMs, durationDays: state.durationDays, series: a.series, mask: a.mask, commMinEl: state.commMinEl, metrics: a.metrics, planningIndex: planningIndex(a.metrics, state.weights) });
                  setMenu(false);
                }}>
                  Mission report (JSON)
                </MenuItem>
                <MenuItem onClick={() => { void navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <><Check size={13} className="text-ok" /> Link copied</> : <><Link2 size={13} /> Copy shareable scenario link</>}
                </MenuItem>
                <MenuItem onClick={() => { setMenu(false); setTimeout(() => window.print(), 50); }}>Print / save as PDF</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-ink-mute hover:bg-edge/50 hover:text-ink">
      {children}
    </button>
  );
}

function Stat({ k, v, hi }: { k: string; v: string; hi?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] tracking-[0.25em] text-ink-faint">{k}</span>
      <span className={hi ? 'text-earth-soft' : 'text-ink'}>{v}</span>
    </div>
  );
}

function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <radialGradient id="lg-moon" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#d8dde6" />
          <stop offset="100%" stopColor="#5b6577" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeDasharray="2 4" />
      <circle cx="32" cy="34" r="17" fill="url(#lg-moon)" />
      <circle cx="26" cy="30" r="3" fill="#6f788a" opacity="0.7" />
      <circle cx="37" cy="40" r="4" fill="#6f788a" opacity="0.6" />
      <path d="M15 40 Q32 52 49 40" stroke="#f5b82e" strokeWidth="1.5" fill="none" opacity="0.8" />
      <circle cx="52" cy="12" r="4" fill="#f5b82e" />
      <circle cx="10" cy="16" r="3" fill="#22d3ee" />
    </svg>
  );
}
