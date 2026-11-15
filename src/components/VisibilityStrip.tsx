import { useMemo } from 'react';
import type { Visibility } from '../lib/analysis.ts';
import { indexAt } from '../lib/analysis.ts';
import type { SkySeries } from '../lib/providers/types.ts';

interface Props {
  series: SkySeries;
  vis: Visibility;
  start: number;
  end: number;
  cursor?: number;
  rows?: ('sun' | 'earth' | 'both')[];
  compact?: boolean;
  onPick?: (ms: number) => void;
}

const COLORS = { sun: '#f5b82e', earth: '#22d3ee', both: '#e6edf7' };
const LABELS = { sun: 'SUN', earth: 'EARTH', both: 'BOTH' };

/** Gantt-style bands showing when the Sun / Earth / both are visible. */
export function VisibilityStrip({ series, vis, start, end, cursor, rows = ['sun', 'earth', 'both'], compact, onPick }: Props) {
  const W = 1000, rowH = compact ? 10 : 14, gap = 4;
  const H = rows.length * (rowH + gap);
  const segs = useMemo(() => {
    const out: Record<string, [number, number][]> = {};
    const i0 = indexAt(series, start), i1 = indexAt(series, end);
    for (const r of rows) {
      const f = vis[r];
      const list: [number, number][] = [];
      let s = -1;
      for (let i = i0; i <= i1; i++) {
        if (f[i] && s < 0) s = i;
        if ((!f[i] || i === i1) && s >= 0) { list.push([series.t[s], series.t[f[i] ? i : i - 1] + series.stepMs]); s = -1; }
      }
      out[r] = list;
    }
    return out;
  }, [series, vis, start, end, rows.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const x = (t: number) => ((Math.min(end, Math.max(start, t)) - start) / (end - start)) * W;
  return (
    <div className="flex items-stretch">
      <div className="flex w-9 shrink-0 flex-col" style={{ gap }}>
        {rows.map((r) => (
          <span key={r} className="font-mono font-bold leading-none" style={{ color: COLORS[r], height: rowH, fontSize: compact ? 8.5 : 9.5, display: 'flex', alignItems: 'center' }}>{LABELS[r]}</span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={`block min-w-0 flex-1 ${onPick ? 'cursor-pointer' : ''}`}
        style={{ height: H }}
        onClick={onPick ? (e) => {
          const b = e.currentTarget.getBoundingClientRect();
          onPick(start + ((e.clientX - b.left) / b.width) * (end - start));
        } : undefined}
      >
        {rows.map((r, k) => {
          const y = k * (rowH + gap);
          return (
            <g key={r}>
              <rect x={0} y={y} width={W} height={rowH} fill="#ff4d4f" fillOpacity={0.1} />
              {segs[r].map(([a, b], i) => (
                <rect key={i} x={x(a)} y={y} width={Math.max(0.8, x(b) - x(a))} height={rowH} fill={COLORS[r]} fillOpacity={r === 'both' ? 0.75 : 0.85} />
              ))}
            </g>
          );
        })}
        {cursor !== undefined && cursor >= start && cursor <= end && <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={H} stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}
