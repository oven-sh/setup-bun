import path from "node:path";
import { createHash } from "node:crypto";
import { URL } from "node:url";
import {
  CACHE_MAX_SIZE,
  getCacheTtl,
  getCache,
  setCache,
} from "./filesystem-cache";

const ENVELOPE_SENTINEL = "__envelope";
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 256; // MiB
export const MAX_CACHE_SIZE_BYTES = Math.min(
  CACHE_MAX_SIZE,
  MEMORY_LIMIT_BYTES,
);

// Extracts the type of the 'method' property from RequestInit
type FetchMethod = NonNullable<RequestInit["method"]>;

export interface StoredResponse {
  isRevivalNeeded: boolean;
  response: Response;
}

function makeEnvelopeValue(
  method: string,
  url: string,
  status: number,
): string {
  return createHash("sha1")
    .update(JSON.stringify({ method, url, status }))
    .digest("hex");
}

/**
 * Determines if the URL is metadata eligible for storage (e.g., GitHub API).
 */
function isMetadata(url: string): boolean {
  const urlObj = new URL(url);
  const { pathname } = urlObj;
  const pathObj = path.parse(pathname);

  const isSecure = "https:" === urlObj.protocol;
  const isGitHub = "github.com" === urlObj.hostname;
  const isGitHubApi = "api.github.com" === urlObj.hostname;

  let extension = pathObj.ext;
  if (".asc" === extension) {
    extension = path.parse(pathObj.name).ext;
  }

  const secureApi = isSecure && isGitHubApi;
  const smallish = isSecure && isGitHub && ".txt" === extension;

  return secureApi || smallish;
}

/**
 * Retrieves a stored Response from the filesystem if available.
 */
export function getStoredResponse(url: string): StoredResponse | undefined {
  if (!isMetadata(url)) {
    return undefined;
  }

  const data = getCache(url);
  if (null !== data) {
    try {
      const parsed = JSON.parse(data);

      if (parsed && "object" === typeof parsed && ENVELOPE_SENTINEL in parsed) {
        if (
          parsed[ENVELOPE_SENTINEL] !==
          makeEnvelopeValue(parsed.method, url, parsed.status)
        ) {
          return undefined;
        }

        const response = new Response(
          "base64" === parsed.encoding
            ? Buffer.from(parsed.body, "base64")
            : parsed.body,
          {
            status: parsed.status,
            headers: { ...parsed.headers, "X-Storage-Hit": "true" },
          },
        );

        const fetchedTime =
          "number" === typeof parsed.storedAt
            ? parsed.storedAt
            : new Date(response.headers.get("Date") || 0).getTime();

        let isRevivalNeeded = false;
        if (!isNaN(fetchedTime)) {
          const age = Date.now() - fetchedTime;
          const percentTTL = (getCacheTtl() / 100) * 25;
          // If the data is older than 25% of its TTL, signal for revival
          isRevivalNeeded = age > percentTTL;
        }

        return {
          isRevivalNeeded: isRevivalNeeded,
          response: response,
        };
      }
    } catch {
      /* Not JSON or not an envelope; Fall through to legacy handler */
    }

    const host = new URL(url).hostname;
    const contentType =
      "api.github.com" === host
        ? "application/json"
        : "text/plain; charset=utf-8";
    // Legacy/Raw Handler: Synthetic Last-Modified
    // (now - TTL) is the oldest possible age for this data
    const lastModified = new Date(Date.now() - getCacheTtl()).toUTCString();
    return {
      isRevivalNeeded: true,
      response: new Response(data, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Last-Modified": lastModified,
          "X-Storage-Hit": "true",
        },
      }),
    };
  }

  return undefined;
}

/**
 * Clones the response and persists its body to storage.
 */
export async function setStoredResponse(
  url: string,
  res: Response,
  method: FetchMethod = "GET",
): Promise<void> {
  if (
    "GET" !== method.toUpperCase() ||
    !isMetadata(url) ||
    !res.ok ||
    res.bodyUsed
  ) {
    return;
  }

  const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_CACHE_SIZE_BYTES) {
    return;
  }

  try {
    // We clone so the original stream remains readable by the caller
    const clonedRes = res.clone();
    const azureMd5 = res.headers.get("x-ms-blob-content-md5");

    let body: string;
    let encoding: "utf8" | "base64";

    if (azureMd5) {
      encoding = "base64";

      // Trust the server: MD5 presence implies binary-safe path is needed
      const buffer = await clonedRes.arrayBuffer();
      if (buffer.byteLength > MAX_CACHE_SIZE_BYTES) return;

      const bodyBuffer = Buffer.from(buffer);
      const hash = createHash("md5").update(bodyBuffer).digest("base64");

      if (hash !== azureMd5) return;

      body = bodyBuffer.toString(encoding);
    } else {
      encoding = "utf8";

      // No MD5: Default to efficient text path
      body = await clonedRes.text();
      if (Buffer.byteLength(body, "utf8") > MAX_CACHE_SIZE_BYTES) return;
    }

    const headers = Object.fromEntries(res.headers.entries());
    const envelope = JSON.stringify({
      [ENVELOPE_SENTINEL]: makeEnvelopeValue(method, url, res.status),
      body,
      headers,
      ok: res.ok,
      method: method,
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      encoding: encoding,
      storedAt: res.storedAt ?? Date.now(), // for testing
    });

    setCache(url, envelope);
  } catch {
    // Fail silently to avoid breaking the main execution flow
  }
}
