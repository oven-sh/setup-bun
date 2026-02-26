import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
  getArchitecture,
  getAvx2,
  isWindowsArm64Supported,
  MIN_WINDOWS_ARM64_VERSION,
} from "../src/utils";

describe("isWindowsArm64Supported", () => {
  it("should return true for 'canary' and 'latest'", () => {
    expect(isWindowsArm64Supported("canary")).toBe(true);
    expect(isWindowsArm64Supported("latest")).toBe(true);
  });

  it("should return true for versions >= MIN_WINDOWS_ARM64_VERSION", () => {
    expect(isWindowsArm64Supported(MIN_WINDOWS_ARM64_VERSION)).toBe(true);
    expect(isWindowsArm64Supported("bun-v" + MIN_WINDOWS_ARM64_VERSION)).toBe(
      true,
    );
    expect(isWindowsArm64Supported("1.4.0")).toBe(true);
  });

  it("should return false for versions < MIN_WINDOWS_ARM64_VERSION", () => {
    expect(isWindowsArm64Supported("1.0.0")).toBe(false);
    expect(isWindowsArm64Supported("bun-v1.3.9")).toBe(false);
  });
});

describe("getArchitecture", () => {
  it("should return aarch64 for arm64 architecture on all platforms", () => {
    expect(getArchitecture("arm64")).toBe("aarch64");
  });

  it("should return aarch64 for aarch64 architecture", () => {
    expect(getArchitecture("aarch64")).toBe("aarch64");
  });

  it("should return original arch value for x64", () => {
    expect(getArchitecture("x64")).toBe("x64");
  });

  it("should return original arch value for x86", () => {
    expect(getArchitecture("x86")).toBe("x86");
  });
});

describe("getAvx2", () => {
  it("should return true for ARM64 architectures", () => {
    expect(getAvx2("arm64")).toBe(true);
    expect(getAvx2("aarch64")).toBe(true);
    expect(getAvx2("arm64", false)).toBe(true);
    expect(getAvx2("aarch64", false)).toBe(true);
  });

  it("should return the provided avx2 value when specified for x64", () => {
    expect(getAvx2("x64", true)).toBe(true);
    expect(getAvx2("x64", false)).toBe(false);
  });

  it("should return true by default when avx2 is not specified for x64", () => {
    expect(getAvx2("x64")).toBe(true);
  });
});
