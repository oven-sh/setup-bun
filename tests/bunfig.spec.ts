import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { writeBunfig } from "../src/bunfig";
import { EOL } from "os";

describe("writeBunfig", () => {
  const filePath = "bunfig_test.toml";

  async function getFileAndContents() {
    const file = Bun.file(filePath);
    const contents = (await file.text()).split(EOL);

    return { file, contents };
  }

  afterEach(() => {
    if (existsSync(filePath)) unlinkSync(filePath);
    console.log(`${filePath} was deleted`);
  });

  describe("when no bunfig_test.toml file exists", () => {
    it("should create a new file with scopes content", async () => {
      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "foo-bar",
          token: "$BUN_AUTH_TOKEN",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        '[install.scopes."@foo-bar"]',
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });

    it("should create a new file with global registry", async () => {
      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install.registry]",
        'url = "https://npm.pkg.github.com"',
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });

    it("should create a new file with global registry & token", async () => {
      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "",
          token: "$BUN_AUTH_TOKEN",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install.registry]",
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });
  });

  describe("when local bunfig_test.toml file exists", () => {
    it("and no [install.scopes] exists, should concatenate file correctly", async () => {
      const bunfig = `[install]${EOL}optional = true${EOL}${EOL}[install.cache]${EOL}disable = true`;

      await Bun.write(filePath, bunfig);

      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "foo-bar",
          token: "$BUN_AUTH_TOKEN",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install]",
        "optional = true",
        "",
        "  [install.cache]",
        "  disable = true",
        "",
        '[install.scopes."@foo-bar"]',
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });

    it("and [install.scopes] exists and it's not the same registry, should concatenate file correctly", async () => {
      const bunfig = `[install]${EOL}optional = true${EOL}${EOL}[install.scopes]${EOL}'@bla-ble' = { token = "$BUN_AUTH_TOKEN", url = "https://npm.pkg.github.com/" }${EOL}${EOL}[install.cache]${EOL}disable = true`;

      await Bun.write(filePath, bunfig);

      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "foo-bar",
          token: "$BUN_AUTH_TOKEN",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install]",
        "optional = true",
        "",
        '[install.scopes."@bla-ble"]',
        'token = "$BUN_AUTH_TOKEN"',
        'url = "https://npm.pkg.github.com/"',
        "",
        '[install.scopes."@foo-bar"]',
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
        "  [install.cache]",
        "  disable = true",
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });

    it("and [install.scopes] exists and it's the same registry, should concatenate file correctly", async () => {
      const bunfig = `[install]${EOL}optional = true${EOL}${EOL}[install.scopes]${EOL}'@foo-bar' = { token = "$BUN_AUTH_TOKEN", url = "https://npm.pkg.github.com/" }${EOL}'@bla-ble' = { token = "$BUN_AUTH_TOKEN", url = "https://npm.pkg.github.com/" }${EOL}${EOL}[install.cache]${EOL}disable = true`;

      await Bun.write(filePath, bunfig);

      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "foo-bar",
          token: "$BUN_AUTH_TOKEN",
        },
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install]",
        "optional = true",
        "",
        '[install.scopes."@foo-bar"]',
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
        '[install.scopes."@bla-ble"]',
        'token = "$BUN_AUTH_TOKEN"',
        'url = "https://npm.pkg.github.com/"',
        "",
        "  [install.cache]",
        "  disable = true",
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });

    it("and [install.scopes] and [install] exists, should concantenate file correctly", async () => {
      const bunfig = `[install]${EOL}optional = true${EOL}${EOL}[install.scopes]${EOL}'@foo-bar' = { token = "$BUN_AUTH_TOKEN", url = "https://npm.pkg.github.com/" }${EOL}'@bla-ble' = { token = "$BUN_AUTH_TOKEN", url = "https://npm.pkg.github.com/" }${EOL}${EOL}[install.cache]${EOL}disable = true`;

      await Bun.write(filePath, bunfig);

      writeBunfig(filePath, [
        {
          url: "https://npm.pkg.github.com",
          scope: "foo-bar",
          token: "$BUN_AUTH_TOKEN",
        },
        {
          url: "https://bun.sh",
          scope: "",
          token: "$BUN_AUTH_TOKEN",
        }, // global registry
      ]);

      const { file, contents } = await getFileAndContents();

      expect(file.exists()).resolves.toBeTrue();

      const expectedContents = [
        "[install]",
        "optional = true",
        "",
        '[install.scopes."@foo-bar"]',
        'url = "https://npm.pkg.github.com"',
        'token = "$BUN_AUTH_TOKEN"',
        "",
        '[install.scopes."@bla-ble"]',
        'token = "$BUN_AUTH_TOKEN"',
        'url = "https://npm.pkg.github.com/"',
        "",
        "  [install.cache]",
        "  disable = true",
        "",
        "  [install.registry]",
        '  url = "https://bun.sh"',
        '  token = "$BUN_AUTH_TOKEN"',
        "",
      ];

      contents.forEach((content, index) =>
        expect(content).toBe(expectedContents[index])
      );

      expect(contents.length).toBe(expectedContents.length);
    });
  });

  describe("when multiple global registries are provided", () => {
    it("should throw an error", () => {
      expect(() => {
        writeBunfig(filePath, [
          {
            url: "https://npm.pkg.github.com",
            scope: "",
            token: "$BUN_AUTH_TOKEN",
          },
          {
            url: "https://bun.sh",
            scope: "",
            token: "$BUN_AUTH_TOKEN",
          },
        ]);
      }).toThrow("You can't have more than one global registry.");
    });
  });
});
