import { describe, expect, it } from "bun:test";
import { isVersionMatch } from "../src/utils";

describe("isVersionMatch", () => {
  it("matches an installed version resolved as latest when no version is requested", () => {
    expect(isVersionMatch("1.4.0+revision", undefined, "1.4.0")).toBe(true);
  });

  it("does not match an installed version older than latest", () => {
    expect(isVersionMatch("1.3.10+revision", undefined, "1.4.0")).toBe(false);
  });

  it("does not match when Bun is not installed", () => {
    expect(isVersionMatch(undefined, undefined, "1.4.0")).toBe(false);
  });

  it("preserves explicitly requested versions", () => {
    expect(isVersionMatch("1.3.10+revision", "1.3.10", "1.4.0")).toBe(true);
    expect(isVersionMatch("1.4.0+revision", "latest", "1.4.0")).toBe(false);
  });

  it("does not match when the resolved version is unavailable", () => {
    expect(isVersionMatch("1.4.0+revision", undefined, undefined)).toBe(false);
  });
});
