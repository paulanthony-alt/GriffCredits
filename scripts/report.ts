// Usage: FIREBASE_PROJECT_ID=... REPORT_TIMEZONE=America/New_York REPORT_PASSWORD=... \
//          tsx scripts/report.ts <output.pdf>
// Writes a PDF of every balance plus this week's and all-time history.
// Locked with REPORT_PASSWORD when set (required in CI, since the repo is public).
import { writeFileSync } from "node:fs";
import { adminDb } from "./lib/firestore";
import { loadReportData, renderReportPdf } from "./lib/report";

const out = process.argv[2];
if (!out) throw new Error("Usage: tsx scripts/report.ts <output.pdf>");
const timeZone = process.env.REPORT_TIMEZONE || "UTC";
const password = process.env.REPORT_PASSWORD || undefined;
if (process.env.CI && !password) throw new Error("REPORT_PASSWORD must be set in CI: reports contain customer names.");

const data = await loadReportData(adminDb(), new Date(), timeZone);
writeFileSync(out, await renderReportPdf(data, password));
console.log(
  `Report written to ${out}: ${data.customerCount} customers, ${data.weekLines.length} entries this week` +
    `${password ? ", password-protected" : ""}.`,
);
