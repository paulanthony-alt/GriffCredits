import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatCredits } from "../../money";
import { bucketLabel, type Granularity, type TrendBucket } from "../../trends";
import { credits, labelEvery, MARGIN, niceTicks, Tooltip, useWidth, YAxis } from "./chartKit";

const HEIGHT = 200;

/** Total credits out there at the end of each period: is it building up? */
export default function OutstandingChart({ buckets, granularity }: { buckets: TrendBucket[]; granularity: Granularity }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(Math.max(0, ...buckets.map((b) => b.outstandingCents)));
  const top = ticks[ticks.length - 1];
  const y = (c: number) => MARGIN.top + plotH - (c / top) * plotH;
  const band = plotW / Math.max(1, buckets.length);
  const x = (i: number) => MARGIN.left + band * i + band / 2;
  const every = labelEvery(buckets.length, plotW);

  const points = buckets.map((b, i) => `${x(i)},${y(b.outstandingCents)}`);
  const line = `M${points.join("L")}`;
  const area = `${line}L${x(buckets.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const last = buckets.length - 1;
  const lastB = buckets[last];

  // The crosshair finds the period: the pointer only has to be closest, not on the line.
  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - box.left - band / 2) / band);
    setActive(Math.min(last, Math.max(0, i)));
  }
  function onKey(e: KeyboardEvent<SVGRectElement>) {
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? last) - 1));
    else if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? -1) + 1));
    else return;
    e.preventDefault();
  }

  return (
    <div ref={ref} className="chart-box">
      {width > 0 && buckets.length > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Total credits out there over time. Use the table view for exact values.">
          <YAxis ticks={ticks} y={y} width={width} />
          <path d={area} className="area s-out" />
          <path d={line} className="line s-out" />
          {buckets.map((b, i) =>
            (last - i) % every === 0 ? (
              <text key={b.start.getTime()} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="chart-tick">
                {bucketLabel(b, granularity)}
              </text>
            ) : null,
          )}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={y(0)} className="crosshair" />}
          {active !== null && <circle cx={x(active)} cy={y(buckets[active].outstandingCents)} r={4} className="dot s-out" />}
          {/* Latest value, labeled directly at the end of the line. */}
          <circle cx={x(last)} cy={y(lastB.outstandingCents)} r={4} className="dot s-out" />
          <text x={x(last) - 8} y={y(lastB.outstandingCents) - 10} textAnchor="end" className="chart-end-label">
            {formatCredits(lastB.outstandingCents)}
          </text>
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            className="hit"
            tabIndex={0}
            aria-label="Credits out there over time. Use the left and right arrow keys to step through periods."
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(last)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          />
        </svg>
      )}
      {active !== null && (
        <Tooltip
          x={x(active)}
          gap={10}
          width={width}
          title={`End of ${bucketLabel(buckets[active], granularity, "long").replace(/^Week of/, "week of")}`}
          rows={[{ key: "o", seriesClass: "s-out", label: "out there", value: credits(buckets[active].outstandingCents) }]}
        />
      )}
    </div>
  );
}
