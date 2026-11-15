import { createHash } from "node:crypto";
import { isFeatureAvailable } from "@actions/cache";
import { warning } from "@actions/core";
import type { Input } from "./action";
import { extractVersionFromUrl } from "./utils";

const MAX_CACHE_KEY_LENGTH = 512;

export type CacheSettings = {
  cacheEnabled: boolean;
  cacheKey: string;
};

export function getCacheSettings(options: Input, url: string): CacheSettings {
  const disabledReason = getCacheDisabledReason(options);
  if (options.cacheKeyPrefix && disabledReason) {
    warning(`cache-key-prefix has no effect because ${disabledReason}.`);
  }

  const cacheKey = getCacheKey(url, options.cacheKeyPrefix);
  if (!disabledReason) {
    validateCacheKey(cacheKey);
  }

  return { cacheEnabled: !disabledReason, cacheKey };
}

export function getCacheDisabledReason(options: Input): string | undefined {
  const { customUrl, version, noCache } = options;
  if (noCache) {
    return "no-cache is true";
  }
  if (customUrl) {
    return "bun-download-url is set";
  }
  if (!version) {
    return "no Bun version is set";
  }
  if (/latest|canary|action/i.test(version)) {
    return `Bun version "${version}" is never cached`;
  }
  if (!isFeatureAvailable()) {
    return "the cache service is not available";
  }
  return undefined;
}

export function getCacheKey(url: string, prefix?: string): string {
  const hash = createHash("sha1").update(url).digest("base64");
  if (!prefix) {
    return `bun-${hash}`;
  }

  // e.g. ".../bun-v1.3.1/bun-linux-x64.zip" -> "<prefix>-1.3.1-linux-x64-<hash>"
  // Same version parser as the check on restored binaries, so they cannot drift
  const version = extractVersionFromUrl(url);
  const platform = url.match(/\/bun-([^/]+)\.zip$/)?.[1];
  return version && platform
    ? `${prefix}-${version}-${platform}-${hash}`
    : `${prefix}-${hash}`;
}

// Same rules as @actions/cache's checkKey, checked early so the error names the input
export function validateCacheKey(key: string): void {
  if (key.length > MAX_CACHE_KEY_LENGTH) {
    throw new Error(
      `Cache key "${key}" is longer than ${MAX_CACHE_KEY_LENGTH} characters. Shorten the cache-key-prefix input.`,
    );
  }
  if (key.includes(",")) {
    throw new Error(
      `Cache key "${key}" cannot contain commas. Remove them from the cache-key-prefix input.`,
    );
  }
}
