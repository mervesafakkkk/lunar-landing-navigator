import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SITES, makeCustomSite, type Site } from '../lib/sites.ts';
import type { HorizonMask } from '../lib/providers/types.ts';
import type { TerrainMode } from '../lib/providers/terrain.ts';
import { DEFAULT_WEIGHTS, type Weights } from '../lib/scoring.ts';
import { DAY } from '../lib/format.ts';

export type ProviderId = 'analytic' | 'horizons';
export type ViewRange = '24h' | '7d' | '30d';

export interface WhatIf {
  delayDays: number;
  altSiteId: string | null;
  extendDays: number;
}

export interface AppState {
  siteId: string;
  custom: Site | null;
  landingMs: number;
  durationDays: number;
  cursorMs: number;
  viewRange: ViewRange;
  viewStartMs: number;
  provider: ProviderId;
  terrain: TerrainMode;
  commMinEl: number;
  userMasks: Record<string, HorizonMask>;
  compareIds: string[];
  altDates: number[];
  whatIf: WhatIf;
  weights: Weights;
  eduMode: boolean;
}

const DEFAULT_LANDING = Date.UTC(2026, 11, 15, 6, 0);

const initial: AppState = {
  siteId: 'im2-athena',
  custom: null,
  landingMs: DEFAULT_LANDING,
  durationDays: 14,
  cursorMs: DEFAULT_LANDING,
  viewRange: '7d',
  viewStartMs: DEFAULT_LANDING,
  provider: 'analytic',
  terrain: 'lola',
  commMinEl: 0,
  userMasks: {},
  compareIds: ['im2-athena', 'im1-odysseus', 'shackleton'],
  altDates: [],
  whatIf: { delayDays: 7, altSiteId: null, extendDays: 0 },
  weights: DEFAULT_WEIGHTS,
  eduMode: true,
};

/** Key under which a user horizon mask is stored (custom sites are keyed by coordinates). */
export const maskKey = (s: Site) => (s.id === 'custom' ? `custom:${s.lat.toFixed(4)},${s.lon.toFixed(4)}` : s.id);

// ---------- shareable URL hash -------------------------------------------------------
function readHash(): Partial<AppState> {
  try {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const out: Partial<AppState> = {};
    const site = p.get('site');
    if (site?.startsWith('@')) {
      const [la, lo] = site.slice(1).split(',').map(Number);
      if (Number.isFinite(la) && Number.isFinite(lo)) { out.custom = makeCustomSite(la, lo); out.siteId = 'custom'; }
    } else if (site && SITES.some((s) => s.id === site)) out.siteId = site;
    const land = Date.parse(p.get('t') ?? '');
    if (Number.isFinite(land)) { out.landingMs = land; out.cursorMs = land; out.viewStartMs = land; }
    const dur = Number(p.get('d'));
    if (dur >= 1 && dur <= 60) out.durationDays = dur;
    const cmp = p.get('cmp')?.split(',').filter((id) => SITES.some((s) => s.id === id));
    if (cmp?.length) out.compareIds = cmp.slice(0, 3);
    const terr = p.get('terrain');
    if (terr === 'lola' || terr === 'geometric' || terr === 'illustrative') out.terrain = terr;
    const comm = Number(p.get('comm'));
    if (Number.isFinite(comm) && p.has('comm')) out.commMinEl = comm;
    return out;
  } catch {
    return {};
  }
}

function writeHash(s: AppState) {
  const p = new URLSearchParams();
  p.set('site', s.siteId === 'custom' && s.custom ? `@${s.custom.lat},${s.custom.lon}` : s.siteId);
  p.set('t', new Date(s.landingMs).toISOString().slice(0, 16) + 'Z');
  p.set('d', String(s.durationDays));
  p.set('cmp', s.compareIds.join(','));
  if (s.terrain !== 'user') p.set('terrain', s.terrain);
  p.set('comm', String(s.commMinEl));
  history.replaceState(null, '', `#${p}`);
}

// ---------- context ----------------------------------------------------------------
interface Ctx {
  state: AppState;
  set: (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;
  site: Site;
  allSites: Site[];
  siteById: (id: string) => Site;
  setLanding: (ms: number) => void;
  setCursor: (ms: number) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({ ...initial, ...readHash() }));
  const set = useCallback<Ctx['set']>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => writeHash(state), 250);
    return () => clearTimeout(id);
  }, [state]);

  const allSites = useMemo(() => (state.custom ? [...SITES, state.custom] : SITES), [state.custom]);
  const siteById = useCallback((id: string) => allSites.find((s) => s.id === id) ?? SITES[0], [allSites]);
  const site = siteById(state.siteId);

  const setLanding = useCallback((ms: number) => set({ landingMs: ms, cursorMs: ms, viewStartMs: ms }), [set]);
  const setCursor = useCallback(
    (ms: number) =>
      set((s) => {
        const lenMs = rangeMs(s.viewRange);
        let viewStartMs = s.viewStartMs;
        if (ms < viewStartMs || ms > viewStartMs + lenMs) viewStartMs = ms - lenMs / 2;
        return { cursorMs: ms, viewStartMs };
      }),
    [set],
  );

  const value = useMemo(() => ({ state, set, site, allSites, siteById, setLanding, setCursor }), [state, set, site, allSites, siteById, setLanding, setCursor]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}

export const rangeMs = (r: ViewRange) => (r === '24h' ? DAY : r === '7d' ? 7 * DAY : 30 * DAY);
