import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import {
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

const newUser = (username: string, role: "admin" | "member") => ({
  username,
  name: username,
  role,
  balance: 0,
  lastTxId: null,
  createdAt: serverTimestamp(),
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, "meta/setup"), { adminUid: "admin" });
    await setDoc(doc(fs, "users/admin"), { ...newUser("admin", "admin"), balance: 0 });
    await setDoc(doc(fs, "users/alice"), { ...newUser("alice", "member"), balance: 10 });
    await setDoc(doc(fs, "users/bob"), { ...newUser("bob", "member"), balance: 5 });
  });
}

/** Mirrors adjustCredits() in src/services.ts. */
function adjust(fs: Firestore, uid: string, amount: number, by: string, overrides: Record<string, unknown> = {}) {
  const userRef = doc(fs, "users", uid);
  const txRef = doc(fs, "users", uid, "transactions", `tx-${Math.random().toString(36).slice(2)}`);
  return runTransaction(fs, async (tx) => {
    const balance = (await tx.get(userRef)).data()!.balance as number;
    tx.set(txRef, {
      amount,
      balanceAfter: balance + amount,
      note: "",
      createdBy: by,
      createdAt: serverTimestamp(),
      ...overrides,
    });
    tx.update(userRef, { balance: balance + amount, lastTxId: txRef.id });
  });
}

describe("first-time setup", () => {
  it("lets the first user make themselves admin, exactly once", async () => {
    const first = db("first");
    const batch = writeBatch(first);
    batch.set(doc(first, "users/first"), newUser("first", "admin"));
    batch.set(doc(first, "meta/setup"), { adminUid: "first", createdAt: serverTimestamp() });
    await assertSucceeds(batch.commit());

    const second = db("second");
    const again = writeBatch(second);
    again.set(doc(second, "users/second"), newUser("second", "admin"));
    again.set(doc(second, "meta/setup"), { adminUid: "second", createdAt: serverTimestamp() });
    await assertFails(again.commit());
  });

  it("does not let a user make themselves admin without the setup doc", async () => {
    const fs = db("sneaky");
    await assertFails(setDoc(doc(fs, "users/sneaky"), newUser("sneaky", "admin")));
  });

  it("lets anyone see whether setup is complete", async () => {
    await assertSucceeds(getDoc(doc(db(), "meta/setup")));
  });
});

describe("members", () => {
  beforeEach(seed);

  it("can read their own profile but not others", async () => {
    await assertSucceeds(getDoc(doc(db("alice"), "users/alice")));
    await assertFails(getDoc(doc(db("alice"), "users/bob")));
    await assertFails(getDoc(doc(db(), "users/alice")));
  });

  it("cannot create accounts or change balances", async () => {
    await assertFails(setDoc(doc(db("alice"), "users/carol"), newUser("carol", "member")));
    await assertFails(adjust(db("alice"), "alice", 100, "alice"));
    await assertFails(updateDoc(doc(db("alice"), "users/alice"), { role: "admin" }));
  });
});

describe("admins", () => {
  beforeEach(seed);

  it("can create members, but only with a zero balance", async () => {
    await assertSucceeds(setDoc(doc(db("admin"), "users/carol"), newUser("carol", "member")));
    await assertFails(setDoc(doc(db("admin"), "users/dave"), { ...newUser("dave", "member"), balance: 50 }));
  });

  it("can add and spend credits with a ledger entry", async () => {
    await assertSucceeds(adjust(db("admin"), "alice", 5, "admin"));
    await assertSucceeds(adjust(db("admin"), "alice", -15, "admin"));
  });

  it("cannot overdraw a balance", async () => {
    await assertFails(adjust(db("admin"), "bob", -6, "admin"));
  });

  it("cannot change a balance without a matching ledger entry", async () => {
    await assertFails(updateDoc(doc(db("admin"), "users/bob"), { balance: 999 }));
    await assertFails(adjust(db("admin"), "bob", 5, "admin", { amount: 1 }));
    await assertFails(adjust(db("admin"), "bob", 5, "admin", { createdBy: "someone-else" }));
  });

  it("cannot edit or delete ledger entries", async () => {
    await adjust(db("admin"), "alice", 1, "admin");
    let lastTxId = "";
    await env.withSecurityRulesDisabled(async (ctx) => {
      lastTxId = (await getDoc(doc(ctx.firestore(), "users/alice"))).data()!.lastTxId;
    });
    await assertFails(updateDoc(doc(db("admin"), "users/alice/transactions", lastTxId), { amount: 1000 }));
  });
});
