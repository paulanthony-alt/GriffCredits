import { describe, expect, it } from "vitest";
import type { ReportEntry } from "../src/report/data";
import { bucketLabel, buildTrends } from "../src/trends";

// Local times, so bucketing matches the device's time zone in any environment.
const at = (y: number, m: number, d: number, h = 12) => ({ toDate: () => new Date(y, m - 1, d, h) }) as ReportEntry["createdAt"];
const e = (id: string, when: ReportEntry["createdAt"], amountCents: number, extra: Partial<ReportEntry> = {}): ReportEntry =>
  ({ id, customerId: "c", createdAt: when, amountCents, balanceAfterCents: 0, note: "", createdBy: "s", ...extra }) as ReportEntry;

const now = new Date(2026, 9, 24, 15); // Sat Oct 24 2026, 3 PM
const entries = [
  e("old", at(2026, 6, 1), 10000), //            before every range: only counts toward the total
  e("a", at(2026, 10, 5), 5000), //              Mon Oct 5: load 50.00
  e("b", at(2026, 10, 6), -1565), //             spend 15.65
  e("c", at(2026, 10, 20), -2000), //            spend 20.00 ...
  e("undo-c", at(2026, 10, 20, 13), 2000, { reversesTxId: "c" }), // ... undone
  e("d", at(2026, 10, 24, 9), 2525), //           load 25.25 today
  e("pending", null, -500), //                    just written, no server time yet = now
];

describe("buildTrends", () => {
  it("buckets by day for the last 30 days, with undos cancelling out", () => {
    const t = buildTrends(entries, "30d", now);
    expect(t.granularity).toBe("day");
    expect(t.buckets).toHaveLength(30);
    expect(t.buckets[0].start).toEqual(new Date(2026, 8, 25));
    const day = (d: number) => t.buckets.find((b) => b.start.getDate() === d && b.start.getMonth() === 9)!;
    expect(day(5)).toMatchObject({ loadedCents: 5000, spentCents: 0, outstandingCents: 15000 });
    expect(day(6)).toMatchObject({ loadedCents: 0, spentCents: 1565, outstandingCents: 13435 });
    expect(day(20)).toMatchObject({ loadedCents: 0, spentCents: 0, outstandingCents: 13435 });
    expect(day(24)).toMatchObject({ loadedCents: 2525, spentCents: 500, outstandingCents: 15460 });
    expect(t).toMatchObject({ loadedCents: 7525, spentCents: 2065, netChangeCents: 5460, outstandingNowCents: 15460 });
  });

  it("the running total always equals the real sum of every balance change", () => {
    for (const range of ["30d", "12w", "12m", "all"] as const) {
      const t = buildTrends(entries, range, now);
      expect(t.outstandingNowCents).toBe(10000 + 5000 - 1565 - 2000 + 2000 + 2525 - 500);
      expect(t.buckets.at(-1)!.outstandingCents).toBe(t.outstandingNowCents);
    }
  });

  it("buckets weeks from Monday and months from the 1st", () => {
    const w = buildTrends(entries, "12w", now);
    expect(w.granularity).toBe("week");
    expect(w.buckets).toHaveLength(12);
    expect(w.buckets.every((b) => b.start.getDay() === 1)).toBe(true);
    expect(w.buckets.find((b) => b.start.getTime() === new Date(2026, 9, 5).getTime())).toMatchObject({ loadedCents: 5000, spentCents: 1565 });

    const m = buildTrends(entries, "12m", now);
    expect(m.granularity).toBe("month");
    expect(m.buckets).toHaveLength(12);
    expect(m.buckets[0].start).toEqual(new Date(2025, 10, 1));
    expect(m.buckets.at(-1)).toMatchObject({ loadedCents: 7525, spentCents: 2065 });
  });

  it("picks a readable granularity for all time", () => {
    expect(buildTrends(entries, "all", now).granularity).toBe("week"); // ~4.5 months of history
    expect(buildTrends([e("x", at(2026, 10, 1), 100)], "all", now).granularity).toBe("day");
    expect(buildTrends([e("x", at(2024, 1, 1), 100)], "all", now).granularity).toBe("month");
    expect(buildTrends([], "all", now).buckets).toHaveLength(1);
  });

  it("labels periods readably", () => {
    const t = buildTrends(entries, "12w", now);
    expect(bucketLabel(t.buckets.at(-1)!, "week", "long")).toBe("Week of Oct 19");
    const m = buildTrends(entries, "12m", now);
    expect(m.buckets.map((b) => bucketLabel(b, "month")).slice(1, 3)).toEqual(["Dec", "Jan 2026"]);
  });
});
