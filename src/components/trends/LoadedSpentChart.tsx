import { useState } from "react";
import { bucketLabel, type Granularity, type TrendBucket } from "../../trends";
import { columnPath, credits, labelEvery, Legend, MARGIN, niceTicks, Tooltip, useWidth, YAxis } from "./chartKit";

const HEIGHT = 220;

/** Loaded (blue) next to spent (orange) for each period. */
export default function LoadedSpentChart({ buckets, granularity }: { buckets: TrendBucket[]; granularity: Granularity }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const ticks = niceTicks(Math.max(0, ...buckets.flatMap((b) => [b.loadedCents, b.spentCents])));
  const top = ticks[ticks.length - 1];
  const y = (c: number) => MARGIN.top + plotH - (c / top) * plotH;
  const band = plotW / Math.max(1, buckets.length);
  const barW = Math.max(1, Math.min(24, (band * 0.72 - 2) / 2)); // capped; the leftover is air
  const every = labelEvery(buckets.length, plotW);
  const activeBucket = active === null ? null : buckets[active];

  return (
    <div ref={ref} className="chart-box">
      <Legend items={[{ seriesClass: "s-loaded", label: "Loaded", shape: "rect" }, { seriesClass: "s-spent", label: "Spent", shape: "rect" }]} />
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Credits loaded and spent per period. Use the table view for exact values.">
          <YAxis ticks={ticks} y={y} width={width} />
          {buckets.map((b, i) => {
            const cx = MARGIN.left + band * i + band / 2;
            const isActive = active === i;
            return (
              <g
                key={b.start.getTime()}
                className={isActive ? "bar-pair active" : "bar-pair"}
                tabIndex={0}
                aria-label={`${bucketLabel(b, granularity, "long")}: loaded ${credits(b.loadedCents)}, spent ${credits(b.spentCents)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
              >
                {/* The whole period is the hit target, not just the painted bars. */}
                <rect x={cx - band / 2} y={MARGIN.top} width={band} height={plotH} className="hit" />
                <path d={columnPath(cx - barW - 1, y(b.loadedCents), barW, y(0) - y(b.loadedCents))} className="mark s-loaded" />
                <path d={columnPath(cx + 1, y(b.spentCents), barW, y(0) - y(b.spentCents))} className="mark s-spent" />
                {((buckets.length - 1 - i) % every === 0) && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="chart-tick">
                    {bucketLabel(b, granularity)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {activeBucket && (
        <Tooltip
          x={MARGIN.left + band * active! + band / 2}
          gap={band / 2 + 6}
          width={width}
          title={bucketLabel(activeBucket, granularity, "long")}
          rows={[
            { key: "l", seriesClass: "s-loaded", label: "loaded", value: credits(activeBucket.loadedCents) },
            { key: "s", seriesClass: "s-spent", label: "spent", value: credits(activeBucket.spentCents) },
          ]}
        />
      )}
    </div>
  );
}
