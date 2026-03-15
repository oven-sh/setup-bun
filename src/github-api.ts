import { URL } from "node:url";

/**
 * The date GitHub began providing mandatory digests for all release assets.
 */
export const GITHUB_DIGEST_THRESHOLD = new Date("2025-07-01");

export function addGitHubApiHeaders(
  url: string,
  currentHeaders: Record<string, string>,
  token?: string,
) {
  const urlObj = new URL(url);

  const isGitHubApi = "api.github.com" === urlObj.hostname;
  const isSecure = "https:" === urlObj.protocol;

  if (isGitHubApi && isSecure && token) {
    return {
      ...currentHeaders,
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Accept": "application/vnd.github+json",
    };
  }

  return currentHeaders;
}
