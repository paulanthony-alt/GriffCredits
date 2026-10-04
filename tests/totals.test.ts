import { describe, expect, it } from "vitest";
import { formatCredits } from "../src/money";
import { creditTotals } from "../src/totals";
import type { Customer } from "../src/types";

const customer = (balanceCents: number) => ({ balanceCents }) as Customer;

describe("creditTotals", () => {
  it("adds up every balance to the cent", () => {
    // 0.10 + 0.20 is 0.30000000000000004 in floating point; cents avoid that.
    const totals = creditTotals([customer(10), customer(20), customer(1565), customer(0)]);
    expect(totals).toEqual({ outstandingCents: 1595, customersWithCredit: 3 });
    expect(formatCredits(totals.outstandingCents)).toBe("15.95");
  });

  it("is zero with no customers", () => {
    expect(creditTotals([])).toEqual({ outstandingCents: 0, customersWithCredit: 0 });
  });
});
