import { useEffect, useMemo, useState } from 'react';
import type { Site } from '../lib/sites.ts';
import type { HorizonMask } from '../lib/providers/types.ts';
import { GEOMETRIC_MASK, resolveMask } from '../lib/providers/terrain.ts';
import { bundledMask, inLolaCoverage, lolaMask } from '../lib/providers/lola.ts';
import { maskKey, useStore } from './store.tsx';

export interface MaskResult {
  mask: HorizonMask;
  /** Why the requested terrain model is not being used (null when it is). */
  note: string | null;
  loading: boolean;
}

/** Resolves the horizon mask for a site under the current terrain mode (async for in-browser LOLA). */
export function useHorizonMask(site: Site): MaskResult {
  const { state } = useStore();
  const { terrain, userMasks } = state;
  const user = userMasks[maskKey(site)];
  const covered = inLolaCoverage(site.lat);
  const bundled = useMemo(() => (terrain === 'lola' ? bundledMask(site.id, site.lat, site.lon) : null), [terrain, site.id, site.lat, site.lon]);
  const [computed, setComputed] = useState<{ key: string; mask?: HorizonMask; error?: string } | null>(null);
  const key = `${site.lat},${site.lon}`;

  useEffect(() => {
    if (terrain !== 'lola' || !covered || bundled) return;
    let alive = true;
    setComputed((c) => (c?.key === key ? c : { key }));
    // yield a frame so the UI can show "computing" before the CPU-heavy march
    const id = setTimeout(() => {
      lolaMask(site.id, site.lat, site.lon)
        .then((mask) => alive && setComputed({ key, mask }))
        .catch((e: Error) => alive && setComputed({ key, error: e.message }));
    }, 16);
    return () => { alive = false; clearTimeout(id); };
  }, [terrain, covered, bundled, key, site.id, site.lat, site.lon]);

  return useMemo<MaskResult>(() => {
    if (terrain === 'lola') {
      if (!covered) return { mask: GEOMETRIC_MASK, note: 'Outside LOLA polar coverage (south of 76°S). Using the geometric horizon.', loading: false };
      if (bundled) return { mask: bundled, note: null, loading: false };
      if (computed?.key === key && computed.mask) return { mask: computed.mask, note: null, loading: false };
      if (computed?.key === key && computed.error) return { mask: GEOMETRIC_MASK, note: `LOLA terrain unavailable (${computed.error}). Using the geometric horizon.`, loading: false };
      return { mask: GEOMETRIC_MASK, note: 'Computing LOLA horizon…', loading: true };
    }
    if (terrain === 'user' && !user) return { mask: GEOMETRIC_MASK, note: 'No horizon file uploaded for this site. Using the geometric horizon.', loading: false };
    return { mask: resolveMask(terrain, site, user ? { [site.id]: user } : {}), note: null, loading: false };
  }, [terrain, covered, bundled, computed, key, user, site]);
}
