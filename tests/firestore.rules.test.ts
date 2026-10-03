import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

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
  balance: 0,
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
    await setDoc(doc(fs, "customers/alice"), { ...newCustomer("Alice", "admin"), balance: 10 });
    await setDoc(doc(fs, "customers/bob"), { ...newCustomer("Bob", "admin"), balance: 5 });
  });
}

/** Mirrors adjustCredits() in src/services.ts. */
function adjust(fs: Firestore, id: string, amount: number, by: string, overrides: Record<string, unknown> = {}) {
  const customerRef = doc(fs, "customers", id);
  const txRef = doc(fs, "customers", id, "transactions", `tx-${Math.random().toString(36).slice(2)}`);
  return runTransaction(fs, async (tx) => {
    const balance = (await tx.get(customerRef)).data()!.balance as number;
    tx.set(txRef, {
      amount,
      balanceAfter: balance + amount,
      note: "",
      createdBy: by,
      createdAt: serverTimestamp(),
      ...overrides,
    });
    tx.update(customerRef, { balance: balance + amount, lastTxId: txRef.id });
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
    await assertFails(setDoc(doc(db("sam"), "customers/dave"), { ...newCustomer("Dave", "sam"), balance: 50 }));
    await assertFails(setDoc(doc(db("sam"), "customers/erin"), newCustomer("Erin", "admin")));
  });

  it("can edit customer details but not the balance directly", async () => {
    await assertSucceeds(updateDoc(doc(db("sam"), "customers/alice"), { name: "Alice B", notes: "darts" }));
    await assertFails(updateDoc(doc(db("sam"), "customers/bob"), { balance: 999 }));
  });

  it("can load and spend credits with a ledger entry", async () => {
    await assertSucceeds(adjust(db("sam"), "alice", 5, "sam"));
    await assertSucceeds(adjust(db("sam"), "alice", -15, "sam"));
  });

  it("cannot overdraw a balance", async () => {
    await assertFails(adjust(db("sam"), "bob", -6, "sam"));
  });

  it("cannot fake a ledger entry", async () => {
    await assertFails(adjust(db("sam"), "bob", 5, "sam", { amount: 1 }));
    await assertFails(adjust(db("sam"), "bob", 5, "sam", { createdBy: "admin" }));
  });

  it("cannot edit or delete ledger entries", async () => {
    await adjust(db("sam"), "alice", 1, "sam");
    let lastTxId = "";
    await env.withSecurityRulesDisabled(async (ctx) => {
      lastTxId = (await getDoc(doc(ctx.firestore(), "customers/alice"))).data()!.lastTxId;
    });
    await assertFails(updateDoc(doc(db("sam"), "customers/alice/transactions", lastTxId), { amount: 1000 }));
    await assertFails(deleteDoc(doc(db("sam"), "customers/alice/transactions", lastTxId)));
  });

  it("cannot manage staff", async () => {
    await assertFails(setDoc(doc(db("sam"), "staff/newbie"), newStaff("newbie", "staff")));
    await assertFails(updateDoc(doc(db("sam"), "staff/sam"), { role: "admin" }));
    await assertFails(deleteDoc(doc(db("sam"), "staff/admin")));
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
