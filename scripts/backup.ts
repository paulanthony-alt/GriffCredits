// Usage: FIREBASE_PROJECT_ID=... tsx scripts/backup.ts <output.json>
import { writeFileSync } from "node:fs";
import { createBackup } from "./lib/dump";
import { adminDb } from "./lib/firestore";

const out = process.argv[2];
if (!out) throw new Error("Usage: tsx scripts/backup.ts <output.json>");
const projectId = process.env.FIREBASE_PROJECT_ID!;
const backup = await createBackup(adminDb(projectId), projectId);
writeFileSync(out, JSON.stringify(backup));
console.log(`Backed up ${backup.count} documents from ${projectId} at ${backup.createdAt}.`);
