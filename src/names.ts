const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * A–Z the way people expect: ignores capitals and accents ("cameron" sits
 * between "Brian" and "Dave") and orders numbers naturally ("Table 2" before
 * "Table 10"). The database's own ordering puts every capital before every
 * lowercase letter, so lists are sorted with this instead.
 */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return collator.compare(a.name.trim(), b.name.trim());
}
