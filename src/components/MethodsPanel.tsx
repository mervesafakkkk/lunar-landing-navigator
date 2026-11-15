import { useState } from 'react';
import { BookOpen, ChevronDown, Earth, Moon, ShieldCheck } from 'lucide-react';
import { EDU, type EduKey } from '../lib/education.ts';
import { ARTEMIS_III_REGIONS } from '../lib/sites.ts';
import { analyticProvider } from '../lib/providers/analytic.ts';
import { horizonsProvider } from '../lib/providers/horizons.ts';
import { LOLA_META } from '../lib/providers/lola.ts';
import type { Provenance } from '../lib/providers/types.ts';
import { Card, ProvBadge } from './ui.tsx';

/** Measured with `npm run validate` (Dec 2026, 3-h steps, vs JPL Horizons DE441). */
const EPHEM_VALIDATION = [
  { site: 'Shackleton (89.67°S)', sun: '0.003° / 0.005°', earth: '0.002° / 0.003°' },
  { site: 'Malapert (84.9°S)', sun: '0.003° / 0.005°', earth: '0.002° / 0.003°' },
  { site: 'Apollo 11 (0.67°N)', sun: '0.007° / 0.008°', earth: '0.002° / 0.004°' },
];

/** Sunlight over all of 2026, hourly: smooth-sphere horizon vs LOLA terrain horizon. */
const PSR_VALIDATION = [
  { site: 'Shackleton floor', geo: '51.9%', lola: '0.0%' },
  { site: 'de Gerlache floor', geo: '51.1%', lola: '0.0%' },
  { site: 'Shoemaker floor', geo: '51.1%', lola: '0.0%' },
  { site: 'Cabeus (LCROSS)', geo: '51.6%', lola: '0.0%' },
];

const MOON_VS_EARTH: [string, string, string][] = [
  ['Length of a solar day', '29.5 Earth days', '24 hours'],
  ['Axial tilt (to the ecliptic)', '1.5°', '23.4°'],
  ['Highest Sun at the pole', '~1.5° above the horizon', '~23.4° (midsummer)'],
  ['Atmospheric refraction', 'none', '~0.57° at the horizon'],
  ['Daytime sky', 'black, stars visible', 'blue'],
  ['Coldest shadowed craters', 'below −230 °C', '—'],
];

