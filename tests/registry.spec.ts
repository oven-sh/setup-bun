import { describe, expect, it } from "bun:test";
import { parseRegistries } from "../src/registry";

describe("registry", () => {
  describe("parseRegistries", () => {
    it("should return an empty array for empty input", () => {
      expect(parseRegistries("")).toEqual([]);
      expect(parseRegistries("   ")).toEqual([]);
      expect(parseRegistries(null as any)).toEqual([]);
      expect(parseRegistries(undefined as any)).toEqual([]);
    });

    it("should parse default registry without token", () => {
      const input = "https://registry.npmjs.org/";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.npmjs.org/",
          scope: "",
        },
      ]);
    });

    it("should parse default registry with token", () => {
      const input = "https://registry.npmjs.org/|npm_token123";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.npmjs.org/",
          scope: "",
          token: "npm_token123",
        },
      ]);
    });

    it("should parse scoped registry with URL credentials", () => {
      const input = "@myorg:https://username:password@registry.myorg.com/";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://username:password@registry.myorg.com/",
          scope: "@myorg",
        },
      ]);
    });

    it("should parse scoped registry with separate token", () => {
      const input = "@partner:https://registry.partner.com/|token_abc123";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.partner.com/",
          scope: "@partner",
          token: "token_abc123",
        },
      ]);
    });

    it("should parse multiple registries", () => {
      const input = `
        https://registry.npmjs.org/
        @myorg:https://username:password@registry.myorg.com/
        @partner:https://registry.partner.com/|token_abc123
      `;

      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.npmjs.org/",
          scope: "",
        },
        {
          url: "https://username:password@registry.myorg.com/",
          scope: "@myorg",
        },
        {
          url: "https://registry.partner.com/",
          scope: "@partner",
          token: "token_abc123",
        },
      ]);
    });

    it("should handle scope names without @ prefix", () => {
      const input = "myorg:https://registry.myorg.com/|token123";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.myorg.com/",
          scope: "myorg",
          token: "token123",
        },
      ]);
    });

    it("should throw error for invalid URLs", () => {
      expect(() => {
        parseRegistries("@myorg:not-a-valid-url");
      }).toThrow("Invalid URL in registry configuration: not-a-valid-url");

      expect(() => {
        parseRegistries("also-not-a-valid-url");
      }).toThrow("Invalid URL in registry configuration: also-not-a-valid-url");
    });

    it("should handle whitespace and empty lines", () => {
      const input = `

        https://registry.npmjs.org/

        @myorg:https://registry.myorg.com/|token123

      `;

      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.npmjs.org/",
          scope: "",
        },
        {
          url: "https://registry.myorg.com/",
          scope: "@myorg",
          token: "token123",
        },
      ]);
    });

    it("should handle URLs with paths and query parameters", () => {
      const input =
        "@myorg:https://registry.myorg.com/npm/registry/?timeout=5000|token123";
      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.myorg.com/npm/registry/?timeout=5000",
          scope: "@myorg",
          token: "token123",
        },
      ]);
    });

    it("should correctly handle scopes with hyphens and underscores", () => {
      const input = `
        @my-org:https://registry.myorg.com/
        @my_org:https://registry.myorg.com/
      `;

      const result = parseRegistries(input);

      expect(result).toEqual([
        {
          url: "https://registry.myorg.com/",
          scope: "@my-org",
        },
        {
          url: "https://registry.myorg.com/",
          scope: "@my_org",
        },
      ]);
    });
  });
});
