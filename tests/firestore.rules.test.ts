import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-griff-credits",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const newStaff = (username: string, role: "admin" | "staff") => ({
  username,
  name: username,
  role,
  createdAt: serverTimestamp(),
});

const newCustomer = (name: string, by: string) => ({
  name,
  notes: "",
  balanceCents: 0,
  lastTxId: null,
  createdBy: by,
  createdAt: serverTimestamp(),
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, "meta/setup"), { adminUid: "admin" });
    await setDoc(doc(fs, "staff/admin"), newStaff("admin", "admin"));
    await setDoc(doc(fs, "staff/sam"), newStaff("sam", "staff"));
    await setDoc(doc(fs, "customers/alice"), { ...newCustomer("Alice", "admin"), balanceCents: 1000 });
    await setDoc(doc(fs, "customers/bob"), { ...newCustomer("Bob", "admin"), balanceCents: 500 });
    // Written before amounts had cents: whole credits in `balance`.
    const { balanceCents: _, ...legacy } = newCustomer("Lenny", "admin");
    await setDoc(doc(fs, "customers/lenny"), { ...legacy, balance: 20 });
  });
}

/** Mirrors adjustCredits() in src/services.ts. Amounts are in cents. */
function adjust(
  fs: Firestore,
  id: string,
  amountCents: number,
  by: string,
  overrides: Record<string, unknown> = {},
  customerUpdate: Record<string, unknown> = {},
) {
  const customerRef = doc(fs, "customers", id);
  const txRef = doc(fs, "customers", id, "transactions", `tx-${Math.random().toString(36).slice(2)}`);
  return runTransaction(fs, async (tx) => {
    const data = (await tx.get(customerRef)).data()!;
    const balanceCents = (data.balanceCents ?? data.balance * 100) as number;
    tx.set(txRef, {
      amountCents,
      balanceAfterCents: balanceCents + amountCents,
      note: "",
      createdBy: by,
      createdAt: serverTimestamp(),
      ...overrides,
    });
    tx.update(customerRef, {
      balanceCents: balanceCents + amountCents,
      balance: deleteField(),
      lastTxId: txRef.id,
      ...customerUpdate,
    });
  });
}

describe("first-time setup", () => {
  it("lets the first person make themselves admin, exactly once", async () => {
    const first = db("first");
    const batch = writeBatch(first);
    batch.set(doc(first, "staff/first"), newStaff("first", "admin"));
    batch.set(doc(first, "meta/setup"), { adminUid: "first", createdAt: serverTimestamp() });
    await assertSucceeds(batch.commit());

    const second = db("second");
    const again = writeBatch(second);
    again.set(doc(second, "staff/second"), newStaff("second", "admin"));
    again.set(doc(second, "meta/setup"), { adminUid: "second", createdAt: serverTimestamp() });
    await assertFails(again.commit());
  });

  it("does not let anyone make themselves staff without the setup doc", async () => {
    await assertFails(setDoc(doc(db("sneaky"), "staff/sneaky"), newStaff("sneaky", "admin")));
  });

  it("lets anyone see whether setup is complete", async () => {
    await assertSucceeds(getDoc(doc(db(), "meta/setup")));
  });
});

describe("people who aren't staff", () => {
  beforeEach(seed);

  it("can't read or change anything", async () => {
    for (const fs of [db(), db("stranger")]) {
      await assertFails(getDoc(doc(fs, "customers/alice")));
      await assertFails(getDoc(doc(fs, "staff/admin")));
      await assertFails(setDoc(doc(fs, "customers/eve"), newCustomer("Eve", "stranger")));
    }
    await assertFails(adjust(db("stranger"), "alice", 100, "stranger"));
  });

  it("can check their own staff record (so the app can say 'no access')", async () => {
    await assertSucceeds(getDoc(doc(db("stranger"), "staff/stranger")));
  });

  it("lose access when their staff record is removed", async () => {
    await assertSucceeds(deleteDoc(doc(db("admin"), "staff/sam")));
    await assertFails(getDoc(doc(db("sam"), "customers/alice")));
  });
});

