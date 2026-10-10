import { loadReportRecords } from "../services";
import { buildReportData, weekBefore } from "./data";
import { reportDocument } from "./document";

/**
 * Builds the same report as the weekly GitHub job and downloads it as a PDF.
 * The PDF library (~1 MB) only loads when someone asks for a report.
 */
export async function downloadReport(staffNames: Map<string, string>): Promise<void> {
  const now = new Date();
  const [{ customers, entries }, { default: pdfMake }, { default: vfs }] = await Promise.all([
    loadReportRecords(),
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(vfs);
  const data = buildReportData({
    customers,
    entries,
    staffNames,
    generatedAt: now,
    periodStart: weekBefore(now),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const day = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
  await pdfMake.createPdf(reportDocument(data)).download(`griff-credits-report-${day}.pdf`);
}
