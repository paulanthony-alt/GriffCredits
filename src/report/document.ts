import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatCredits } from "../money";
import type { ReportData, ReportLine } from "./data";

// Builds the PDF layout (a pdfmake document definition: plain data, no I/O),
// shared by the in-app download and the weekly GitHub job.

const ACCENT = "#1f3a2e";
const MUTED = "#6b6b66";

function signed(cents: number): string {
  return `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatCredits(Math.abs(cents))}`;
}

function dateFormatters(timeZone: string) {
  const full = new Intl.DateTimeFormat("en-US", {
    timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const short = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return {
    full: (d: Date) => full.format(d),
    day: (d: Date) => day.format(d),
    short: (d: Date | null) => (d ? short.format(d) : "—"),
  };
}

const header = (labels: string[], rightFrom: number): TableCell[] =>
  labels.map((text, i) => ({ text, style: "th", alignment: i >= rightFrom ? "right" : "left" }));

function amountCell(l: ReportLine): TableCell {
  return {
    text: signed(l.amountCents),
    alignment: "right",
    color: l.amountCents > 0 ? "#1f7a43" : "#b3362f",
    decoration: l.undone ? "lineThrough" : undefined,
  };
}

function descriptionCell(l: ReportLine): TableCell {
  return l.undone ? { text: [l.description, { text: "  (undone)", color: MUTED }] } : { text: l.description, italics: l.isUndo };
}

export interface DocumentOptions {
  /** Password needed to open the PDF (AES-256). Omit for no password. */
  password?: string;
}

export function reportDocument(data: ReportData, options: DocumentOptions = {}): TDocumentDefinitions {
  const f = dateFormatters(data.timeZone);
  const w = data.week;

  const content: Content[] = [
    { text: "Griff Credits report", style: "title" },
    {
      text: `Generated ${f.full(data.generatedAt)} (${data.timeZone}) · This week: ${f.day(data.periodStart)} – ${f.day(data.generatedAt)}`,
      color: MUTED, fontSize: 9, margin: [0, 2, 0, 14],
    },

    { text: "Summary", style: "h2" },
    {
      table: {
        widths: ["*", "auto"],
        body: [
          ["Credits out there at the start of the week", { text: formatCredits(w.startCents), alignment: "right" }],
          ["Loaded this week", { text: signed(w.loadedCents), alignment: "right", color: "#1f7a43" }],
          ["Spent this week", { text: signed(-w.spentCents), alignment: "right", color: "#b3362f" }],
          ...(w.undoCents !== 0 ? [["Undos this week", { text: signed(w.undoCents), alignment: "right" }]] : []),
          [{ text: "Credits out there now", bold: true }, { text: formatCredits(w.endCents), alignment: "right", bold: true }],
          ["Customers holding credit", { text: `${data.customersWithCredit} of ${data.customerCount}`, alignment: "right" }],
        ] as TableCell[][],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 16],
    },

    { text: "Who has what", style: "h2" },
    data.balances.length === 0
      ? { text: "No customers yet.", color: MUTED }
      : {
          table: {
            headerRows: 1,
            widths: ["*", "*", "auto"],
            body: [
              header(["Customer", "Notes", "Balance"], 2),
              ...data.balances.map((c) => [c.name, { text: c.notes || "", color: MUTED }, { text: formatCredits(c.balanceCents), alignment: "right" }] as TableCell[]),
              [{ text: "Total", bold: true }, "", { text: formatCredits(data.outstandingCents), alignment: "right", bold: true }],
            ],
          },
          layout: "lightHorizontalLines",
          margin: [0, 0, 0, 16],
        },

    { text: "This week's activity", style: "h2", pageBreak: "before" },
    data.weekLines.length === 0
      ? { text: "No loads or spends this week.", color: MUTED, margin: [0, 0, 0, 16] }
      : {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "auto"],
            body: [
              header(["When", "Customer", "What", "Amount", "Balance after", "By"], 3),
              ...data.weekLines.map((l) => [
                f.short(l.date), l.customerName, descriptionCell(l), amountCell(l),
                { text: formatCredits(l.balanceAfterCents), alignment: "right" }, { text: l.by, alignment: "right" },
              ] as TableCell[]),
            ],
          },
          layout: "lightHorizontalLines",
          fontSize: 9,
          margin: [0, 0, 0, 16],
        },

    { text: "Full history by customer", style: "h2", pageBreak: "before" },
    ...(data.histories.length === 0
      ? [{ text: "No history yet.", color: MUTED } as Content]
      : data.histories.flatMap(({ customer, lines }): Content[] => [
          {
            text: [customer.name, { text: `   balance ${formatCredits(customer.balanceCents)}`, color: MUTED, bold: false, fontSize: 10 }],
            style: "h3",
            headlineLevel: 1,
          },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "auto", "auto", "auto"],
              body: [
                header(["When", "What", "Amount", "Balance after", "By"], 2),
                ...lines.map((l) => [
                  f.short(l.date), descriptionCell(l), amountCell(l),
                  { text: formatCredits(l.balanceAfterCents), alignment: "right" }, { text: l.by, alignment: "right" },
                ] as TableCell[]),
              ],
            },
            layout: "lightHorizontalLines",
            fontSize: 9,
            margin: [0, 0, 0, 12],
          },
        ])),
  ];

  return {
    info: { title: "Griff Credits report", author: "Griff Credits", subject: `Generated ${f.full(data.generatedAt)}` },
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 50],
    content,
    // Don't leave a customer's name stranded at the bottom of a page.
    pageBreakBefore: (node, following) =>
      node.headlineLevel === 1 && (following.getFollowingNodesOnPage?.() ?? following).length === 0,
    footer: (page, pages) => ({
      columns: [
        { text: "Griff Credits · confidential", color: MUTED, fontSize: 8 },
        { text: `Page ${page} of ${pages}`, alignment: "right", color: MUTED, fontSize: 8 },
      ],
      margin: [40, 16, 40, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10 },
    styles: {
      title: { fontSize: 20, bold: true, color: ACCENT },
      h2: { fontSize: 14, bold: true, color: ACCENT, margin: [0, 0, 0, 6] },
      h3: { fontSize: 12, bold: true, margin: [0, 6, 0, 4] },
      th: { bold: true, color: MUTED, fontSize: 9 },
    },
    ...(options.password
      ? {
          version: "1.7ext3", // AES-256
          userPassword: options.password,
          ownerPassword: options.password,
          permissions: { printing: "highResolution", copying: true, modifying: false },
        }
      : {}),
  };
}
