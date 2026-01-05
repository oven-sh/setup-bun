import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { getArchitecture, getAvx2 } from "../src/utils";
import * as core from "@actions/core";

describe("getArchitecture", () => {
  let warningSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    warningSpy?.mockRestore();
  });

  it("should return x64 for Windows with arm64 architecture", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "arm64");

    expect(result).toBe("x64");
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "⚠️ Bun does not provide native arm64 builds for Windows."
      )
    );
  });

  it("should return x64 for Windows with aarch64 architecture", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "aarch64");

    expect(result).toBe("x64");
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "⚠️ Bun does not provide native arm64 builds for Windows."
      )
    );
  });

  it("should return aarch64 for non-Windows platforms with arm64", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("linux", "arm64");

    expect(result).toBe("aarch64");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return aarch64 for macOS with arm64", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("darwin", "arm64");

    expect(result).toBe("aarch64");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return original arch value for x64", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "x64");

    expect(result).toBe("x64");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return original arch value for x86", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("linux", "x86");

    expect(result).toBe("x86");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return original arch value for aarch64 on Linux", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("linux", "aarch64");

    expect(result).toBe("aarch64");
    expect(warningSpy).not.toHaveBeenCalled();
  });
});

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
