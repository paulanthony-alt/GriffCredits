import { initializeTestEnvironment, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, type Firestore as AdminFirestore } from "firebase-admin/firestore";
import { doc as clientDoc, runTransaction, serverTimestamp, type Firestore } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBackup, parseBackup, restoreBackup } from "../scripts/lib/dump";
import { adminDb } from "../scripts/lib/firestore";
import { checkIntegrity } from "../scripts/lib/integrity";

const PROJECT = "demo-griff-credits";
let env: RulesTestEnvironment;
let db: AdminFirestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  db = adminDb(PROJECT);
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

const at = (s: number) => new Timestamp(1_790_000_000 + s, 123_000_000);

/** A small but realistic database: cents, a legacy customer, an undo. */
async function seed() {
  await db.doc("meta/setup").set({ adminUid: "admin", createdAt: at(0) });
  await db.doc("staff/admin").set({ username: "paul", name: "Paul", role: "admin", createdAt: at(0) });
  await db.doc("staff/sam").set({ username: "sam", name: "Sam", role: "staff", createdAt: at(1) });

  await db.doc("customers/dave").set({
    name: "Dave Smith", notes: "darts", balanceCents: 2000, lastTxId: "undo-t2", createdBy: "admin", createdAt: at(2),
  });
  await db.doc("customers/dave/transactions/t1").set({
    amountCents: 2000, balanceAfterCents: 2000, note: "", createdBy: "admin", createdAt: at(3),
  });
  await db.doc("customers/dave/transactions/t2").set({
    amountCents: -1565, balanceAfterCents: 435, note: "2 pints", createdBy: "sam", createdAt: at(4),
  });
  await db.doc("customers/dave/transactions/undo-t2").set({
    amountCents: 1565, balanceAfterCents: 2000, note: "Undo: 2 pints", createdBy: "admin", createdAt: at(5), reversesTxId: "t2",
  });

  // Recorded before cents: whole credits.
  await db.doc("customers/lenny").set({
    name: "Lenny", notes: "", balance: 15, lastTxId: "old", createdBy: "admin", createdAt: at(6),
  });
  await db.doc("customers/lenny/transactions/old").set({
    amount: 15, balanceAfter: 15, note: "", createdBy: "admin", createdAt: at(7),
  });
}

const snapshot = async () => (await createBackup(db, PROJECT)).documents;

describe("backup and restore", () => {
  it("captures every document, including each customer's history", async () => {
    const backup = await createBackup(db, PROJECT);
    expect(backup.count).toBe(9);
    expect(Object.keys(backup.documents)).toContain("customers/dave/transactions/undo-t2");
    expect(backup.documents["customers/dave/transactions/t2"].createdAt).toEqual({
      __type: "timestamp", seconds: 1_790_000_004, nanoseconds: 123_000_000,
    });
  });

  it("restores the exact data, removing anything added since", async () => {
    const before = await snapshot();
    const file = JSON.stringify(await createBackup(db, PROJECT));

    // Things go wrong after the backup was taken...
    await db.doc("customers/dave").update({ balanceCents: 999999 });
    await db.doc("customers/dave/transactions/bogus").set({ amountCents: 1, note: "glitch" });
    await db.doc("customers/eve").set({ name: "Eve" });
    await db.doc("staff/sam").delete();

    await restoreBackup(db, parseBackup(file));
    expect(await snapshot()).toEqual(before);
  });

  it("keeps cents as whole numbers, so the app's security rules accept restored balances", async () => {
    await restoreBackup(db, parseBackup(JSON.stringify(await createBackup(db, PROJECT))));
    // A real staff spend via the client SDK, under the security rules ("balanceCents is int").
    const fs = env.authenticatedContext("sam").firestore() as unknown as Firestore;
    const customerRef = clientDoc(fs, "customers/dave");
    const txRef = clientDoc(fs, "customers/dave/transactions/after-restore");
    await assertSucceeds(
      runTransaction(fs, async (tx) => {
        await tx.get(customerRef);
        tx.set(txRef, { amountCents: -500, balanceAfterCents: 1500, note: "", createdBy: "sam", createdAt: serverTimestamp() });
        tx.update(customerRef, { balanceCents: 1500, lastTxId: txRef.id });
      }),
    );
  });

  it("rejects a truncated or foreign file", () => {
    expect(() => parseBackup('{"format":"something-else"}')).toThrow(/isn't a Griff Credits backup/);
    expect(() =>
      parseBackup(JSON.stringify({ format: "griff-credits-backup", version: 1, count: 5, documents: {} })),
    ).toThrow(/incomplete/);
  });
});

describe("data health check", () => {
  it("passes on healthy data, including legacy and undo entries", async () => {
    const report = await checkIntegrity(db);
    expect(report).toMatchObject({ customers: 2, transactions: 4, staff: 2, problems: [] });
  });

  it("catches a balance that doesn't match the history", async () => {
    await db.doc("customers/dave").update({ balanceCents: 2500 });
    const { problems } = await checkIntegrity(db);
    expect(problems).toContain("Customer dave: balance is 2500 cents but the history adds up to 2000 cents.");
  });

  it("catches a broken undo and a missing latest entry", async () => {
    await db.doc("customers/dave/transactions/undo-t2").update({ amountCents: 1000 });
    await db.doc("customers/lenny").update({ lastTxId: "gone" });
    const { problems } = await checkIntegrity(db);
    expect(problems.some((p) => p.includes("undo amount doesn't reverse"))).toBe(true);
    expect(problems.some((p) => p.includes("Customer lenny: latest entry gone is missing"))).toBe(true);
  });

  it("catches a missing admin", async () => {
    await db.doc("staff/admin").delete();
    expect((await checkIntegrity(db)).problems).toContain("No admin account exists, so nobody can manage staff.");
  });

  it("never mentions customer or staff names, notes or entry notes", async () => {
    await db.doc("customers/dave").update({ balanceCents: 1 });
    await db.doc("customers/dave/transactions/undo-t2").update({ amountCents: 7 });
    const text = (await checkIntegrity(db)).problems.join("\n");
    expect(text.length).toBeGreaterThan(0);
    for (const secret of ["Dave", "Smith", "darts", "pints", "Paul", "Sam", "Lenny"]) {
      expect(text).not.toContain(secret);
    }
  });
});
