import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { debug } from "@actions/core";

const CACHE_DIR = process.env.RUNNER_TEMP || tmpdir();
const FS_CACHE_TIMEOUT = 1000 * 60 * 60 * 12; // hours

function cacheDebug(operation: string, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  debug(`filesystem-cache: ${operation} failed for key "${key}": ${message}`);
}

function getCachePath(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex");
  return join(CACHE_DIR, `setup-bun-${hash}.json`);
}

/**
 * Retrieves data from the filesystem cache if it exists and is under 12 hours old.
 */
export function getCache(key: string): string | null {
  const path = getCachePath(key);
  try {
    if (existsSync(path)) {
      const stats = statSync(path);
      if (FS_CACHE_TIMEOUT > Date.now() - stats.mtimeMs) {
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
  const path = getCachePath(key);
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(path, value, "utf8");
  } catch (error) {
    cacheDebug("setCache", key, error);
  }
}
