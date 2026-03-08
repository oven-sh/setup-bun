import { URL } from "node:url";
import { GITHUB_DIGEST_THRESHOLD, addGitHubApiHeaders } from "./github-api";
import { buildUrl } from "./url";
import { request } from "./utils";

/**
 * Maps known GitHub digest algorithms to their expected hex lengths.
 */
const DIGEST_CONFIG = {
  sha256: 64,
  sha512: 128,
} as const;

type DigestAlgorithm = keyof typeof DIGEST_CONFIG;

/**
 * Represents a GitHub digest string in the format "algorithm:hex"
 */
export type GitHubDigest = `${DigestAlgorithm}:${string}`;

/**
 * Metadata extracted solely from the Download URL.
 */
export interface UrlAssetMetadata {
  owner: string;
  repo: string;
  tag: string;
  name: string;
  latest: boolean;
}

/**
 * Complete metadata retrieved from the GitHub API.
 */
export interface AssetMetadata extends UrlAssetMetadata {
  digest?: GitHubDigest;
  updated_at: Date;
}

/**
 * Validates the algorithm and hex length, returning the clean hex string.
 */
export function getHexFromDigest(digest: GitHubDigest): string {
  const parts = digest.toLowerCase().split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid digest format: ${digest}`);
  }

  const [algorithm, hex] = parts;
  const expectedLength = DIGEST_CONFIG[algorithm as DigestAlgorithm];

  if (!expectedLength) {
    throw new Error(`Unsupported digest algorithm: ${algorithm}`);
  }

  if (hex.length !== expectedLength || !/^[a-f0-9]+$/.test(hex)) {
    throw new Error(
      `Invalid ${algorithm} hex format. Expected ${expectedLength} chars, got ${hex.length}`,
    );
  }

  return hex;
}

/**
 * Decomposes a GitHub download URL into metadata components.
 * Pattern: https://github.com/{owner}/{repo}/releases/download/{tag}/{filename}
 * Latest: https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-aarch64.zip
 */
export function parseAssetUrl(downloadUrl: string): UrlAssetMetadata {
  const urlObj = new URL(downloadUrl);
  if ("github.com" !== urlObj.hostname) {
    throw new Error(`Expected a github.com URL, got: ${urlObj.hostname}`);
  }

  // Remove leading slash so index 0 is 'owner'
  const parts = urlObj.pathname.slice(1).split("/");
  if (parts.length !== 6) {
    throw new Error(`Unsupported GitHub asset URL format: ${downloadUrl}`);
  }

  const expectedStructure =
    "releases" === parts[2] &&
    (("latest" === parts[3] && "download" === parts[4]) ||
      "download" === parts[3]);

  const owner = parts[0];
  const repo = parts[1];
  let tag = parts[4];
  const name = decodeURIComponent(parts[5]);

  if (!expectedStructure || !owner || !repo || !tag || !name) {
    throw new Error(
      `Failed to parse GitHub asset metadata from: ${downloadUrl}`,
    );
  }

  const latest = "latest" === parts[3] && "download" === tag;
  if (latest) {
    tag = "";
  }

  return { owner, repo, tag, name, latest };
}

/**
 * Enriches asset metadata with the official GitHub 'digest' and 'updated_at' from the API.
 */
export async function fetchAssetMetadata(
  downloadUrl: string,
  token?: string,
): Promise<AssetMetadata> {
  const base = parseAssetUrl(downloadUrl);

  // Use buildUrl for the API request: /repos/{owner}/{repo}/releases/tags/{tag}
  const releasePath = base.latest ? "latest" : `tags/${base.tag}`;
  const apiUrl = buildUrl(
    "api.github.com",
    `/repos/${base.owner}/${base.repo}/releases/${releasePath}`,
  );

  const headers = addGitHubApiHeaders(apiUrl, {}, token);
  const response = await request(apiUrl, { headers: headers });

  const release = await response.json();
  if (release && base.latest) {
    base.tag = encodeURIComponent(release.tag_name);
  }

  const asset = release.assets?.find((a: any) => a.name === base.name);
  if (!asset) {
    throw new Error(`Asset ${base.name} not found in release ${base.tag}`);
  }

  return {
    ...base,
    digest: asset.digest as GitHubDigest | undefined,
    updated_at: new Date(asset.updated_at),
  };
}