describe("staff", () => {
  beforeEach(seed);

  it("can read customers and add new ones with a zero balance", async () => {
    await assertSucceeds(getDoc(doc(db("sam"), "customers/alice")));
    await assertSucceeds(setDoc(doc(db("sam"), "customers/carol"), newCustomer("Carol", "sam")));
    await assertFails(setDoc(doc(db("sam"), "customers/dave"), { ...newCustomer("Dave", "sam"), balanceCents: 5000 }));
    await assertFails(setDoc(doc(db("sam"), "customers/fred"), { ...newCustomer("Fred", "sam"), balance: 0 }));
    await assertFails(setDoc(doc(db("sam"), "customers/erin"), newCustomer("Erin", "admin")));
  });

  it("can edit customer details but not the balance directly", async () => {
    await assertSucceeds(updateDoc(doc(db("sam"), "customers/alice"), { name: "Alice B", notes: "darts" }));
    await assertFails(updateDoc(doc(db("sam"), "customers/bob"), { balanceCents: 99900 }));
  });

  it("can load and spend credits, including cents, with a ledger entry", async () => {
    // Alice starts on 10.00: +5.35 -> 15.35, -15.65 would overdraw, -12.35 -> 3.00, -3.00 -> 0.00.
    await assertSucceeds(adjust(db("sam"), "alice", 535, "sam"));
    await assertFails(adjust(db("sam"), "alice", -1565, "sam"));
    await assertSucceeds(adjust(db("sam"), "alice", -1235, "sam"));
    await assertSucceeds(adjust(db("sam"), "alice", -300, "sam"));
  });

  it("cannot overdraw a balance, even by one cent", async () => {
    await assertFails(adjust(db("sam"), "bob", -501, "sam"));
    await assertSucceeds(adjust(db("sam"), "bob", -500, "sam"));
  });

  it("cannot fake a ledger entry", async () => {
    await assertFails(adjust(db("sam"), "bob", 500, "sam", { amountCents: 1 }));
    await assertFails(adjust(db("sam"), "bob", 500, "sam", { createdBy: "admin" }));
    await assertFails(adjust(db("sam"), "bob", 150, "sam", { amountCents: 1.5 }));
  });

  it("converts a legacy whole-credit balance on its first change", async () => {
    // Lenny has 20 whole credits = 2000 cents, so spending 15.65 leaves 4.35.
    await assertSucceeds(adjust(db("sam"), "lenny", -1565, "sam"));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const data = (await getDoc(doc(ctx.firestore(), "customers/lenny"))).data()!;
      expect(data.balanceCents).toBe(435);
      expect("balance" in data).toBe(false);
    });
  });

  it("rejects a legacy conversion that treats whole credits as cents or keeps the old field", async () => {
    // Pretending Lenny's 20 credits were 20 cents would wipe out 19.80 credits.
    await assertFails(adjust(db("sam"), "lenny", -10, "sam", { balanceAfterCents: 10 }, { balanceCents: 10 }));
    await assertFails(adjust(db("sam"), "lenny", 100, "sam", {}, { balance: 21 }));
  });

  it("cannot edit or delete ledger entries", async () => {
    await adjust(db("sam"), "alice", 100, "sam");
    let lastTxId = "";
    await env.withSecurityRulesDisabled(async (ctx) => {
      lastTxId = (await getDoc(doc(ctx.firestore(), "customers/alice"))).data()!.lastTxId;
    });
    await assertFails(updateDoc(doc(db("sam"), "customers/alice/transactions", lastTxId), { amountCents: 100000 }));
    await assertFails(deleteDoc(doc(db("sam"), "customers/alice/transactions", lastTxId)));
  });

  it("cannot manage staff", async () => {
    await assertFails(setDoc(doc(db("sam"), "staff/newbie"), newStaff("newbie", "staff")));
    await assertFails(updateDoc(doc(db("sam"), "staff/sam"), { role: "admin" }));
    await assertFails(deleteDoc(doc(db("sam"), "staff/admin")));
  });
});

/** Mirrors undoTransaction() in src/services.ts; overrides let tests try to cheat. */
async function undo(
  fs: Firestore,
  customerId: string,
  txId: string,
  by: string,
  overrides: { amountCents?: number; undoId?: string; reversesTxId?: string } = {},
) {
  const customerRef = doc(fs, "customers", customerId);
  const undoRef = doc(customerRef, "transactions", overrides.undoId ?? `undo-${txId}`);
  return runTransaction(fs, async (tx) => {
    const customer = (await tx.get(customerRef)).data()!;
    const original = (await tx.get(doc(customerRef, "transactions", txId))).data();
    const originalCents = original ? (original.amountCents ?? original.amount * 100) : 0;
    const amountCents = overrides.amountCents ?? -originalCents;
    const balanceCents = (customer.balanceCents ?? customer.balance * 100) + amountCents;
    tx.set(undoRef, {
      amountCents,
      balanceAfterCents: balanceCents,
      note: "Undo",
      createdBy: by,
      createdAt: serverTimestamp(),
      reversesTxId: overrides.reversesTxId ?? txId,
    });
    tx.update(customerRef, { balanceCents, balance: deleteField(), lastTxId: undoRef.id });
  });
}

