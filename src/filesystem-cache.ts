import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { debug } from "@actions/core";

import { atomicWriteFileSync } from "./atomic-write";

const temporaryDir = process.env.RUNNER_TEMP || tmpdir();
const CACHE_DIR = join(
  (() => {
    try {
      return realpathSync(temporaryDir);
    } catch {
      return temporaryDir;
    }
  })(),
  "setup-bun",
);
export const CACHE_MAX_SIZE = 1024 * 1024 * 512; // MiB
const FS_CACHE_TIMEOUT = 1000 * 60 * 60 * 24 * 2; // days

export function getCacheTtl(): number {
  if (process.env["FS_CACHE_FORCE_STALE"]) {
    return 1000 * 60 * 1; // minutes
  } else {
    return FS_CACHE_TIMEOUT;
  }
}

function cacheDebug(operation: string, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  debug(`filesystem-cache: ${operation} failed for key "${key}": ${message}`);
}

/**
 * Logic:
 * - Current & Previous: Keep for "sliding window" cache hits at month boundaries.
 * - Next: Delete to prevent the cache from growing indefinitely.
 */
const getCacheDirs = (m = new Date().getMonth()) => {
  const pad = (n: number) => (1 + n).toString().padStart(3, "0");

  return {
    previousMonthDir: pad((11 + m) % 12),
    monthDir: pad(m),
    nextMonthDir: pad((1 + m) % 12),
  };
};

const cleanupFutureCache = (root: string = CACHE_DIR) => {
  const { nextMonthDir } = getCacheDirs();
  const nextMonthPath = join(root, nextMonthDir);

  try {
    if (existsSync(nextMonthPath)) {
      rmSync(nextMonthPath, { recursive: true, force: true });
    }
  } catch (error) {
    cacheDebug("cleanupFutureCache", nextMonthDir, error);
  }
};

/**
 * Helper to find a file in the current or previous month's cache directory.
 * Returns the full path if found, or undefined if neither exists.
 */
const findInCache = (
  fileName: string,
  root: string = CACHE_DIR,
): string | undefined => {
  const { monthDir, previousMonthDir } = getCacheDirs();

  const currentPath = join(root, monthDir, fileName);
  if (existsSync(currentPath)) return currentPath;

  const previousPath = join(root, previousMonthDir, fileName);
  if (existsSync(previousPath)) return previousPath;

  return undefined;
};

function getCacheFileName(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex");
  return `${hash}.json`;
}

function getWriteCachePath(key: string): string {
  const { monthDir } = getCacheDirs();
  const monthPath = join(CACHE_DIR, monthDir);
  mkdirSync(monthPath, { recursive: true });

  return join(monthPath, getCacheFileName(key));
}

/**
 * Retrieves data from the filesystem cache if it exists and is fresh.
 */
export function getCache(key: string): string | null {
  try {
    const path = findInCache(getCacheFileName(key));
    if (path) {
      const stats = statSync(path);
      if (getCacheTtl() > Date.now() - stats.mtimeMs) {
        return readFileSync(path, "utf8");
      }
    }
  } catch (error) {
    cacheDebug("getCache", key, error);
  }
  return null;
}

/**
 * Saves data to the filesystem cache.
 */
export function setCache(key: string, value: string): void {
  try {
    if (Buffer.byteLength(value, "utf8") > CACHE_MAX_SIZE) {
      throw new Error("cache entry exceeds CACHE_MAX_SIZE");
    }

    atomicWriteFileSync(getWriteCachePath(key), value);
    cleanupFutureCache();
  } catch (error) {
    cacheDebug("setCache", key, error);
  }
}
