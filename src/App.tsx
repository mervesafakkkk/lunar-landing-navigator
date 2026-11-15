import { lazy, Suspense, useState } from 'react';
import { Globe2, Map as MapIcon, Focus, Navigation, Orbit } from 'lucide-react';
import { StoreProvider } from './state/store.tsx';
import { PrimaryProvider } from './state/primary.tsx';
import { Header } from './components/Header.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { SkyView } from './components/SkyView.tsx';
import { Timeline } from './components/Timeline.tsx';
import { WhatIf } from './components/WhatIf.tsx';
import { Comparison } from './components/Comparison.tsx';
import { WindowFinder } from './components/WindowFinder.tsx';
import { MethodsPanel } from './components/MethodsPanel.tsx';
import { PolarMap } from './components/PolarMap.tsx';
import { Seg } from './components/ui.tsx';
import type { GlobeView } from './components/MoonGlobe.tsx';

const MoonGlobe = lazy(() => import('./components/MoonGlobe.tsx').then((m) => ({ default: m.MoonGlobe })));

export default function App() {
  return (
    <StoreProvider>
      <PrimaryProvider>
        <Shell />
      </PrimaryProvider>
    </StoreProvider>
  );
}

function Shell() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-3 p-3 lg:grid-cols-[290px_1fr] 2xl:grid-cols-[300px_1fr_360px]">
        <aside className="order-2 lg:order-1 lg:row-span-2">
          <Sidebar />
        </aside>
        <div className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
          <MapStage />
          <SkyView />
        </div>
        <aside className="order-3 min-w-0 lg:col-start-2 2xl:col-start-3 2xl:row-start-1">
          <StatusPanel />
        </aside>
      </main>
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-3 pb-3">
        <Timeline />
        <WhatIf />
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          <Comparison />
          <WindowFinder />
        </div>
        <MethodsPanel />
        <footer className="py-6 text-center font-mono text-[10.5px] leading-relaxed text-ink-faint">
          Lunar Landing Navigator · NASA Space Apps Challenge prototype · Imagery: NASA SVS CGI Moon Kit (LRO LROC/LOLA) · Ephemeris: Meeus/IAU analytic model or NASA/JPL Horizons
          <br />A planning and education aid. Not an official NASA product or feasibility determination.
        </footer>
      </div>
    </div>
  );
}

function MapStage() {
  const [mode, setMode] = useState<'globe' | 'polar'>('globe');
  const [view, setView] = useState<GlobeView>('south');
  const [nonce, setNonce] = useState(0);
  const go = (v: GlobeView) => { setView(v); setNonce((n) => n + 1); };
  return (
    <section className="panel relative h-[440px] overflow-hidden md:h-[520px]">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-2">
        <Seg value={mode} onChange={setMode} options={[{ v: 'globe', label: <span className="flex items-center gap-1"><Globe2 size={12} /> 3D Globe</span> }, { v: 'polar', label: <span className="flex items-center gap-1"><MapIcon size={12} /> South-Polar Map</span> }]} />
      </div>
      {mode === 'globe' ? (
        <>
          <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-xs text-ink-faint">Initialising 3D renderer…</div>}>
            <MoonGlobe view={view} viewNonce={nonce} />
          </Suspense>
          <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1.5">
            <button className="btn" onClick={() => go('south')}><Navigation size={12} className="rotate-180" /> South pole</button>
            <button className="btn" onClick={() => go('site')}><Focus size={12} /> Focus site</button>
            <button className="btn" onClick={() => go('near')}><Orbit size={12} /> Near side</button>
          </div>
          <div className="pointer-events-none absolute left-3 top-3 z-20 hidden max-w-[280px] font-mono md:block text-[10px] leading-relaxed text-ink-faint">
            <div className="text-ink-mute">LRO LROC WAC mosaic · LOLA relief (×2)</div>
            Lit by the computed Sun direction at the time cursor, with earthshine from Earth’s direction. Drag to rotate · scroll to zoom · double-click to drop a site.
          </div>
        </>
      ) : (
        <PolarMap />
      )}
    </section>
  );
}
