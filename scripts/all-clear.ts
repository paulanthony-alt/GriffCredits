// Usage: tsx scripts/all-clear.ts <stats.json>
// Emails the weekly "all clear" to ALL_CLEAR_TO (comma-separated), sending
// from MAIL_USERNAME / MAIL_PASSWORD (a Gmail address and app password by
// default; override with SMTP_HOST / SMTP_PORT). Prints nothing private:
// the job logs of a public repository are public.
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import { allClearMessage, type Stats } from "./lib/all-clear";

const { MAIL_USERNAME, MAIL_PASSWORD, ALL_CLEAR_TO } = process.env;
if (!MAIL_USERNAME || !MAIL_PASSWORD || !ALL_CLEAR_TO) {
  console.log("::notice::All-clear email isn't set up yet (SETUP.md, 'Weekly all-clear email'), so none was sent.");
  process.exit(0);
}
const stats = JSON.parse(readFileSync(process.argv[2], "utf8")) as Stats;
if (stats.problemCount !== 0) throw new Error("Refusing to send an all-clear when the data check found problems.");

const port = Number(process.env.SMTP_PORT || 465);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: { user: MAIL_USERNAME, pass: MAIL_PASSWORD },
});
const message = allClearMessage(stats, {
  now: new Date(),
  timeZone: process.env.REPORT_TIMEZONE || "UTC",
  siteUrl: process.env.SITE_URL || "",
  runUrl: process.env.RUN_URL || "",
});
await transport.sendMail({
  from: `"Griff Credits" <${MAIL_USERNAME}>`,
  to: ALL_CLEAR_TO.split(",").map((a) => a.trim()).filter(Boolean),
  ...message,
});
console.log("All-clear email sent.");
