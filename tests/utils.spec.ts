import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { getArchitecture, getAvx2, hasNativeWindowsArm64 } from "../src/utils";
import * as core from "@actions/core";

describe("hasNativeWindowsArm64", () => {
  it("should return true for version >= 1.3.10", () => {
    expect(hasNativeWindowsArm64("bun-v1.3.10")).toBe(true);
    expect(hasNativeWindowsArm64("bun-v1.3.11")).toBe(true);
    expect(hasNativeWindowsArm64("bun-v1.4.0")).toBe(true);
    expect(hasNativeWindowsArm64("bun-v2.0.0")).toBe(true);
  });

  it("should return false for version < 1.3.10", () => {
    expect(hasNativeWindowsArm64("bun-v1.3.9")).toBe(false);
    expect(hasNativeWindowsArm64("bun-v1.2.0")).toBe(false);
    expect(hasNativeWindowsArm64("bun-v1.0.0")).toBe(false);
    expect(hasNativeWindowsArm64("bun-v0.5.0")).toBe(false);
  });

  it("should return true for non-semver versions like canary", () => {
    expect(hasNativeWindowsArm64("canary")).toBe(true);
    expect(hasNativeWindowsArm64("latest")).toBe(true);
  });

  it("should return false for undefined version", () => {
    expect(hasNativeWindowsArm64(undefined)).toBe(false);
  });
});

describe("getArchitecture", () => {
  let warningSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    warningSpy?.mockRestore();
  });

  it("should return aarch64 for Windows arm64 with Bun >= 1.3.10", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "arm64", "bun-v1.3.10");

    expect(result).toBe("aarch64");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return aarch64 for Windows aarch64 with Bun >= 1.3.10", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "aarch64", "bun-v1.4.0");

    expect(result).toBe("aarch64");
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should return x64 for Windows arm64 with Bun < 1.3.10", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "arm64", "bun-v1.2.0");

    expect(result).toBe("x64");
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "⚠️ This version of Bun does not provide native arm64 builds for Windows."
      )
    );
  });

  it("should return x64 for Windows aarch64 with Bun < 1.3.10", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "aarch64", "bun-v1.0.0");

    expect(result).toBe("x64");
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "⚠️ This version of Bun does not provide native arm64 builds for Windows."
      )
    );
  });

  it("should return x64 for Windows arm64 with no version (fallback)", () => {
    warningSpy = spyOn(core, "warning");
    const result = getArchitecture("windows", "arm64");

    expect(result).toBe("x64");
    expect(warningSpy).toHaveBeenCalledTimes(1);
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
  it("should return false for Windows arm64 with Bun < 1.3.10", () => {
    expect(getAvx2("windows", "arm64", undefined, "bun-v1.2.0")).toBe(false);
  });

  it("should return false for Windows aarch64 with Bun < 1.3.10", () => {
    expect(getAvx2("windows", "aarch64", undefined, "bun-v1.0.0")).toBe(false);
  });

  it("should return false for Windows arm64 with no version (fallback)", () => {
    expect(getAvx2("windows", "arm64")).toBe(false);
  });

  it("should return false for Windows aarch64 with no version (fallback)", () => {
    expect(getAvx2("windows", "aarch64")).toBe(false);
  });

  it("should return true for Windows arm64 with Bun >= 1.3.10", () => {
    expect(getAvx2("windows", "arm64", undefined, "bun-v1.3.10")).toBe(true);
  });

  it("should return true for Windows aarch64 with Bun >= 1.3.10", () => {
    expect(getAvx2("windows", "aarch64", undefined, "bun-v1.4.0")).toBe(true);
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
