import type { ReportEntry } from "./report/data";

// Turns the full history into "loaded vs spent" per period plus the running
// total of credits out there, for the Trends charts.

export type TrendRange = "30d" | "12w" | "12m" | "all";

export const TREND_RANGES: { id: TrendRange; label: string }[] = [
  { id: "30d", label: "Last 30 days" },
  { id: "12w", label: "Last 12 weeks" },
  { id: "12m", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

export type Granularity = "day" | "week" | "month";

export interface TrendBucket {
  start: Date;
  end: Date;
  /** Credits loaded in this period (undone loads excluded), in cents. */
  loadedCents: number;
  /** Credits spent in this period (undone spends excluded), positive cents. */
  spentCents: number;
  /** Total credits out there at the end of this period, in cents. */
  outstandingCents: number;
}

export interface Trends {
  granularity: Granularity;
  buckets: TrendBucket[];
  loadedCents: number;
  spentCents: number;
  /** Change in credits out there over the range (includes undos that cross the range edge). */
  netChangeCents: number;
  outstandingNowCents: number;
}

const DAY = 24 * 60 * 60 * 1000;

function startOf(d: Date, g: Granularity): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), g === "month" ? 1 : d.getDate());
  if (g === "week") s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // Monday
  return s;
}

function next(d: Date, g: Granularity): Date {
  const n = new Date(d);
  if (g === "day") n.setDate(n.getDate() + 1);
  else if (g === "week") n.setDate(n.getDate() + 7);
  else n.setMonth(n.getMonth() + 1);
  return n;
}

function rangeStart(range: TrendRange, now: Date, firstEntry: Date | null): { start: Date; granularity: Granularity } {
  if (range === "30d") return { start: startOf(new Date(now.getTime() - 29 * DAY), "day"), granularity: "day" };
  if (range === "12w") return { start: startOf(new Date(now.getTime() - 11 * 7 * DAY), "week"), granularity: "week" };
  if (range === "12m") {
    const s = startOf(now, "month");
    s.setMonth(s.getMonth() - 11);
    return { start: s, granularity: "month" };
  }
  // All time: pick a granularity that keeps the chart readable.
  const first = firstEntry ?? now;
  const days = (now.getTime() - first.getTime()) / DAY;
  const granularity: Granularity = days <= 45 ? "day" : days <= 26 * 7 ? "week" : "month";
  return { start: startOf(first, granularity), granularity };
}

/** Times are bucketed in the device's local time zone. */
export function buildTrends(entries: ReportEntry[], range: TrendRange, now: Date): Trends {
  const dated = entries
    .map((e) => ({ e, at: e.createdAt ? e.createdAt.toDate() : now })) // not yet stamped = just now
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  // An undo and the entry it reverses cancel out, so neither counts as loaded/spent.
  const cancelled = new Set<string>();
  for (const { e } of dated) {
    if (e.reversesTxId) {
      cancelled.add(e.id);
      cancelled.add(e.reversesTxId);
    }
  }

  const { start, granularity } = rangeStart(range, now, dated[0]?.at ?? null);
  const buckets: TrendBucket[] = [];
  for (let s = start; s <= now; s = next(s, granularity)) {
    buckets.push({ start: s, end: next(s, granularity), loadedCents: 0, spentCents: 0, outstandingCents: 0 });
  }

  let running = 0;
  let i = 0;
  // Everything before the range only contributes to the starting total.
  while (i < dated.length && dated[i].at < start) running += dated[i++].e.amountCents;
  const startCents = running;

  for (const b of buckets) {
    while (i < dated.length && dated[i].at < b.end) {
      const { e } = dated[i++];
      running += e.amountCents;
      if (cancelled.has(e.id)) continue;
      if (e.amountCents > 0) b.loadedCents += e.amountCents;
      else b.spentCents -= e.amountCents;
    }
    b.outstandingCents = running;
  }
  // Anything stamped after "now" (clock skew) still belongs in the current total.
  while (i < dated.length) running += dated[i++].e.amountCents;
  if (buckets.length) buckets[buckets.length - 1].outstandingCents = running;

  return {
    granularity,
    buckets,
    loadedCents: buckets.reduce((s, b) => s + b.loadedCents, 0),
    spentCents: buckets.reduce((s, b) => s + b.spentCents, 0),
    netChangeCents: running - startCents,
    outstandingNowCents: running,
  };
}

export function bucketLabel(b: TrendBucket, g: Granularity, style: "short" | "long" = "short"): string {
  if (g === "month") return b.start.toLocaleDateString("en-US", { month: "short", ...(style === "long" || b.start.getMonth() === 0 ? { year: "numeric" } : {}) });
  const day = b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return g === "week" && style === "long" ? `Week of ${day}` : day;
}
