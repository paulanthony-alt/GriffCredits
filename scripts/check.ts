// Usage: FIREBASE_PROJECT_ID=... tsx scripts/check.ts [report.md]
// Exits with code 1 if any data problems are found.
import { writeFileSync } from "node:fs";
import { adminDb } from "./lib/firestore";
import { checkIntegrity } from "./lib/integrity";

const report = await checkIntegrity(adminDb());
const lines = [
  `Checked ${report.customers} customers, ${report.transactions} history entries and ${report.staff} staff accounts.`,
  report.problems.length === 0 ? "✅ No data problems found." : `❌ ${report.problems.length} problem(s):`,
  ...report.problems.map((p) => `- ${p}`),
];
console.log(lines.join("\n"));
if (process.argv[2]) writeFileSync(process.argv[2], lines.join("\n") + "\n");
process.exit(report.problems.length === 0 ? 0 : 1);
