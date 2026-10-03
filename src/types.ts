import type { Timestamp } from "firebase/firestore";

export type StaffRole = "staff" | "admin";

/** A Griff staff member: the only people who sign in. */
export interface Staff {
  uid: string;
  username: string;
  name: string;
  role: StaffRole;
  createdAt: Timestamp | null;
}

/** A customer with a credit balance. Customers don't sign in. */
export interface Customer {
  id: string;
  name: string;
  /** Anything that helps staff tell customers apart, e.g. "darts team". */
  notes: string;
  balance: number;
  lastTxId: string | null;
  createdBy: string;
  createdAt: Timestamp | null;
}

export interface CreditTransaction {
  id: string;
  /** Positive = credits loaded, negative = credits spent. */
  amount: number;
  balanceAfter: number;
  note: string;
  /** uid of the staff member who recorded it. */
  createdBy: string;
  createdAt: Timestamp | null;
}
