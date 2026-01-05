import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { getArchitecture } from "../src/utils";
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
