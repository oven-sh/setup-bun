import path from "node:path";
import { createHash } from "node:crypto";
import { URL } from "node:url";
import { CACHE_TTL, getCache, setCache } from "./filesystem-cache";

const ENVELOPE_SENTINEL = "__envelope";

// Extracts the type of the 'method' property from RequestInit
type FetchMethod = NonNullable<RequestInit["method"]>;

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
export function getStoredResponse(url: string): Response | undefined {
  if (!isMetadata(url)) {
    return undefined;
  }

  const data = getCache(url);
  if (null !== data) {
    try {
      const parsed = JSON.parse(data);

      if (
        parsed &&
        "object" === typeof parsed &&
        ENVELOPE_SENTINEL in parsed &&
        parsed[ENVELOPE_SENTINEL] ===
          makeEnvelopeValue(parsed.method, url, parsed.status)
      ) {
        return new Response(parsed.body, {
          status: parsed.status,
          headers: {
            ...parsed.headers,
            "X-Storage-Hit": "true",
          },
        });
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
    const lastModified = new Date(Date.now() - CACHE_TTL).toUTCString();
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Last-Modified": lastModified,
        "X-Storage-Hit": "true",
      },
    });
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
  if (!isMetadata(url) || !res.ok) {
    return;
  }

  try {
    // We clone so the original stream remains readable by the caller
    const body = await res.clone().text();
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
    });
    setCache(url, envelope);
  } catch {
    // Fail silently to avoid breaking the main execution flow
  }
}
