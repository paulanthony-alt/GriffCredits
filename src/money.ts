// Credits work like dollars: up to two decimal places. They're stored as whole
// cents (15.65 credits -> 1565) so arithmetic never hits floating-point rounding.

/** Largest amount a single load or spend can be: 100,000.00 credits. */
export const MAX_TRANSACTION_CENTS = 100_000_00;

/**
 * Parses what staff type ("15", "15.6", "15.65", ".5") into cents.
 * Returns null for anything else, including more than two decimal places.
 */
export function parseCreditsToCents(input: string): number | null {
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(input.trim());
  if (!match || (match[1] === "" && !match[2])) return null;
  const whole = Number(match[1] || "0");
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Keeps only what can still become a valid amount while someone is typing. */
export function sanitizeCreditsInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 2)}`;
}

const formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1565 -> "15.65", 200000 -> "2,000.00" */
export function formatCredits(cents: number): string {
  return formatter.format(cents / 100);
}
