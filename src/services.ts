import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db, firebaseConfig, useEmulators } from "./firebase";
import {
  isValidPin,
  isValidUsername,
  normalizeUsername,
  pinToPassword,
  usernameToEmail,
} from "./pin";
import { formatCredits } from "./money";
import type { CreditTransaction, Customer, Staff, StaffRole } from "./types";

// ---------- Auth ----------

export async function signInWithPin(username: string, pin: string): Promise<void> {
  await signInWithEmailAndPassword(auth, usernameToEmail(username), pinToPassword(pin));
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

export async function changeOwnPin(currentPin: string, newPin: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Not signed in.");
  if (!isValidPin(newPin)) throw new Error("New PIN must be 4–6 digits.");
  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, pinToPassword(currentPin)),
  );
  await updatePassword(user, pinToPassword(newPin));
}

// ---------- First-time setup ----------

export async function isSetupComplete(): Promise<boolean> {
  return (await getDoc(doc(db, "meta", "setup"))).exists();
}

/** Creates the very first staff account and makes it an admin. Only works once. */
export async function createFirstAdmin(name: string, rawUsername: string, pin: string): Promise<void> {
  const username = validateNewStaff(name, rawUsername, pin);
  const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), pinToPassword(pin));
  const batch = writeBatch(db);
  batch.set(doc(db, "staff", cred.user.uid), newStaffDoc(name, username, "admin"));
  batch.set(doc(db, "meta", "setup"), { adminUid: cred.user.uid, createdAt: serverTimestamp() });
  await batch.commit();
}

// ---------- Staff (admin only) ----------

/**
 * Creates a sign-in account for a new staff member without signing the admin out.
 * createUserWithEmailAndPassword always signs in as the new user, so it runs
 * on a short-lived secondary Firebase app instead of the main one.
 */
export async function createStaff(name: string, rawUsername: string, pin: string, role: StaffRole = "staff"): Promise<void> {
  const username = validateNewStaff(name, rawUsername, pin);
  const secondary = initializeApp(firebaseConfig, `staff-creator-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    if (useEmulators) connectAuthEmulator(secondaryAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secondaryAuth, usernameToEmail(username), pinToPassword(pin));
    await signOut(secondaryAuth);
    // Written by the admin's own session so the security rules can check their role.
    await setDoc(doc(db, "staff", cred.user.uid), newStaffDoc(name, username, role));
  } finally {
    await deleteApp(secondary);
  }
}

/** Revokes a staff member's access. Their login still exists but can no longer read or write anything. */
export function removeStaff(uid: string): Promise<void> {
  return deleteDoc(doc(db, "staff", uid));
}

export function watchStaffMember(uid: string, onChange: (s: Staff | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "staff", uid),
    { includeMetadataChanges: true },
    (snap) => {
      // Wait for the server to confirm local writes (e.g. first-time setup), or
      // screens would query with a role the security rules can't see yet.
      if (snap.metadata.hasPendingWrites) return;
      onChange(snap.exists() ? ({ uid: snap.id, ...snap.data() } as Staff) : null);
    },
    onError,
  );
}

export function watchAllStaff(onChange: (s: Staff[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "staff"), orderBy("name")),
    (snap) => onChange(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Staff)),
    onError,
  );
}

// ---------- Customers ----------

export async function createCustomer(name: string, notes: string): Promise<string> {
  const staffUid = auth.currentUser?.uid;
  if (!staffUid) throw new Error("Not signed in.");
  if (!name.trim()) throw new Error("Name is required.");
  const ref = await addDoc(collection(db, "customers"), {
    name: name.trim().slice(0, 64),
    notes: notes.trim().slice(0, 200),
    balanceCents: 0,
    lastTxId: null,
    createdBy: staffUid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateCustomer(id: string, name: string, notes: string): Promise<void> {
  if (!name.trim()) return Promise.reject(new Error("Name is required."));
  return updateDoc(doc(db, "customers", id), {
    name: name.trim().slice(0, 64),
    notes: notes.trim().slice(0, 200),
  });
}

export function watchCustomers(onChange: (c: Customer[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "customers"), orderBy("name")),
    (snap) => onChange(snap.docs.map((d) => toCustomer(d.id, d.data()))),
    onError,
  );
}

export function watchTransactions(
  customerId: string,
  onChange: (t: CreditTransaction[]) => void,
  onError?: (e: Error) => void,
  max = 50,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "customers", customerId, "transactions"), orderBy("createdAt", "desc"), limit(max)),
    (snap) => onChange(snap.docs.map((d) => toTransaction(d.id, d.data()))),
    onError,
  );
}

// ---------- Credits ----------

/**
 * Loads (positive) or spends (negative) credits for a customer, in cents.
 * Balance and ledger entry are written atomically; spending more than the
 * balance is rejected.
 */
export async function adjustCredits(customerId: string, amountCents: number, note: string): Promise<void> {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) throw new Error("Enter an amount above zero.");
  const staffUid = auth.currentUser?.uid;
  if (!staffUid) throw new Error("Not signed in.");

  const customerRef = doc(db, "customers", customerId);
  const txRef = doc(collection(customerRef, "transactions"));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) throw new Error("Customer not found.");
    const balanceCents = toCustomer(snap.id, snap.data()).balanceCents;
    const newBalanceCents = balanceCents + amountCents;
    if (newBalanceCents < 0) throw new Error(`Not enough credits (balance ${formatCredits(balanceCents)}).`);
    tx.set(txRef, {
      amountCents,
      balanceAfterCents: newBalanceCents,
      note: note.trim().slice(0, 200),
      createdBy: staffUid,
      createdAt: serverTimestamp(),
    });
    // deleteField() drops a legacy whole-credit `balance` (see toCustomer).
    tx.update(customerRef, { balanceCents: newBalanceCents, balance: deleteField(), lastTxId: txRef.id });
  });
}

// ---------- helpers ----------

// Records written before amounts had cents store whole credits in `balance`,
// `amount` and `balanceAfter`; these read either shape as cents.
function toCustomer(id: string, d: DocumentData): Customer {
  const { balance, ...rest } = d;
  return { id, ...rest, balanceCents: d.balanceCents ?? (balance ?? 0) * 100 } as Customer;
}

function toTransaction(id: string, d: DocumentData): CreditTransaction {
  const { amount, balanceAfter, ...rest } = d;
  return {
    id,
    ...rest,
    amountCents: d.amountCents ?? amount * 100,
    balanceAfterCents: d.balanceAfterCents ?? balanceAfter * 100,
  } as CreditTransaction;
}

function validateNewStaff(name: string, rawUsername: string, pin: string): string {
  const username = normalizeUsername(rawUsername);
  if (!name.trim()) throw new Error("Name is required.");
  if (!isValidUsername(username)) throw new Error("Username must be 2–32 characters: letters, numbers, . _ -");
  if (!isValidPin(pin)) throw new Error("PIN must be 4–6 digits.");
  return username;
}

function newStaffDoc(name: string, username: string, role: StaffRole) {
  return {
    username,
    name: name.trim().slice(0, 64),
    role,
    createdAt: serverTimestamp(),
  };
}

/** Turns Firebase error codes into something a person at the bar can read. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Wrong username or PIN.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a bit and try again.";
    case "auth/email-already-in-use":
      return "That username is already taken.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check the connection.";
    case "permission-denied":
      return "You don't have permission to do that.";
  }
  return e instanceof Error ? e.message : String(e);
}
