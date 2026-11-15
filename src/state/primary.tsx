import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from './store.tsx';
import { useScenarioAnalysis, type ScenarioAnalysis } from './useAnalysis.ts';

const Ctx = createContext<ScenarioAnalysis | null>(null);

/** Analysis of the primary (currently selected) scenario, shared by all panels. */
export function PrimaryProvider({ children }: { children: ReactNode }) {
  const { state, site } = useStore();
  const a = useScenarioAnalysis({ site, landingMs: state.landingMs, durationDays: state.durationDays });
  return <Ctx.Provider value={a}>{children}</Ctx.Provider>;
}

export function usePrimary() {
  const a = useContext(Ctx);
  if (!a) throw new Error('usePrimary outside provider');
  return a;
}
