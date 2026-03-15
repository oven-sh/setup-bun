import { test, describe } from "node:test";
import assert from "node:assert";
import { createHash } from "node:crypto";
import { setStoredResponse, getStoredResponse } from "../src/response-storage";
import { setCache, getCacheTtl } from "../src/filesystem-cache";

export function register() {
  describe("Response Storage", () => {
    // URLs that pass isMetadata check (https + github.com + .txt or .txt.asc)
    const baseUri = "https://github.com/bun/setup-bun/raw/main/test";
    const binUri = `${baseUri}-bin.txt`;
    const mismatchUri = `${baseUri}-mismatch.txt`;
    const limitUri = `${baseUri}-limit.txt`;
    const fallbackUri = `${baseUri}-fallback.txt`;
    const legacyUri = `${baseUri}-legacy.txt`;
    const ascUri = `${baseUri}-sig.txt.asc`;
    const revivalUri = `${baseUri}-revival.txt`;

    test("should store as base64 when x-ms-blob-content-md5 matches", async () => {
      const content = Buffer.from([0x00, 0xff, 0x00, 0xff]);
      const md5 = createHash("md5").update(content).digest("base64");

      const res = new Response(content, {
        headers: { "x-ms-blob-content-md5": md5 },
      });

      await setStoredResponse(binUri, res);
      const stored = getStoredResponse(binUri);

      assert.ok(stored, "Response should be cached");
      const buffer = await stored.response.arrayBuffer();
      assert.deepStrictEqual(Buffer.from(buffer), content);
    });

    test("should not store in cache if MD5 does not match", async () => {
      const content = Buffer.from("correct content");
      const badMd5 = createHash("md5")
        .update(Buffer.from("wrong"))
        .digest("base64");

      const res = new Response(content, {
        headers: { "x-ms-blob-content-md5": badMd5 },
      });

      await setStoredResponse(mismatchUri, res);
      const stored = getStoredResponse(mismatchUri);

      assert.strictEqual(stored, undefined, "Mismatch should abort caching");
    });

    test("should enforce 256 MiB limit via content-length header", async () => {
      const oversized = 1024 * 1024 * 257; // 257 MiB

      const res = new Response(null, {
        headers: { "content-length": oversized.toString() },
      });

      await setStoredResponse(limitUri, res);
      const stored = getStoredResponse(limitUri);

      assert.strictEqual(
        stored,
        undefined,
        "Oversized file should not be cached",
      );
    });

    test("should fallback to utf8 when no MD5 header is present", async () => {
      const content = "plain text data";

      const res = new Response(content);
      await setStoredResponse(fallbackUri, res);

      const stored = getStoredResponse(fallbackUri);
      assert.ok(stored, "Text response should be cached");

      const text = await stored.response.text();
      assert.strictEqual(text, content);
    });

    test("should correctly handle .asc extensions via isMetadata logic", async () => {
      // .asc files look at the extension of the base filename (e.g., .txt.asc -> .txt)
      const content = "signature data";
      const res = new Response(content);

      await setStoredResponse(ascUri, res);
      const stored = getStoredResponse(ascUri);

      assert.ok(stored, "ASC file with .txt base should be cached");
      const text = await stored.response.text();
      assert.strictEqual(text, content);
    });

    test("revival: signals true when data age > 25% of TTL", async () => {
      const ttl = getCacheTtl(); // 2 days (172,800,000 ms)
      const twentySixPercentAge = (ttl / 100) * 26;

      // Create a Date header representing 26% age
      const oldDate = new Date(Date.now() - twentySixPercentAge);

      const res = new Response("old content", {
        headers: { "Date": oldDate.toUTCString() },
      });
      res.storedAt = oldDate.getTime();

      await setStoredResponse(revivalUri, res);
      const stored = getStoredResponse(revivalUri);

      assert.ok(stored);
      assert.strictEqual(
        stored.isRevivalNeeded,
        true,
        "Should signal revival at 26% age",
      );
    });

    test("revival: signals false when data age < 25% of TTL", async () => {
      const ttl = getCacheTtl();
      const tenPercentAge = (ttl / 100) * 10;

      const newDate = new Date(Date.now() - tenPercentAge).toUTCString();

      const res = new Response("new content", {
        headers: { "Date": newDate },
      });

      await setStoredResponse(revivalUri, res);
      const stored = getStoredResponse(revivalUri);

      assert.ok(stored);
      assert.strictEqual(
        stored.isRevivalNeeded,
        false,
        "Should not signal revival at 10% age",
      );
    });

    test("should handle legacy non-envelope cache hits", async () => {
      const rawData = "raw un-enveloped data";

      setCache(legacyUri, rawData);

      const stored = getStoredResponse(legacyUri);
      assert.ok(stored, "Legacy data should be retrieved");

      const text = await stored.response.text();
      assert.strictEqual(text, rawData);
      assert.strictEqual(stored.response.headers.get("X-Storage-Hit"), "true");
    });
  });
}
