import { test, describe, after } from "node:test";
import assert from "node:assert";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { getCache, setCache, CACHE_MAX_SIZE } from "../src/filesystem-cache";

export function register() {
  describe("Filesystem Cache", () => {
    // Reference the path set in the bundle entry point
    const rawTemp = process.env.RUNNER_TEMP!;
    const TEST_ROOT = (() => {
      try {
        return realpathSync(rawTemp);
      } catch {
        return rawTemp;
      }
    })();

    after(() => {
      // Safety check: only delete if we are in the isolated test root
      if (TEST_ROOT.includes("setup-bun-integration-test")) {
        rmSync(TEST_ROOT, { recursive: true, force: true });
      }
    });

    test("should use TEST_ROOT directory", () => {
      assert.ok(
        TEST_ROOT.includes("setup-bun-integration-test"),
        `Using unexpected TEST_ROOT: ${TEST_ROOT}`,
      );
    });

    test("should persist and retrieve data within the same month", () => {
      const key = "test-key";
      const value = "test-value";

      setCache(key, value);
      const retrieved = getCache(key);

      assert.strictEqual(
        retrieved,
        value,
        "Value should be retrievable after set",
      );
    });

    test("should respect CACHE_MAX_SIZE (metadata check)", () => {
      // Verify the exported constant matches src/filesystem-cache.ts (512 MiB)
      assert.strictEqual(CACHE_MAX_SIZE, 1024 * 1024 * 512);
    });

    test("should handle missing keys gracefully", () => {
      const result = getCache("missing-" + Date.now());
      assert.strictEqual(result, null, "Missing keys should return null");
    });

    test("should cleanup 'future' month directories on write", () => {
      const m = new Date().getMonth();

      // Match exactly the pad logic from src/filesystem-cache.ts: (1 + n).padStart(3, "0")
      // Logic for nextMonthDir: pad((1 + m) % 12)
      const nextMonthIdx = (1 + m) % 12;
      const nextMonthDirName = (nextMonthIdx + 1).toString().padStart(3, "0");

      const futurePath = join(TEST_ROOT, "setup-bun", nextMonthDirName);

      mkdirSync(futurePath, { recursive: true });
      writeFileSync(join(futurePath, "stale.json"), "{}");

      assert.ok(
        existsSync(futurePath),
        "Setup failed: Future directory should exist before trigger",
      );

      // setCache triggers internal cleanupFutureCache()
      setCache("trigger-cleanup", "data");

      assert.strictEqual(
        existsSync(futurePath),
        false,
        `Future directory ${nextMonthDirName} should have been purged`,
      );
    });
  });
}
