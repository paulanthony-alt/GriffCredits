import { byName } from "../names";
import { creditTotals } from "../totals";
import type { CreditTransaction, Customer } from "../types";

export interface ReportEntry extends CreditTransaction {
  customerId: string;
}

export interface ReportInput {
  customers: Customer[];
  /** Every history entry, for all customers. */
  entries: ReportEntry[];
  staffNames: Map<string, string>;
  generatedAt: Date;
  /** Start of "this week"; the week runs up to generatedAt. */
  periodStart: Date;
  /** IANA time zone used for every date in the report, e.g. "America/New_York". */
  timeZone: string;
}

export interface ReportLine {
  id: string;
  customerId: string;
  customerName: string;
  date: Date | null;
  description: string;
  amountCents: number;
  balanceAfterCents: number;
  by: string;
  isUndo: boolean;
  undone: boolean;
}

export interface WeekSummary {
  startCents: number;
  loadedCents: number;
  /** Positive number: credits spent this week. */
  spentCents: number;
  /** Net effect of undos made this week (+ gave credits back, − took them back). */
  undoCents: number;
  endCents: number;
}

export interface ReportData {
  generatedAt: Date;
  periodStart: Date;
  timeZone: string;
  outstandingCents: number;
  customersWithCredit: number;
  customerCount: number;
  week: WeekSummary;
  /** All customers, A–Z. */
  balances: Customer[];
  /** This week's entries, oldest first. */
  weekLines: ReportLine[];
  /** Every customer with any history, A–Z, each with their full history oldest first. */
  histories: { customer: Customer; lines: ReportLine[] }[];
}

export function buildReportData(input: ReportInput): ReportData {
  const balances = [...input.customers].sort(byName);
  const nameOf = new Map(balances.map((c) => [c.id, c.name]));
  const undoneIds = new Set(input.entries.filter((e) => e.reversesTxId).map((e) => e.reversesTxId!));

  const lines: ReportLine[] = input.entries
    .map((e) => {
      const isUndo = Boolean(e.reversesTxId);
      return {
        id: e.id,
        customerId: e.customerId,
        customerName: nameOf.get(e.customerId) ?? "(unknown customer)",
        date: e.createdAt ? e.createdAt.toDate() : null,
        description: e.note || (e.amountCents > 0 ? "Credits loaded" : "Credits spent"),
        amountCents: e.amountCents,
        balanceAfterCents: e.balanceAfterCents,
        by: input.staffNames.get(e.createdBy) ?? "former staff",
        isUndo,
        undone: !isUndo && undoneIds.has(e.id),
      };
    })
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  const start = input.periodStart.getTime();
  const end = input.generatedAt.getTime();
  const weekLines = lines.filter((l) => l.date && l.date.getTime() >= start && l.date.getTime() <= end);

  let loadedCents = 0;
  let spentCents = 0;
  let undoCents = 0;
  for (const l of weekLines) {
    if (l.isUndo) undoCents += l.amountCents;
    else if (l.amountCents > 0) loadedCents += l.amountCents;
    else spentCents -= l.amountCents;
  }
  const { outstandingCents, customersWithCredit } = creditTotals(input.customers);
  const netCents = loadedCents - spentCents + undoCents;

  const byCustomer = new Map<string, ReportLine[]>();
  for (const l of lines) {
    if (!byCustomer.has(l.customerId)) byCustomer.set(l.customerId, []);
    byCustomer.get(l.customerId)!.push(l);
  }

  return {
    generatedAt: input.generatedAt,
    periodStart: input.periodStart,
    timeZone: input.timeZone,
    outstandingCents,
    customersWithCredit,
    customerCount: input.customers.length,
    week: { startCents: outstandingCents - netCents, loadedCents, spentCents, undoCents, endCents: outstandingCents },
    balances,
    weekLines,
    histories: balances.filter((c) => byCustomer.has(c.id)).map((customer) => ({ customer, lines: byCustomer.get(customer.id)! })),
  };
}

/** Start of the 7 days ending at `now`. */
export function weekBefore(now: Date): Date {
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}
