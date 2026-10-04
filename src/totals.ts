import type { Customer } from "./types";

export interface CreditTotals {
  /** Sum of every customer's balance: all credits loaded and not yet spent. */
  outstandingCents: number;
  /** Customers with a balance above zero. */
  customersWithCredit: number;
}

/**
 * Totals across all customers. Balances only ever change together with a
 * history entry (enforced by firestore.rules), so this always equals
 * everything loaded minus everything spent.
 */
export function creditTotals(customers: Customer[]): CreditTotals {
  let outstandingCents = 0;
  let customersWithCredit = 0;
  for (const c of customers) {
    outstandingCents += c.balanceCents;
    if (c.balanceCents > 0) customersWithCredit++;
  }
  return { outstandingCents, customersWithCredit };
}
