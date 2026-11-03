import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../src/appUpdate";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://griffcredits.web.app/assets/TrendsPanel-B1tjUgTp.js", // Chrome
    "error loading dynamically imported module: https://griffcredits.web.app/assets/download-x.js", // Firefox
    "Importing a module script failed.", // Safari (iPhone, iPad)
    "Unable to preload CSS for /assets/index-abc.css",
  ])("recognises %j", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("Not enough credits (balance 4.85)."))).toBe(false);
    expect(isChunkLoadError({ code: "permission-denied" })).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
