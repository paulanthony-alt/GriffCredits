import { useEffect, useMemo, useRef, useState } from "react";
import { formatCredits } from "../../money";
import type { ReportEntry } from "../../report/data";
import { friendlyError, watchAllEntries } from "../../services";
import { bucketLabel, buildTrends, TREND_RANGES, type TrendRange, type Trends } from "../../trends";
import { credits } from "./chartKit";
import LoadedSpentChart from "./LoadedSpentChart";
import OutstandingChart from "./OutstandingChart";

const PERIOD_NAME = { day: "day", week: "week", month: "month" } as const;

function summary(t: Trends, rangeLabel: string): string {
  const diff = t.loadedCents - t.spentCents;
  const head = `${rangeLabel}: ${credits(t.loadedCents)} loaded and ${credits(t.spentCents)} spent`;
  if (t.loadedCents === 0 && t.spentCents === 0) return `${rangeLabel}: no credits loaded or spent.`;
  if (diff > 0) return `${head}, so ${formatCredits(diff)} more went out than came back in, and credits out there are building up.`;
  if (diff < 0) return `${head}, so ${formatCredits(-diff)} more was spent than loaded, and credits out there are going down.`;
  return `${head}: loads and spending balanced out exactly.`;
}

export default function TrendsPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ReportEntry[] | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<TrendRange>("12w");
  const [showTable, setShowTable] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => watchAllEntries(setEntries, (e) => setError(friendlyError(e))), []);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // Keep the page behind still while the panel scrolls (phones).
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const trends = useMemo(() => (entries ? buildTrends(entries, range, new Date()) : null), [entries, range]);
  const rangeLabel = TREND_RANGES.find((r) => r.id === range)!.label;
  const diff = trends ? trends.loadedCents - trends.spentCents : 0;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="trends-panel" role="dialog" aria-modal="true" aria-labelledby="trends-title">
        <div className="row spread">
          <h2 id="trends-title">Credits trends</h2>
          <button ref={closeRef} className="ghost" onClick={onClose}>Close</button>
        </div>

        {/* Filters: one row, above everything they scope. */}
        <div className="range-row" role="group" aria-label="Time range">
          {TREND_RANGES.map((r) => (
            <button key={r.id} className={r.id === range ? "tab active" : "tab"} aria-pressed={r.id === range} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}
        {!trends && !error && <p className="muted">Loading history…</p>}

        {trends && (
          <>
            <div className="stat-row">
              <div className="stat"><div className="stat-label">Loaded</div><div className="stat-value">{formatCredits(trends.loadedCents)}</div></div>
              <div className="stat"><div className="stat-label">Spent</div><div className="stat-value">{formatCredits(trends.spentCents)}</div></div>
              <div className="stat">
                <div className="stat-label">{diff >= 0 ? "Loaded but not spent" : "Spent beyond loaded"}</div>
                <div className="stat-value">{formatCredits(Math.abs(diff))}</div>
              </div>
              <div className="stat"><div className="stat-label">Credits out there now</div><div className="stat-value">{formatCredits(trends.outstandingNowCents)}</div></div>
            </div>
            <p className="trend-summary">{summary(trends, rangeLabel)}</p>

            <section>
              <h3>Loaded vs spent per {PERIOD_NAME[trends.granularity]}</h3>
              <LoadedSpentChart buckets={trends.buckets} granularity={trends.granularity} />
            </section>
            <section>
              <h3>Credits out there</h3>
              <p className="muted small chart-sub">Total of every customer's balance at the end of each {PERIOD_NAME[trends.granularity]}.</p>
              <OutstandingChart buckets={trends.buckets} granularity={trends.granularity} />
            </section>

            <button className="link" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
              {showTable ? "Hide table" : "Show as a table"}
            </button>
            {showTable && (
              <div className="table-scroll">
                <table className="trend-table">
                  <thead>
                    <tr><th>Period</th><th>Loaded</th><th>Spent</th><th>Out there at end</th></tr>
                  </thead>
                  <tbody>
                    {[...trends.buckets].reverse().map((b) => (
                      <tr key={b.start.getTime()}>
                        <td>{bucketLabel(b, trends.granularity, "long")}</td>
                        <td>{formatCredits(b.loadedCents)}</td>
                        <td>{formatCredits(b.spentCents)}</td>
                        <td>{formatCredits(b.outstandingCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
