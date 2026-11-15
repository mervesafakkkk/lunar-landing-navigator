import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Info, Calculator, BadgeCheck, FlaskConical, Mountain } from 'lucide-react';
import { EDU, type EduKey } from '../lib/education.ts';
import type { Provenance } from '../lib/providers/types.ts';
import { useStore } from '../state/store.tsx';

export function Card({ title, icon, right, children, className = '', accent }: {
  title?: ReactNode; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; accent?: 'sun' | 'earth' | 'risk';
}) {
  const bar = accent === 'sun' ? 'from-sun/70' : accent === 'earth' ? 'from-earth/70' : accent === 'risk' ? 'from-risk/70' : 'from-earth/30';
  return (
    <section className={`panel relative overflow-hidden ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${bar} via-transparent to-transparent`} />
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
            {icon}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

export function InfoTip({ topic, align = 'left' }: { topic: EduKey; align?: 'left' | 'right' }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!state.eduMode) return null;
  const t = EDU[topic];
  return (
    <span ref={ref} className="relative inline-flex align-middle normal-case tracking-normal">
      <button
        type="button"
        aria-label={`Explain: ${t.title}`}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-0.5 text-earth/70 transition hover:text-earth focus:outline-none focus-visible:ring-1 focus-visible:ring-earth"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="dialog"
          className={`absolute top-6 z-50 w-72 rounded-lg border border-earth/30 bg-deep/95 p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-glow backdrop-blur ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <span className="mb-1 block font-display text-[13px] font-semibold text-earth-soft">{t.title}</span>
          {t.body}
        </span>
      )}
    </span>
  );
}

const PROV: Record<Provenance, { label: string; cls: string; icon: ReactNode; tip: string }> = {
  sourced: { label: 'SOURCED', cls: 'border-ok/40 text-ok bg-ok/10', icon: <BadgeCheck size={11} />, tip: 'From an external authoritative source' },
  derived: { label: 'LOLA-DERIVED', cls: 'border-ok/40 text-ok bg-ok/5', icon: <Mountain size={11} />, tip: 'Computed here from NASA source data (LRO LOLA topography)' },
  computed: { label: 'COMPUTED', cls: 'border-earth/40 text-earth-soft bg-earth/10', icon: <Calculator size={11} />, tip: 'Calculated here from published physical models' },
  illustrative: { label: 'ILLUSTRATIVE', cls: 'border-risk-warn/50 text-risk-warn bg-risk-warn/10 stripes', icon: <FlaskConical size={11} />, tip: 'Synthetic demo data, not a measurement' },
};

export function ProvBadge({ p, extra }: { p: Provenance; extra?: string }) {
  const x = PROV[p];
  return (
    <span title={`${x.tip}${extra ? ` — ${extra}` : ''}`} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider ${x.cls}`}>
      {x.icon}
      {x.label}
    </span>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, size = 'sm' }: {
  value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'xs';
}) {
  return (
    <div className="inline-flex rounded-md border border-edge bg-void/60 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded px-2.5 ${size === 'xs' ? 'py-0.5 text-[11px]' : 'py-1 text-xs'} font-medium transition ${
            o.v === value ? 'bg-earth/15 text-earth-soft shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]' : 'text-ink-mute hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Label({ children, tip }: { children: ReactNode; tip?: EduKey }) {
  return (
    <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
      {children}
      {tip && <InfoTip topic={tip} />}
    </div>
  );
}

export function Delta({ value, unit = '', better = 'up', digits = 1 }: { value: number; unit?: string; better?: 'up' | 'down'; digits?: number }) {
  if (Math.abs(value) < Math.pow(10, -digits) / 2) return <span className="font-mono text-xs text-ink-faint">±0{unit}</span>;
  const good = better === 'up' ? value > 0 : value < 0;
  return (
    <span className={`font-mono text-xs font-semibold ${good ? 'text-ok' : 'text-risk'}`}>
      {value > 0 ? '▲ +' : '▼ '}
      {value.toFixed(digits)}
      {unit}
    </span>
  );
}
