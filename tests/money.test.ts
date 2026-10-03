import { describe, expect, it } from "vitest";
import { formatCredits, parseCreditsToCents, sanitizeCreditsInput } from "../src/money";

describe("parseCreditsToCents", () => {
  it.each([
    ["15.65", 1565],
    ["15.6", 1560],
    ["15.", 1500],
    ["15", 1500],
    [".5", 50],
    ["0.01", 1],
    ["0", 0],
    [" 7.25 ", 725],
    // 0.29 * 100 is 28.999999999999996 in floating point; parsing digits avoids that.
    ["0.29", 29],
    ["1000.10", 100010],
  ])("%s -> %i cents", (input, cents) => {
    expect(parseCreditsToCents(input)).toBe(cents);
  });

  it.each(["", ".", "15.655", "abc", "-5", "1,000", "1.2.3", "1e3"])("rejects %j", (input) => {
    expect(parseCreditsToCents(input)).toBeNull();
  });
});

describe("sanitizeCreditsInput", () => {
  it.each([
    ["15.65", "15.65"],
    ["15.659", "15.65"],
    ["$15.65", "15.65"],
    ["1.2.3", "1.23"],
    ["abc", ""],
    ["12.", "12."],
  ])("%j -> %j", (raw, clean) => {
    expect(sanitizeCreditsInput(raw)).toBe(clean);
  });
});

describe("formatCredits", () => {
  it.each([
    [1565, "15.65"],
    [0, "0.00"],
    [5, "0.05"],
    [200000, "2,000.00"],
  ])("%i cents -> %s", (cents, text) => {
    expect(formatCredits(cents)).toBe(text);
  });
});
