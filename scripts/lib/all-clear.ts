import { formatCredits } from "../../src/money";
import type { IntegrityReport } from "./integrity";

export type Stats = Omit<IntegrityReport, "problems"> & { problemCount: number };

export interface AllClearMessage {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The weekly "all clear" email, sent when every weekly check passes. */
export function allClearMessage(stats: Stats, opts: { now: Date; timeZone: string; siteUrl: string; runUrl: string }): AllClearMessage {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: opts.timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(opts.now);
  const checks = [
    "The app's automatic tests all pass",
    "No known security problems in the app's libraries",
    `Every customer's balance matches their history (${stats.customers} customers, ${stats.transactions} history entries)`,
    `The website is up: ${opts.siteUrl}`,
  ];
  const credit = `${formatCredits(stats.outstandingCents)} credits, held by ${stats.customersWithCredit} of ${stats.customers} customers`;
  const footer = "Backups are saved every day, and a PDF report every Sunday night. This email is sent automatically each Monday when every check passes.";

  const text = [
    `All clear: every weekly check on Griff Credits passed (${day}).`,
    "",
    ...checks.map((c) => `✅ ${c}`),
    "",
    `Credits out there right now: ${credit}.`,
    "",
    footer,
    `Check details: ${opts.runUrl}`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1b">
<h2 style="color:#1f3a2e;margin:0 0 4px">✅ Griff Credits: all clear</h2>
<p style="color:#6b6b66;margin:0 0 16px">Weekly check for ${escapeHtml(day)}</p>
<ul style="padding-left:20px;margin:0 0 16px">${checks.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
<p style="margin:0 0 16px"><strong>Credits out there right now:</strong> ${escapeHtml(credit)}.</p>
<p style="color:#6b6b66;font-size:13px;margin:0">${escapeHtml(footer)}<br><a href="${escapeHtml(opts.runUrl)}">Check details</a></p>
</div>`;

  return { subject: `Griff Credits: weekly check all clear (${day})`, text, html };
}
