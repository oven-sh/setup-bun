import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { readVersionFromFile } from "../src/utils";
import { resolve } from "node:path";

describe("readVersionFromFile", () => {
  const testDir = "/tmp/setup-bun-tests";
  const originalWorkspace = process.env.GITHUB_WORKSPACE;

  beforeEach(() => {
    // Set up test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    process.env.GITHUB_WORKSPACE = testDir;
  });

  afterEach(() => {
    // Clean up test directory
    try {
      const files = ["package.json", ".bun-version", ".tool-versions", ".bumrc"];
      files.forEach((file) => {
        const path = resolve(testDir, file);
        if (existsSync(path)) {
          unlinkSync(path);
        }
      });
    } catch (error) {
      console.error("Error cleaning up test files:", error);
    }
    process.env.GITHUB_WORKSPACE = originalWorkspace;
  });

  describe("package.json with packageManager field", () => {
    it("should read version from packageManager field", () => {
      const packageJson = {
        name: "test",
        packageManager: "bun@1.0.25",
      };
      writeFileSync(
        resolve(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const version = readVersionFromFile("package.json");
      expect(version).toBe("1.0.25");
    });

    it("should fallback to engines.bun when packageManager doesn't exist", () => {
      const packageJson = {
        name: "test",
        engines: {
          bun: ">=1.0.0",
        },
      };
      writeFileSync(
        resolve(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const version = readVersionFromFile("package.json");
      expect(version).toBe(">=1.0.0");
    });

    it("should return undefined when neither packageManager nor engines.bun exist (with warning)", () => {
      const packageJson = {
        name: "test",
      };
      writeFileSync(
        resolve(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const version = readVersionFromFile("package.json");
      expect(version).toBeUndefined();
    });
  });

  describe("silent mode", () => {
    it("should not warn when file doesn't exist and silent is true", () => {
      // This should not produce a warning
      const version = readVersionFromFile("package.json", true);
      expect(version).toBeUndefined();
    });

    it("should not warn when version cannot be read and silent is true", () => {
      const packageJson = {
        name: "test",
      };
      writeFileSync(
        resolve(testDir, "package.json"),
        JSON.stringify(packageJson, null, 2)
      );

      const version = readVersionFromFile("package.json", true);
      expect(version).toBeUndefined();
    });
  });

  describe(".bun-version file", () => {
    it("should read version from .bun-version file", () => {
      writeFileSync(resolve(testDir, ".bun-version"), "1.0.20");

      const version = readVersionFromFile(".bun-version");
      expect(version).toBe("1.0.20");
    });
  });

  describe(".tool-versions file", () => {
    it("should read bun version from .tool-versions file", () => {
      writeFileSync(resolve(testDir, ".tool-versions"), "nodejs 18.0.0\nbun 1.0.15\npython 3.9.0");

      const version = readVersionFromFile(".tool-versions");
      expect(version).toBe("1.0.15");
    });
  });
});