async function lastTxIdOf(customerId: string) {
  let id = "";
  await env.withSecurityRulesDisabled(async (ctx) => {
    id = (await getDoc(doc(ctx.firestore(), "customers", customerId))).data()!.lastTxId;
  });
  return id;
}

async function balanceOf(customerId: string) {
  let cents = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    cents = (await getDoc(doc(ctx.firestore(), "customers", customerId))).data()!.balanceCents;
  });
  return cents;
}

describe("undo", () => {
  beforeEach(seed);

  it("reverses a spend exactly, once", async () => {
    await assertSucceeds(adjust(db("sam"), "alice", -565, "sam")); // 10.00 -> 4.35
    const spend = await lastTxIdOf("alice");
    await assertSucceeds(undo(db("sam"), "alice", spend, "sam"));
    expect(await balanceOf("alice")).toBe(1000);
    // A second undo of the same entry hits the existing undo doc.
    await assertFails(undo(db("sam"), "alice", spend, "sam"));
  });

  it("cannot undo an undo", async () => {
    await assertSucceeds(adjust(db("sam"), "alice", 500, "sam"));
    const load = await lastTxIdOf("alice");
    await assertSucceeds(undo(db("sam"), "alice", load, "sam"));
    await assertFails(undo(db("sam"), "alice", `undo-${load}`, "sam"));
  });

  it("must reverse the exact amount, under the fixed undo id", async () => {
    await assertSucceeds(adjust(db("sam"), "alice", -500, "sam"));
    const spend = await lastTxIdOf("alice");
    await assertFails(undo(db("sam"), "alice", spend, "sam", { amountCents: 5000 }));
    await assertFails(undo(db("sam"), "alice", spend, "sam", { undoId: "some-other-id" }));
    await assertFails(undo(db("sam"), "alice", spend, "sam", { reversesTxId: "does-not-exist" }));
  });

  it("cannot reverse something that never happened", async () => {
    await assertFails(undo(db("sam"), "alice", "made-up", "sam", { amountCents: 5000 }));
  });

  it("stops a normal entry from squatting on an undo id", async () => {
    const fs = db("sam");
    const customerRef = doc(fs, "customers", "bob");
    const fakeRef = doc(customerRef, "transactions", "undo-something");
    await assertFails(
      runTransaction(fs, async (tx) => {
        tx.set(fakeRef, { amountCents: 100, balanceAfterCents: 600, note: "", createdBy: "sam", createdAt: serverTimestamp() });
        tx.update(customerRef, { balanceCents: 600, lastTxId: fakeRef.id });
      }),
    );
  });

  it("cannot undo if the balance would go below zero", async () => {
    await assertSucceeds(adjust(db("sam"), "bob", 1000, "sam")); // 5.00 -> 15.00
    const load = await lastTxIdOf("bob");
    await assertSucceeds(adjust(db("sam"), "bob", -1200, "sam")); // -> 3.00
    await assertFails(undo(db("sam"), "bob", load, "sam")); // would be -7.00
  });

  it("can undo an entry recorded before cents (whole credits)", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await setDoc(doc(fs, "customers/lenny/transactions/old"), {
        amount: -5, balanceAfter: 20, note: "", createdBy: "admin", createdAt: serverTimestamp(),
      });
    });
    await assertSucceeds(undo(db("sam"), "lenny", "old", "sam"));
    expect(await balanceOf("lenny")).toBe(2500);
  });

  it("is staff-only", async () => {
    await assertSucceeds(adjust(db("sam"), "alice", -100, "sam"));
    const spend = await lastTxIdOf("alice");
    await assertFails(undo(db("stranger"), "alice", spend, "stranger"));
  });
});

describe("admins", () => {
  beforeEach(seed);

  it("can add, promote and remove staff, but not remove themselves", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "staff/newbie"), newStaff("newbie", "staff")));
    await assertSucceeds(updateDoc(doc(db("admin"), "staff/newbie"), { role: "admin" }));
    await assertSucceeds(deleteDoc(doc(db("admin"), "staff/sam")));
    await assertFails(deleteDoc(doc(db("admin"), "staff/admin")));
  });
});
