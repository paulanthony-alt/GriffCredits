import type { Timestamp } from "firebase/firestore";

export type Role = "member" | "admin";

export interface Member {
  uid: string;
  username: string;
  name: string;
  role: Role;
  balance: number;
  lastTxId: string | null;
  createdAt: Timestamp | null;
}

export interface CreditTransaction {
  id: string;
  /** Positive = credits added, negative = credits spent. */
  amount: number;
  balanceAfter: number;
  note: string;
  createdBy: string;
  createdAt: Timestamp | null;
}
