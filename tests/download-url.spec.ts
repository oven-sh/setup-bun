import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { getDownloadUrl } from "../src/download-url";
import * as utils from "../src/utils";

const MOCK_TAGS = [
  { ref: "refs/tags/bun-v0.5.0" },
  { ref: "refs/tags/bun-v1.0.0" },
  { ref: "refs/tags/bun-v1.0.1" },
  { ref: "refs/tags/bun-v1.1.0" },
  { ref: "refs/tags/canary" },
];

describe("getDownloadUrl", () => {
  let requestSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    requestSpy = spyOn(utils, "request").mockResolvedValue({
      json: async () => MOCK_TAGS,
    } as Response);
  });

  afterEach(() => {
    requestSpy.mockRestore();
  });

  describe("Custom URL", () => {
    it("should return customUrl if provided", async () => {
      const url = await getDownloadUrl({
        customUrl: "https://example.com/bun.zip",
      });
      expect(url).toBe("https://example.com/bun.zip");
      expect(requestSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("Optimization (No API Call)", () => {
    it("should construct URL directly for specific version 1.0.0", async () => {
      const url = await getDownloadUrl({
        version: "1.0.0",
        os: "linux",
        arch: "x64",
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.0.0/bun-linux-x64.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(0);
    });

    it("should construct URL directly for specific version 0.5.0", async () => {
      const url = await getDownloadUrl({
        version: "0.5.0",
        os: "darwin",
        arch: "aarch64",
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v0.5.0/bun-darwin-aarch64.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(0);
    });

    it("should handle avx2=false (baseline) without API call", async () => {
      const url = await getDownloadUrl({
        version: "1.1.0",
        os: "linux",
        arch: "x64",
        avx2: false,
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.1.0/bun-linux-x64-baseline.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(0);
    });

    it("should handle profile=true without API call", async () => {
      const url = await getDownloadUrl({
        version: "1.1.0",
        os: "linux",
        arch: "x64",
        profile: true,
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.1.0/bun-linux-x64-profile.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("API Lookup (Dynamic Versions)", () => {
    it("should call API and resolve 'latest' to the newest version", async () => {
      const url = await getDownloadUrl({
        version: "latest",
        os: "linux",
        arch: "x64",
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.1.0/bun-linux-x64.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it("should call API and resolve semver range '^1.0.0'", async () => {
      const url = await getDownloadUrl({
        version: "^1.0.0",
        os: "linux",
        arch: "x64",
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.1.0/bun-linux-x64.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it("should call API and resolve 'canary'", async () => {
      const url = await getDownloadUrl({
        version: "canary",
        os: "linux",
        arch: "x64",
      });

      expect(url).toBe(
        "https://github.com/oven-sh/bun/releases/download/canary/bun-linux-x64.zip",
      );
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });

    it("should throw error if semver range matches nothing", async () => {
      expect(
        getDownloadUrl({
          version: "^2.0.0",
          os: "linux",
          arch: "x64",
        }),
      ).rejects.toThrow("No Bun release found matching version '^2.0.0'");
      expect(requestSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Token Handling", () => {
    it("should pass token to API request when resolving dynamic versions", async () => {
      await getDownloadUrl({
        version: "latest",
        token: "my-secret-token",
        os: "linux",
        arch: "x64",
      });

      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringContaining("api.github.com"),
        expect.objectContaining({
          headers: { Authorization: "Bearer my-secret-token" },
        }),
      );
    });
  });
});
