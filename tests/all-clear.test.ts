import { describe, expect, it } from "vitest";
import { allClearMessage, type Stats } from "../scripts/lib/all-clear";

const stats: Stats = { customers: 12, transactions: 340, staff: 3, outstandingCents: 123456, customersWithCredit: 9, problemCount: 0 };
const opts = {
  now: new Date("2026-10-12T11:47:00Z"),
  timeZone: "America/New_York",
  siteUrl: "https://griffcredits.web.app",
  runUrl: "https://github.com/x/y/actions/runs/1",
};

describe("allClearMessage", () => {
  const m = allClearMessage(stats, opts);

  it("says all clear with the date in the Griff's time zone", () => {
    expect(m.subject).toBe("Griff Credits: weekly check all clear (Monday, October 12, 2026)");
  });

  it("lists every check and the credits out there", () => {
    for (const body of [m.text, m.html]) {
      expect(body).toContain("automatic tests all pass");
      expect(body).toContain("No known security problems");
      expect(body).toContain("12 customers, 340 history entries");
      expect(body).toContain("https://griffcredits.web.app");
      expect(body).toContain("1,234.56 credits, held by 9 of 12 customers");
    }
  });

  it("escapes anything placed into the HTML", () => {
    const html = allClearMessage(stats, { ...opts, siteUrl: "<script>x</script>" }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#60;script&#62;");
  });
});
