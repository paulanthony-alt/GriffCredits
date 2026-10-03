import { describe, expect, it } from "vitest";
import { byName } from "../src/names";

const sorted = (...names: string[]) => names.map((name) => ({ name })).sort(byName).map((n) => n.name);

describe("byName", () => {
  it("slots a new name into A–Z order", () => {
    expect(sorted("Jill", "Brian", "Dave", "Cameron")).toEqual(["Brian", "Cameron", "Dave", "Jill"]);
  });

  it("ignores capitals", () => {
    expect(sorted("Jill", "Brian", "Dave", "cameron", "adam")).toEqual(["adam", "Brian", "cameron", "Dave", "Jill"]);
  });

  it("ignores accents and stray spaces, and orders numbers naturally", () => {
    expect(sorted("Zoe", " Émile", "Eddie")).toEqual(["Eddie", " Émile", "Zoe"]);
    expect(sorted("Table 10", "Table 2")).toEqual(["Table 2", "Table 10"]);
  });
});
