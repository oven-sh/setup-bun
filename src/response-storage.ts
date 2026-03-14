import path from "node:path";
import { URL } from "node:url";
import { getCache, setCache } from "./filesystem-cache";

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
    const host = new URL(url).hostname;
    const contentType =
      "api.github.com" === host
        ? "application/json"
        : "text/plain; charset=utf-8";
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
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
): Promise<void> {
  if (!isMetadata(url) || !res.ok) {
    return;
  }

  try {
    // We clone so the original stream remains readable by the caller
    const body = await res.clone().text();
    setCache(url, body);
  } catch {
    // Fail silently to avoid breaking the main execution flow
  }
}
