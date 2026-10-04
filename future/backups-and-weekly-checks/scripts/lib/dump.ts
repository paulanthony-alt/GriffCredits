import {
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";

export const BACKUP_FORMAT_VERSION = 1;

export interface Backup {
  format: "griff-credits-backup";
  version: number;
  projectId: string;
  createdAt: string;
  /** Number of documents, so a truncated file is easy to spot. */
  count: number;
  /** Full document path -> encoded fields, e.g. "customers/abc/transactions/xyz". */
  documents: Record<string, Record<string, unknown>>;
}

// JSON can't hold Firestore timestamps, so they're tagged. Numbers, strings,
// booleans, null, arrays and maps pass through; whole numbers are written back
// as integers, which the security rules rely on for cents.
type Encoded = null | boolean | number | string | Encoded[] | { [key: string]: Encoded };

export function encodeValue(value: unknown): Encoded {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Can't back up the number ${value}.`);
    return value;
  }
  if (value instanceof Timestamp) {
    return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)]));
  }
  throw new Error(`Backup doesn't support this kind of value yet: ${value?.constructor?.name ?? typeof value}`);
}

export function decodeValue(value: Encoded): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value !== null && typeof value === "object") {
    if (value.__type === "timestamp") return new Timestamp(value.seconds as number, value.nanoseconds as number);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeValue(v)]));
  }
  return value;
}

/** Reads every document in the database, including subcollections. */
export async function createBackup(db: Firestore, projectId: string): Promise<Backup> {
  const documents: Backup["documents"] = {};

  async function walkCollection(col: CollectionReference) {
    const docs = await col.listDocuments();
    for (const ref of docs) await walkDoc(ref);
  }

  async function walkDoc(ref: DocumentReference) {
    // listDocuments() also returns "missing" parents that only hold subcollections.
    const snap = await ref.get();
    if (snap.exists) documents[ref.path] = encodeValue(snap.data()) as Record<string, unknown>;
    for (const sub of await ref.listCollections()) await walkCollection(sub);
  }

  for (const col of await db.listCollections()) await walkCollection(col);

  const sorted = Object.fromEntries(Object.entries(documents).sort(([a], [b]) => a.localeCompare(b)));
  return {
    format: "griff-credits-backup",
    version: BACKUP_FORMAT_VERSION,
    projectId,
    createdAt: new Date().toISOString(),
    count: Object.keys(sorted).length,
    documents: sorted,
  };
}

export function parseBackup(json: string): Backup {
  const backup = JSON.parse(json) as Backup;
  if (backup.format !== "griff-credits-backup") throw new Error("This file isn't a Griff Credits backup.");
  if (backup.version !== BACKUP_FORMAT_VERSION) throw new Error(`Unsupported backup version ${backup.version}.`);
  if (Object.keys(backup.documents).length !== backup.count) {
    throw new Error("Backup file is incomplete (document count doesn't match).");
  }
  return backup;
}

/**
 * Replaces everything in the database with the backup's contents: deletes all
 * current documents, then writes the backup's. Bypasses security rules.
 */
export async function restoreBackup(db: Firestore, backup: Backup): Promise<void> {
  for (const col of await db.listCollections()) await db.recursiveDelete(col);

  const writer = db.bulkWriter();
  let failed = 0;
  writer.onWriteError((err) => {
    if (err.failedAttempts < 5) return true; // retry
    failed++;
    console.error(`Failed to restore ${err.documentRef.path}: ${err.message}`);
    return false;
  });
  for (const [path, data] of Object.entries(backup.documents)) {
    writer.set(db.doc(path), decodeValue(data as Encoded) as DocumentData);
  }
  await writer.close();
  if (failed > 0) throw new Error(`${failed} documents failed to restore.`);
}
