import type { CreditTransaction, Customer } from "./types";

// Turns stored documents into app records. No Firebase imports, so the
// reporting/backup scripts (Node) can share this with the app.
//
// Records written before amounts had cents store whole credits in `balance`,
// `amount` and `balanceAfter`; these read either shape as cents.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;

export function toCustomer(id: string, d: Data): Customer {
  const { balance, ...rest } = d;
  return { id, ...rest, balanceCents: d.balanceCents ?? (balance ?? 0) * 100 } as Customer;
}

export function toTransaction(id: string, d: Data): CreditTransaction {
  const { amount, balanceAfter, ...rest } = d;
  return {
    id,
    ...rest,
    amountCents: d.amountCents ?? amount * 100,
    balanceAfterCents: d.balanceAfterCents ?? balanceAfter * 100,
  } as CreditTransaction;
}
