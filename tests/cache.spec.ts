import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as core from "@actions/core";
import {
  getCacheDisabledReason,
  getCacheKey,
  getCacheSettings,
  validateCacheKey,
} from "../src/cache";
import { getDownloadUrl } from "../src/download-url";

const URL_1_4_4 =
  "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64.zip";

// isFeatureAvailable() reads one of these, depending on the cache service version
const CACHE_ENV = ["ACTIONS_CACHE_URL", "ACTIONS_RESULTS_URL"] as const;
const savedEnv = Object.fromEntries(
  CACHE_ENV.map((name) => [name, process.env[name]]),
);

function setCacheEnv(values: Record<string, string | undefined>) {
  for (const name of CACHE_ENV) {
    if (values[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = values[name];
    }
  }
}

beforeEach(() => {
  setCacheEnv({
    ACTIONS_CACHE_URL: "https://cache.example.com/",
    ACTIONS_RESULTS_URL: "https://cache.example.com/",
  });
});

afterEach(() => {
  setCacheEnv(savedEnv);
});

describe("getCacheSettings", () => {
  let warningSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    warningSpy = spyOn(core, "warning").mockImplementation(() => {});
  });

  afterEach(() => {
    warningSpy.mockRestore();
  });

  it("should return the prefixed key when caching is on", () => {
    expect(
      getCacheSettings(
        { version: "1.4.4", cacheKeyPrefix: "bun-bin" },
        URL_1_4_4,
      ),
    ).toEqual({
      cacheEnabled: true,
      cacheKey: "bun-bin-1.4.4-linux-x64-vyrKTwhw5PEh6pGRz1Zgyle11uQ=",
    });
    expect(warningSpy).not.toHaveBeenCalled();
  });

  it("should reject an invalid prefix when caching is on", () => {
    expect(() =>
      getCacheSettings({ version: "1.4.4", cacheKeyPrefix: "a,b" }, URL_1_4_4),
    ).toThrow("cannot contain commas");
  });

  it("should warn instead of validating when caching is off", () => {
    const settings = getCacheSettings(
      { version: "1.4.4", noCache: true, cacheKeyPrefix: "a,b" },
      URL_1_4_4,
    );

    expect(settings.cacheEnabled).toBe(false);
    expect(warningSpy).toHaveBeenCalledWith(
      "cache-key-prefix has no effect because no-cache is true.",
    );
  });

  it("should not warn when caching is off without a prefix", () => {
    getCacheSettings({ version: "1.4.4", noCache: true }, URL_1_4_4);

    expect(warningSpy).not.toHaveBeenCalled();
  });
});

describe("getCacheDisabledReason", () => {
  it("should allow caching for exact versions and ranges", () => {
    expect(getCacheDisabledReason({ version: "1.4.4" })).toBeUndefined();
    expect(getCacheDisabledReason({ version: "1.x" })).toBeUndefined();
  });

  it("should report no-cache before any other reason", () => {
    expect(getCacheDisabledReason({ version: "1.4.4", noCache: true })).toBe(
      "no-cache is true",
    );
    expect(
      getCacheDisabledReason({
        customUrl: "https://example.com/bun.zip",
        noCache: true,
      }),
    ).toBe("no-cache is true");
  });

  it("should report a custom download URL", () => {
    expect(
      getCacheDisabledReason({
        version: "1.4.4",
        customUrl: "https://example.com/bun.zip",
      }),
    ).toBe("bun-download-url is set");
  });

  it("should report a missing version", () => {
    expect(getCacheDisabledReason({})).toBe("no Bun version is set");
  });

  it("should report latest and canary", () => {
    expect(getCacheDisabledReason({ version: "latest" })).toBe(
      'Bun version "latest" is never cached',
    );
    expect(getCacheDisabledReason({ version: "canary" })).toBe(
      'Bun version "canary" is never cached',
    );
  });

  it("should report a missing cache service", () => {
    setCacheEnv({});

    expect(getCacheDisabledReason({ version: "1.4.4" })).toBe(
      "the cache service is not available",
    );
  });
});

describe("getCacheKey", () => {
  it("should hash the download URL when no prefix is given", () => {
    expect(getCacheKey(URL_1_4_4)).toBe("bun-vyrKTwhw5PEh6pGRz1Zgyle11uQ=");
    expect(getCacheKey(URL_1_4_4, "")).toBe("bun-vyrKTwhw5PEh6pGRz1Zgyle11uQ=");
  });

  it("should put the version, platform and URL hash after the prefix", () => {
    expect(getCacheKey(URL_1_4_4, "bun-bin")).toBe(
      "bun-bin-1.4.4-linux-x64-vyrKTwhw5PEh6pGRz1Zgyle11uQ=",
    );
    expect(
      getCacheKey(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.3.10/bun-windows-aarch64.zip",
        "bun-bin",
      ),
    ).toBe("bun-bin-1.3.10-windows-aarch64-p76tnG3VTsjoV3QDqcdCJOJKQ4E=");
  });

  it("should keep baseline and profile variants distinct", () => {
    expect(
      getCacheKey(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64-baseline.zip",
        "bun-bin",
      ),
    ).toBe("bun-bin-1.4.4-linux-x64-baseline-gfy/IFh+mkdO5hVbq9LsESj/rn8=");
    expect(
      getCacheKey(
        "https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-linux-x64-profile.zip",
        "bun-bin",
      ),
    ).toBe("bun-bin-1.4.4-linux-x64-profile-J16JaZHl5HPf9BBreSQ7hSgJmaY=");
  });

  it("should put only the URL hash after the prefix for non-standard URLs", () => {
    expect(getCacheKey("https://example.com/bun.zip", "bun-bin")).toBe(
      "bun-bin-g2vfRlnEyMuDemEs4imeRzwI29o=",
    );
  });

  it("should keep the version and platform for URLs from getDownloadUrl", async () => {
    const url = await getDownloadUrl({
      version: "1.0.0",
      os: "darwin",
      arch: "aarch64",
    });

    expect(getCacheKey(url, "bun-bin")).toBe(
      "bun-bin-1.0.0-darwin-aarch64-glLvj8CIKR+Y0JZTHDhbcNTCoQM=",
    );
  });
});

describe("validateCacheKey", () => {
  it("should accept default and prefixed keys", () => {
    expect(() =>
      validateCacheKey("bun-vyrKTwhw5PEh6pGRz1Zgyle11uQ="),
    ).not.toThrow();
    expect(() =>
      validateCacheKey(
        "bun-bin-1.4.4-linux-x64-baseline-gfy/IFh+mkdO5hVbq9LsESj/rn8=",
      ),
    ).not.toThrow();
  });

  it("should accept a key of exactly 512 characters", () => {
    expect(() => validateCacheKey("a".repeat(512))).not.toThrow();
  });

  it("should reject a key longer than 512 characters", () => {
    expect(() => validateCacheKey("a".repeat(513))).toThrow(
      "is longer than 512 characters",
    );
  });

  it("should reject a key containing a comma", () => {
    expect(() =>
      validateCacheKey("bun,bin-1.4.4-linux-x64-vyrKTwhw5PEh6pGRz1Zgyle11uQ="),
    ).toThrow("cannot contain commas");
  });
});
