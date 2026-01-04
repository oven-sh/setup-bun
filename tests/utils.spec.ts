import { describe, expect, it } from "bun:test";
import { getAvx2 } from "../src/utils";

describe("getAvx2", () => {
  it("should return false when called with os: 'windows' and arch: 'arm64'", () => {
    const result = getAvx2("windows", "arm64");
    expect(result).toBe(false);
  });

  it("should return false when called with os: 'windows' and arch: 'aarch64'", () => {
    const result = getAvx2("windows", "aarch64");
    expect(result).toBe(false);
  });

  it("should return false when called with os: 'windows', arch: 'arm64', and avx2: true", () => {
    const result = getAvx2("windows", "arm64", true);
    expect(result).toBe(false);
  });

  it("should return false when called with os: 'windows', arch: 'aarch64', and avx2: false", () => {
    const result = getAvx2("windows", "aarch64", false);
    expect(result).toBe(false);
  });

  it("should return the provided avx2 value (true) when specified and not on Windows ARM64", () => {
    expect(getAvx2("linux", "x64", true)).toBe(true);
    expect(getAvx2("darwin", "x64", true)).toBe(true);
    expect(getAvx2("windows", "x64", true)).toBe(true);
  });

  it("should return the provided avx2 value (false) when specified and not on Windows ARM64", () => {
    expect(getAvx2("linux", "x64", false)).toBe(false);
    expect(getAvx2("darwin", "x64", false)).toBe(false);
    expect(getAvx2("windows", "x64", false)).toBe(false);
  });

  it("should return true by default when avx2 is not specified and not on Windows ARM64", () => {
    // x64 architecture on various platforms
    expect(getAvx2("linux", "x64")).toBe(true);
    expect(getAvx2("darwin", "x64")).toBe(true);
    expect(getAvx2("windows", "x64")).toBe(true);
    
    // ARM architecture on non-Windows platforms
    expect(getAvx2("linux", "arm64")).toBe(true);
    expect(getAvx2("linux", "aarch64")).toBe(true);
    expect(getAvx2("darwin", "arm64")).toBe(true);
    expect(getAvx2("darwin", "aarch64")).toBe(true);
  });
});
