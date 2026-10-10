import { describe, expect, it } from "vitest";
import { buildReportData, type ReportEntry } from "../src/report/data";
import { reportDocument } from "../src/report/document";
import type { Customer } from "../src/types";

const at = (iso: string) => ({ toDate: () => new Date(iso) }) as ReportEntry["createdAt"];
const customer = (id: string, name: string, balanceCents: number): Customer =>
  ({ id, name, notes: "", balanceCents, lastTxId: null, createdBy: "a", createdAt: null }) as Customer;
const entry = (customerId: string, id: string, iso: string, amountCents: number, balanceAfterCents: number, extra: Partial<ReportEntry> = {}): ReportEntry =>
  ({ id, customerId, createdAt: at(iso), amountCents, balanceAfterCents, note: "", createdBy: "sam", ...extra }) as ReportEntry;

// Week = 3–10 Oct. Dave: loaded 20 last week, spent 15.65 this week, undone; then spent 5.
// Jill: loaded 30.25 this week. Zed: never used.
const input = {
  customers: [customer("j", "Jill", 3025), customer("d", "Dave", 1500), customer("z", "zed", 0)],
  entries: [
    entry("d", "t1", "2026-10-01T12:00:00Z", 2000, 2000),
    entry("d", "t2", "2026-10-05T20:00:00Z", -1565, 435, { note: "2 pints" }),
    entry("d", "undo-t2", "2026-10-05T20:05:00Z", 1565, 2000, { note: "Undo: 2 pints", reversesTxId: "t2" }),
    entry("d", "t3", "2026-10-06T21:00:00Z", -500, 1500),
    entry("j", "t4", "2026-10-07T19:00:00Z", 3025, 3025, { createdBy: "gone" }),
  ],
  staffNames: new Map([["sam", "Sam"]]),
  generatedAt: new Date("2026-10-10T23:30:00Z"),
  periodStart: new Date("2026-10-03T23:30:00Z"),
  timeZone: "America/New_York",
};

describe("buildReportData", () => {
  const data = buildReportData(input);

  it("adds up the week so start + loaded − spent + undos = now", () => {
    expect(data.week).toEqual({ startCents: 2000, loadedCents: 3025, spentCents: 2065, undoCents: 1565, endCents: 4525 });
    expect(data.outstandingCents).toBe(4525);
    expect(data.customersWithCredit).toBe(2);
  });

  it("lists balances A–Z, this week's entries in order, and history only for customers who have some", () => {
    expect(data.balances.map((c) => c.name)).toEqual(["Dave", "Jill", "zed"]);
    expect(data.weekLines.map((l) => l.id)).toEqual(["t2", "undo-t2", "t3", "t4"]);
    expect(data.histories.map((h) => [h.customer.name, h.lines.length])).toEqual([["Dave", 4], ["Jill", 1]]);
  });

  it("marks undone entries and names who did each one", () => {
    const byId = new Map(data.weekLines.map((l) => [l.id, l]));
    expect(byId.get("t2")).toMatchObject({ undone: true, isUndo: false, description: "2 pints", by: "Sam" });
    expect(byId.get("undo-t2")).toMatchObject({ undone: false, isUndo: true });
    expect(byId.get("t3")).toMatchObject({ undone: false, description: "Credits spent" });
    expect(byId.get("t4")).toMatchObject({ by: "former staff", description: "Credits loaded" });
  });
});

describe("reportDocument", () => {
  const text = JSON.stringify(reportDocument(buildReportData(input)).content);

  it("includes the summary, every balance and the history, with dates in the chosen time zone", () => {
    for (const s of ["Who has what", "This week's activity", "Full history by customer", "Credits out there now", "45.25", "30.25", "−15.65", "(undone)", "Undo: 2 pints"]) {
      expect(text).toContain(s);
    }
    // 2026-10-05T20:00Z is 4:00 PM in New York.
    expect(text).toContain("Oct 5, 4:00 PM");
  });

  it("only sets a password when asked", () => {
    expect(reportDocument(buildReportData(input))).not.toHaveProperty("userPassword");
    expect(reportDocument(buildReportData(input), { password: "pw" })).toMatchObject({ userPassword: "pw", version: "1.7ext3" });
  });
});
