// Usage: FIREBASE_PROJECT_ID=... tsx scripts/restore.ts <backup.json> --yes-replace-everything
// Replaces ALL data in the database with the backup. Take a fresh backup first.
import { readFileSync } from "node:fs";
import { parseBackup, restoreBackup } from "./lib/dump";
import { adminDb } from "./lib/firestore";

const [file, confirm] = process.argv.slice(2);
if (!file || confirm !== "--yes-replace-everything") {
  throw new Error("Usage: tsx scripts/restore.ts <backup.json> --yes-replace-everything");
}
const projectId = process.env.FIREBASE_PROJECT_ID!;
const backup = parseBackup(readFileSync(file, "utf8"));
console.log(`Restoring ${backup.count} documents from the backup taken ${backup.createdAt} (project ${backup.projectId}) into ${projectId}…`);
await restoreBackup(adminDb(projectId), backup);
console.log("Restore complete.");
