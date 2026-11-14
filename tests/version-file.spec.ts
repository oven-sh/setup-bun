import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readVersionFromFile } from "../src/utils";

describe("readVersionFromFile (package.json)", () => {
  let workspace: string;
  let previousWorkspace: string | undefined;

  beforeEach(() => {
    previousWorkspace = process.env.GITHUB_WORKSPACE;
    workspace = mkdtempSync(join(tmpdir(), "setup-bun-version-"));
    process.env.GITHUB_WORKSPACE = workspace;
  });

  afterEach(() => {
    if (previousWorkspace === undefined) {
      delete process.env.GITHUB_WORKSPACE;
    } else {
      process.env.GITHUB_WORKSPACE = previousWorkspace;
    }
    rmSync(workspace, { recursive: true, force: true });
  });

  function readPackageVersion(pkg: object): string | undefined {
    writeFileSync(join(workspace, "package.json"), JSON.stringify(pkg));
    return readVersionFromFile("package.json", true);
  }

  for (const field of ["runtime", "packageManager"]) {
    describe(`devEngines.${field}`, () => {
      it.each(["1.4.0", "^1.4.0", "~1.4.0", ">=1.3.0", "canary"])(
        "reads version %s from an object",
        (version) => {
          expect(
            readPackageVersion({
              devEngines: { [field]: { name: "bun", version } },
            }),
          ).toBe(version);
        },
      );

      it("reads the first Bun version from an array", () => {
        expect(
          readPackageVersion({
            devEngines: {
              [field]: [
                { name: "node", version: "22.0.0" },
                { name: "bun" },
                { name: "bun", version: "^1.4.0" },
                { name: "bun", version: "^1.5.0" },
              ],
            },
          }),
        ).toBe("^1.4.0");
      });

      it.each(
        [
          undefined,
          null,
          {},
          [],
          { name: "node", version: "22.0.0" },
          { version: "1.4.0" },
          { name: "bun" },
          { name: "bun", version: "" },
          { name: "bun", version: "   " },
          { name: "bun", version: 123 },
          [null, { name: "npm", version: "11.0.0" }],
        ].map((entry) => [entry]),
      )("ignores entries without a usable Bun version: %j", (entry) => {
        expect(
          readPackageVersion({ devEngines: { [field]: entry } }),
        ).toBeUndefined();
      });

      it("trims whitespace from the version", () => {
        expect(
          readPackageVersion({
            devEngines: { [field]: { name: "bun", version: " ^1.4.0\n" } },
          }),
        ).toBe("^1.4.0");
      });
    });
  }

  it("preserves packageManager and engines.bun precedence", () => {
    const pkg = {
      packageManager: "bun@1.1.0",
      engines: { bun: "1.2.0" },
      devEngines: {
        runtime: { name: "bun", version: "1.3.0" },
        packageManager: { name: "bun", version: "1.4.0" },
      },
    };

    expect(readPackageVersion(pkg)).toBe("1.1.0");
    expect(readPackageVersion({ ...pkg, packageManager: "npm@11.0.0" })).toBe(
      "1.2.0",
    );
    expect(
      readPackageVersion({
        ...pkg,
        packageManager: undefined,
        engines: undefined,
      }),
    ).toBe("1.3.0");
  });

  it.each(
    [
      undefined,
      { name: "node", version: "22.0.0" },
      { name: "bun" },
      { name: "bun", version: "" },
      [{ name: "bun", version: " " }],
    ].map((runtime) => [runtime]),
  )("falls back to devEngines.packageManager when runtime is %j", (runtime) => {
    expect(
      readPackageVersion({
        devEngines: {
          runtime,
          packageManager: { name: "bun", version: "1.4.0" },
        },
      }),
    ).toBe("1.4.0");
  });

  it("returns undefined when no version is declared", () => {
    expect(readPackageVersion({})).toBeUndefined();
  });
});