export function MethodsPanel() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <Card title="Data Integrity & Methods" icon={<ShieldCheck size={14} className="text-ok" />}>
        <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-mute">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5"><ProvBadge p="sourced" /> external authoritative source</span>
            <span className="flex items-center gap-1.5"><ProvBadge p="derived" /> computed from NASA LOLA data</span>
            <span className="flex items-center gap-1.5"><ProvBadge p="computed" /> calculated from physical models</span>
            <span className="flex items-center gap-1.5"><ProvBadge p="illustrative" /> synthetic demo data</span>
          </div>
          <Provider p={analyticProvider} />
          <Provider p={horizonsProvider} />
          <Provider p={{ label: 'NASA LRO LOLA topography', provenance: 'derived', description: `${LOLA_META.product}, from the PDS Geosciences Node. The horizon in each direction is traced out to ${LOLA_META.maxRangeKm} km with lunar curvature, for an observer ${LOLA_META.observerHeightM} m above the ground. Curated sites use the full 240 m grid; custom sites and the shadow map use a 480 m copy computed in the browser.` }} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Ephemeris vs JPL Horizons DE441 (elev. RMS / max)</div>
              <table className="w-full font-mono text-[11px]">
                <thead className="text-ink-faint"><tr><th className="text-left font-medium">Site</th><th className="text-left font-medium text-sun">Sun</th><th className="text-left font-medium text-earth">Earth</th></tr></thead>
                <tbody>{EPHEM_VALIDATION.map((v) => <tr key={v.site}><td>{v.site}</td><td>{v.sun}</td><td>{v.earth}</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Terrain test: known permanently shadowed regions (sunlight over 2026)</div>
              <table className="w-full font-mono text-[11px]">
                <thead className="text-ink-faint"><tr><th className="text-left font-medium">Site</th><th className="text-left font-medium">Smooth sphere</th><th className="text-left font-medium text-ok">LOLA</th></tr></thead>
                <tbody>{PSR_VALIDATION.map((v) => <tr key={v.site}><td>{v.site}</td><td className="text-risk-warn">{v.geo}</td><td className="text-ok">{v.lola}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-ink-faint">The ephemeris error is ~30× smaller than the Sun’s 0.27° radius. With LOLA terrain, every documented permanently shadowed crater floor tested correctly stays dark all year. A smooth sphere wrongly puts them in sunlight about half the time.</p>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Known limitations</div>
            <ul className="list-disc space-y-1 pl-4 text-[12px]">
              <li><b className="text-ink">Terrain resolution:</b> the 240/480 m LOLA grids capture mountains and crater walls but not boulders or small rims. In-browser 480 m horizons differ from 240 m ones by 0.02–3° where nearby slopes are steep.</li>
              <li><b className="text-ink">Coverage:</b> LOLA terrain covers 76°S–90°S. Elsewhere the geometric horizon is used, and the app says so.</li>
              <li><b className="text-ink">Visibility rule:</b> a body counts as visible when its centre is above the local horizon. Partial solar-disk visibility is tracked separately.</li>
              <li><b className="text-ink">Power:</b> illumination is a proxy for power availability, not a power prediction.</li>
              <li><b className="text-ink">Communication:</b> Earth line of sight is necessary, not sufficient. DSN station visibility and scheduling are not modelled.</li>
              <li><b className="text-ink">Sites:</b> published feature centres or landing points, not certified landing ellipses.</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Card title="Learn · Lunar Operations" icon={<BookOpen size={14} className="text-earth" />}>
          <div className="mb-3 overflow-x-auto rounded-lg border border-edge/60 bg-void/40">
            <table className="w-full min-w-[380px] text-[11.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider text-ink-faint">
                  <th className="px-2.5 py-1.5 text-left font-medium" />
                  <th className="px-2.5 py-1.5 text-left font-medium"><span className="inline-flex items-center gap-1"><Moon size={11} /> Moon (south pole)</span></th>
                  <th className="px-2.5 py-1.5 text-left font-medium"><span className="inline-flex items-center gap-1"><Earth size={11} /> Earth</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge/50">
                {MOON_VS_EARTH.map(([k, m, e]) => (
                  <tr key={k}><td className="px-2.5 py-1 text-ink-faint">{k}</td><td className="px-2.5 py-1 font-mono text-sun-soft">{m}</td><td className="px-2.5 py-1 font-mono text-earth-soft">{e}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5">
            {(['southPole', 'sunlight', 'earthVisibility', 'terrain', 'noAtmosphere', 'libration', 'power', 'commMask'] as EduKey[]).map((k) => <Accordion key={k} k={k} />)}
          </div>
        </Card>
        <Card title="NASA Data Used & Roadmap">
          <ul className="space-y-2 text-[12px] leading-relaxed text-ink-mute">
            <li><b className="text-ok">✓ JPL Horizons</b>: live provider (DE441, lunar surface observer, MEAN_ME frame). Also used to validate the offline model.</li>
            <li><b className="text-ok">✓ LRO LOLA topography</b>: {LOLA_META.product} drives terrain horizons, the live shadow map and the best-lit-spot search.</li>
            <li><b className="text-ok">✓ LRO imagery</b>: the globe uses the NASA SVS CGI Moon Kit (LROC WAC colour mosaic + LOLA elevation).</li>
            <li><b className="text-earth">◐ QuickMap / Moon Trek</b>: use them to inspect a site's terrain and imagery in detail. A horizon profile from any source can be uploaded as a CSV; <code>tools/lola_masks.py --site</code> produces one from the LOLA polar product. Reading their higher-resolution DEM exports directly is not implemented yet.</li>
            <li><b className="text-ink-faint">○ Next</b>: 5–20 m LOLA products for landing-ellipse scale, slope/hazard maps, and a SPICE backend provider.</li>
          </ul>
          <div className="mt-3 border-t border-edge/60 pt-2 text-[11.5px] text-ink-faint">
            NASA’s Artemis III candidate regions (Oct 2024): {ARTEMIS_III_REGIONS.join(' · ')}. Region boundaries are not encoded as point coordinates here.
          </div>
        </Card>
      </div>
    </div>
  );
}

function Provider({ p }: { p: { label: string; provenance: Provenance; description: string } }) {
  return (
    <div className="rounded-lg border border-edge/60 bg-void/40 p-2.5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">{p.label} <ProvBadge p={p.provenance} /></div>
      <div className="mt-0.5 text-[11.5px] text-ink-faint">{p.description}</div>
    </div>
  );
}

function Accordion({ k }: { k: EduKey }) {
  const [open, setOpen] = useState(false);
  const t = EDU[k];
  return (
    <div className="rounded-lg border border-edge/60 bg-void/30">
      <button className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] font-medium text-ink" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {t.title}
        <ChevronDown size={14} className={`text-ink-faint transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-3 pb-3 text-[12px] leading-relaxed text-ink-mute">{t.body}</p>}
    </div>
  );
}
