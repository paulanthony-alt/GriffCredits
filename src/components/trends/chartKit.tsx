import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { formatCredits } from "../../money";

/** Width of an element, tracked as it resizes (charts lay out in real pixels). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean axis ticks from 0 up to at least `maxCents` (e.g. 0 / 50 / 100 / 150). */
export function niceTicks(maxCents: number, count = 4): number[] {
  const max = Math.max(maxCents, 100); // at least 1.00 credit, so an empty chart still has an axis
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** Short axis label: 0 / 50 / 1.2K / 3M credits. */
export function compactCredits(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${+(v / 1e3).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** A column with a 4px rounded data-end and a square base. */
export function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export const MARGIN = { top: 12, right: 12, bottom: 26, left: 48 };

/** Every n-th period gets an x label so they never collide; the latest is always labeled. */
export function labelEvery(count: number, plotWidth: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / 64))));
}

export function YAxis({ ticks, y, width }: { ticks: number[]; y: (c: number) => number; width: number }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} className={t === 0 ? "chart-baseline" : "chart-grid"} />
          <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-tick">
            {compactCredits(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

export interface TooltipRow {
  key: string;
  seriesClass: string;
  label: string;
  value: string;
}

/**
 * Value-first readout, placed beside the hovered period (never on top of it):
 * to its right in the left half of the chart, to its left in the right half.
 */
export function Tooltip({ x, gap, width, title, rows }: { x: number; gap: number; width: number; title: string; rows: TooltipRow[] }) {
  const onRight = x < width / 2;
  const style = onRight ? { left: x + gap } : { right: width - x + gap };
  return (
    <div className="chart-tooltip" style={{ ...style, top: MARGIN.top }} role="status">
      <div className="chart-tooltip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="chart-tooltip-row">
          <span className={`line-key ${r.seriesClass}`} aria-hidden="true" />
          <strong>{r.value}</strong>
          <span className="muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { seriesClass: string; label: string; shape: "rect" | "line" }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <span className={`${i.shape === "rect" ? "swatch" : "line-key"} ${i.seriesClass}`} aria-hidden="true" />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const credits = (cents: number) => `${formatCredits(cents)} credits`;

export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="chart-frame">{children}</div>;
}
