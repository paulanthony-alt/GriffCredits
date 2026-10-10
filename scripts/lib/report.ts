import { createRequire } from "node:module";
import type { Firestore } from "firebase-admin/firestore";
import { toCustomer, toTransaction } from "../../src/records";
import { buildReportData, weekBefore, type ReportData, type ReportEntry } from "../../src/report/data";
import { reportDocument } from "../../src/report/document";

const require = createRequire(import.meta.url);

/** Reads everything the report needs from the database (admin access). */
export async function loadReportData(db: Firestore, now: Date, timeZone: string): Promise<ReportData> {
  const [customersSnap, staffSnap, entriesSnap] = await Promise.all([
    db.collection("customers").get(),
    db.collection("staff").get(),
    db.collectionGroup("transactions").get(),
  ]);
  const entries: ReportEntry[] = entriesSnap.docs
    .filter((d) => d.ref.parent.parent?.parent.id === "customers")
    .map((d) => ({ ...toTransaction(d.id, d.data()), customerId: d.ref.parent.parent!.id }));
  return buildReportData({
    customers: customersSnap.docs.map((d) => toCustomer(d.id, d.data())),
    entries,
    staffNames: new Map(staffSnap.docs.map((d) => [d.id, d.get("name") as string])),
    generatedAt: now,
    periodStart: weekBefore(now),
    timeZone,
  });
}

/** Renders the report to PDF bytes, locked with `password` if given (AES-256). */
export async function renderReportPdf(data: ReportData, password?: string): Promise<Buffer> {
  const pdfmake = require("pdfmake");
  pdfmake.setFonts(require("pdfmake/fonts/Roboto.js"));
  pdfmake.setUrlAccessPolicy(() => false); // never fetch anything over the network
  pdfmake.setLocalAccessPolicy((path: string) => path.includes("/pdfmake/fonts/"));
  return pdfmake.createPdf(reportDocument(data, { password })).getBuffer();
}
