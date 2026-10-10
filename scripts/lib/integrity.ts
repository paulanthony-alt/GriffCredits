import type { DocumentData, Firestore } from "firebase-admin/firestore";

// Checks that the stored data is consistent. Problems name documents by their
// random IDs only: reports end up in GitHub logs/issues, which are public on a
// public repository, so no customer names, notes or staff names appear here.

export interface IntegrityReport {
  customers: number;
  transactions: number;
  staff: number;
  /** Sum of every balance. Not printed in public logs; only used for the all-clear email. */
  outstandingCents: number;
  customersWithCredit: number;
  problems: string[];
}

// Same fallbacks as the app (src/services.ts): pre-cents records hold whole credits.
const balanceCentsOf = (d: DocumentData) => (d.balanceCents ?? (d.balance ?? 0) * 100) as number;
const amountCentsOf = (d: DocumentData) => (d.amountCents ?? (d.amount ?? 0) * 100) as number;
const balanceAfterCentsOf = (d: DocumentData) => (d.balanceAfterCents ?? (d.balanceAfter ?? 0) * 100) as number;

export async function checkIntegrity(db: Firestore): Promise<IntegrityReport> {
  const problems: string[] = [];
  let transactions = 0;
  let outstandingCents = 0;
  let customersWithCredit = 0;

  const staffSnap = await db.collection("staff").get();
  const admins = staffSnap.docs.filter((d) => d.get("role") === "admin");
  for (const s of staffSnap.docs) {
    if (!["staff", "admin"].includes(s.get("role"))) problems.push(`Staff ${s.id}: unknown role.`);
  }

  const setup = await db.doc("meta/setup").get();
  if (setup.exists && admins.length === 0) problems.push("No admin account exists, so nobody can manage staff.");
  if (!setup.exists && staffSnap.size > 0) problems.push("Staff exist but first-time setup isn't marked complete.");

  const customersSnap = await db.collection("customers").get();
  for (const c of customersSnap.docs) {
    const data = c.data();
    const balance = balanceCentsOf(data);
    if (!Number.isSafeInteger(balance) || balance < 0) {
      problems.push(`Customer ${c.id}: invalid balance (${balance} cents).`);
      continue;
    }
    outstandingCents += balance;
    if (balance > 0) customersWithCredit++;
    if ("balance" in data && "balanceCents" in data) {
      problems.push(`Customer ${c.id}: has both old and new balance fields.`);
    }

    const txSnap = await c.ref.collection("transactions").get();
    transactions += txSnap.size;
    const byId = new Map(txSnap.docs.map((t) => [t.id, t.data()]));

    let sum = 0;
    for (const [id, t] of byId) {
      const amount = amountCentsOf(t);
      if (!Number.isSafeInteger(amount) || amount === 0) problems.push(`Customer ${c.id}, entry ${id}: invalid amount.`);
      sum += amount;

      if (t.reversesTxId !== undefined || id.startsWith("undo-")) {
        const original = byId.get(t.reversesTxId);
        if (id !== `undo-${t.reversesTxId}` || !original) {
          problems.push(`Customer ${c.id}, entry ${id}: undo doesn't match an existing entry.`);
        } else if (amountCentsOf(original) !== -amount) {
          problems.push(`Customer ${c.id}, entry ${id}: undo amount doesn't reverse the original.`);
        }
      }
    }

    if (sum !== balance) {
      problems.push(`Customer ${c.id}: balance is ${balance} cents but the history adds up to ${sum} cents.`);
    }
    if (data.lastTxId) {
      const last = byId.get(data.lastTxId);
      if (!last) problems.push(`Customer ${c.id}: latest entry ${data.lastTxId} is missing.`);
      else if (balanceAfterCentsOf(last) !== balance) {
        problems.push(`Customer ${c.id}: balance doesn't match the latest entry's balance.`);
      }
    } else if (byId.size > 0) {
      problems.push(`Customer ${c.id}: has history but no latest-entry marker.`);
    }
  }

  return { customers: customersSnap.size, transactions, staff: staffSnap.size, outstandingCents, customersWithCredit, problems };
}
