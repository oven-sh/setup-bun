import { test, describe } from "node:test";
import assert from "node:assert";
import {
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  mkdirSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomicWriteFileSync } from "../src/atomic-write";

export function register() {
  describe("atomicWriteFileSync", () => {
    const testDir = join(tmpdir(), `atomic-write-${Date.now()}`);

    // Setup: Create a clean temp directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (e) {
      /* ignored */
    }

    test("standard write: creates a new file with string content", () => {
      const dest = join(testDir, "test.txt");
      const content = "atomic content";
      atomicWriteFileSync(dest, content);
      assert.strictEqual(readFileSync(dest, "utf8"), content);
    });

    test("binary write: handles Uint8Array/Buffer correctly", () => {
      const dest = join(testDir, "binary.bin");
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      atomicWriteFileSync(dest, data);
      const result = readFileSync(dest);
      assert.deepStrictEqual(new Uint8Array(result), data);
    });

    test("initial write: creates a new file with restricted 0o600 permissions", () => {
      const dest = join(testDir, "new-restricted-file.conf");
      assert.strictEqual(existsSync(dest), false);

      try {
        // Act: Create new file with 0o600 (required for bunfig.ts)
        atomicWriteFileSync(dest, "data", { mode: 0o600 });

        // Assert: Verify permissions
        const stats = statSync(dest);
        assert.strictEqual(stats.mode & 0o777, 0o600);
      } finally {
        try {
          rmSync(dest, { force: true });
        } catch {}
      }
    });

    test("initial binary write: DataView correctly respects 0o600 permissions", () => {
      const dest = join(testDir, "binary-restricted.dat");
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 0xdeadbeef);

      assert.strictEqual(existsSync(dest), false);

      try {
        // Act: Create new file with DataView and 0o600
        atomicWriteFileSync(dest, view, { mode: 0o600 });

        // Assert: Verify permissions and content
        const stats = statSync(dest);
        const result = readFileSync(dest);

        assert.strictEqual(stats.mode & 0o777, 0o600);
        // Note: readFileSync returns a Buffer, we check the uint32 value
        assert.strictEqual(result.readUInt32BE(0), 0xdeadbeef);
      } finally {
        try {
          rmSync(dest, { force: true });
        } catch {}
      }
    });

    test("permissions: preserves existing mode on overwrite", () => {
      const dest = join(testDir, "mode-preserve.txt");
      // Initial file with 0o400 (read-only for owner)
      writeFileSync(dest, "old", { mode: 0o400 });

      atomicWriteFileSync(dest, "new");

      const stats = statSync(dest);
      assert.strictEqual(readFileSync(dest, "utf8"), "new");
      // Masking with 0o777 to ignore file-type bits
      assert.strictEqual(stats.mode & 0o777, 0o400);
    });

    test("encoding: handles string shorthand (hex)", () => {
      const dest = join(testDir, "hex.txt");
      // "world" in hex
      atomicWriteFileSync(dest, "776f726c64", "hex");
      assert.strictEqual(readFileSync(dest, "utf8"), "world");
    });

    test("safety: fails but does not crash when writing to a directory path", () => {
      // Attempting to write a file where a directory already exists
      assert.throws(() => {
        atomicWriteFileSync(testDir, "should fail");
      });
    });

    test("path errors: respects OS ENOTDIR for trailing slashes on files", () => {
      const dest = join(testDir, "not-a-dir.txt");
      writeFileSync(dest, "content");

      assert.throws(
        () => {
          atomicWriteFileSync(`${dest}/`, "data");
        },
        (err: any) => err.code === "ENOTDIR" || err.code === "ENOENT",
      );
    });

    test("concurrency: handles 50 simultaneous writes to the same path", async () => {
      const dest = join(testDir, "race-condition.txt");
      const writes = Array.from({ length: 50 }, (_, i) => {
        return new Promise<void>((resolve, reject) => {
          // Randomize timing slightly to increase chance of overlap
          setTimeout(() => {
            try {
              atomicWriteFileSync(dest, `write-${i}`);
              resolve();
            } catch (e: any) {
              // EEXIST is expected "wx" behavior during a temp-file rename race
              if (e?.code === "EEXIST") {
                resolve();
              } else {
                reject(e);
              }
            }
          }, Math.random() * 10);
        });
      });

      await Promise.all(writes);
      assert.ok(existsSync(dest), "Final file should exist after race");
    });

    test("DataView: correctly writes a slice of an ArrayBuffer", () => {
      const dest = join(testDir, "dataview-slice.bin");
      const buffer = new ArrayBuffer(10);
      const fullView = new Uint8Array(buffer);
      fullView.fill(0); // Fill with zeros

      // Put specific data in the middle
      fullView[4] = 0xde;
      fullView[5] = 0xad;

      // Create a 2-byte DataView starting at offset 4
      const slicedView = new DataView(buffer, 4, 2);

      atomicWriteFileSync(dest, slicedView);

      const result = readFileSync(dest);
      assert.strictEqual(result.length, 2, "Should only write 2 bytes");
      assert.strictEqual(result[0], 0xde);
      assert.strictEqual(result[1], 0xad);
    });

    test("Broken Symlink: handles rename over broken link", () => {
      const linkPath = join(testDir, "broken-link");
      const targetPath = join(testDir, "non-existent-target");

      // Only skip when the OS actively refuses symlink creation
      try {
        symlinkSync(targetPath, linkPath);
      } catch (e: any) {
        if (e?.code === "EPERM" || e?.code === "ENOSYS") {
          return; // platform doesn't support symlinks — skip
        }
        throw e; // unexpected setup failure
      }

      // Symlinks are supported — let any failure surface from here on
      atomicWriteFileSync(linkPath, "recovered");

      assert.strictEqual(readFileSync(linkPath, "utf8"), "recovered");
      assert.ok(
        statSync(linkPath).isFile(),
        "Should have replaced link with real file",
      );
    });

    test("cleanup", () => {
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {}
    });
  });
}
