import { createHash } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { info, warning } from "@actions/core";
import { GITHUB_DIGEST_THRESHOLD } from "./github-api";
import { fetchAssetMetadata, getHexFromDigest } from "./github-asset";
import { getVerifiedManifest } from "./manifest";
import { getGitHubManifestUrl } from "./url";

class DigestVerificationError extends Error {}
class UnsupportedAlgorithmError extends Error {}

interface AlgorithmConfig {
  readonly manifestFile: string;
}

type SupportedAlgorithmNames = "sha256";

const supportedAlgorithms = {
  "sha256": { "manifestFile": "SHASUMS256.txt" },
} as const satisfies Record<SupportedAlgorithmNames, AlgorithmConfig>;

/**
 * Type Guard: Checks if a string is a valid key in our dictionary
 */
function isSupportedAlgorithm(
  algoName: string,
): algoName is SupportedAlgorithmNames {
  return algoName in supportedAlgorithms;
}

function getManifest(algoName: string): string {
  // Use the Type Guard to narrow the string to a valid key
  if (isSupportedAlgorithm(algoName)) {
    // TypeScript now allows this access safely
    return supportedAlgorithms[algoName].manifestFile;
  }

  throw new UnsupportedAlgorithmError(`Unsupported algorithm: ${algoName}`);
}

/**
 * Orchestrates the full integrity check:
 * Local Hash -> GitHub API Digest (if available) -> PGP Manifest.
 *
 * Unlinks (deletes) the zipPath if any digest comparison fails to prevent
 * processing of untrusted binaries.
 */
export async function verifyAsset(
  zipPath: string,
  downloadUrl: string,
  token?: string,
  algorithm: SupportedAlgorithmNames = "sha256",
): Promise<void> {
  const manifestFile = getManifest(algorithm);
  const urlObj = new URL(downloadUrl);

  const rawAssetName = urlObj.pathname.split("/").pop();
  if (!rawAssetName) {
    throw new Error(
      `Could not determine asset filename from URL: ${downloadUrl}`,
    );
  }

  let assetName: string = rawAssetName;

  /**
   * 1. Establish the Local Baseline.
   * We hash the file immediately after download. If this doesn't match
   * subsequent checks, the file on disk is either corrupted or tampered with.
   */
  const fileBuffer = readFileSync(zipPath);
  const actualHash = createHash(algorithm)
    .update(fileBuffer)
    .digest("hex")
    .toLowerCase();

  /**
   * 2. Optional GitHub API Digest check.
   * Only meaningful for official github.com release URLs; skipped silently
   * for custom/mirror URLs where parseAssetUrl() cannot resolve metadata.
   * Real security mismatches are always re-thrown.
   */
  let digest_matched = false;
  let manifestBaseUrl = "";
  try {
    const metadata = await fetchAssetMetadata(downloadUrl, token);
    assetName = metadata.name;
    manifestBaseUrl = getGitHubManifestUrl(
      metadata.owner,
      metadata.repo,
      metadata.tag,
      manifestFile,
    );
    const updatedAt = new Date(metadata.updated_at);
    if (Number.isNaN(updatedAt.getTime())) {
      silentUnlink(zipPath);
      throw new DigestVerificationError(
        `Invalid updated_at for asset ${assetName}`,
      );
    }

    /**
     * GitHub began providing immutable 'digests' for release assets in June 2025.
     * For assets updated after our threshold, we cross-reference our local hash
     * with GitHub's infrastructure hash.
     */
    if (updatedAt >= GITHUB_DIGEST_THRESHOLD) {
      info(`Verifying via asset metadata: ${assetName}`);
      if (metadata.digest) {
        const githubHash = getHexFromDigest(metadata.digest);
        if (githubHash !== actualHash) {
          silentUnlink(zipPath);
          throw new DigestVerificationError(
            `Security Mismatch: GitHub API digest (${githubHash}) differs from local hash (${actualHash})!`,
          );
        }
        digest_matched = true;
        info(`GitHub API digest matched! (${metadata.digest})`);
      } else {
        warning(
          `GitHub digest missing for asset updated on ${updatedAt.toISOString()}`,
        );
      }
    }
  } catch (err) {
    if (err instanceof DigestVerificationError) {
      throw err; // always propagate real mismatches
    }
    warning(`Skipping GitHub API digest check for: ${downloadUrl}`);
  }

  /**
   * Derive the asset filename and the manifest URL directly from the
   * download URL — no GitHub API required for this step.
   * e.g. .../bun-v1.x/bun-linux-x64.zip  ->  .../bun-v1.x/SHASUMS256.txt
   */
  if (!manifestBaseUrl) {
    const parsedDownloadUrl = new URL(downloadUrl);
    const urlParts = parsedDownloadUrl.pathname.split("/");
    const lastSegment = urlParts[urlParts.length - 1] ?? "";

    // Bun archives always follow the pattern: bun-<specifiers>.zip
    if (!lastSegment.startsWith("bun-") || !lastSegment.endsWith(".zip")) {
      throw new Error(
        `Cannot derive manifest URL: "${downloadUrl}" ` +
          `does not appear to be a direct Bun archive URL. ` +
          `The path was expected to end with a filename matching "bun-*.zip".`,
      );
    }

    urlParts[urlParts.length - 1] = manifestFile;
    parsedDownloadUrl.pathname = urlParts.join("/");
    manifestBaseUrl = parsedDownloadUrl.href;
  }

  /**
   * 3. Fetch and Verify Mandatory PGP Manifest.
   * getVerifiedManifest appends ".asc" internally to fetch SHASUMS256.txt.asc.
   * For non-GitHub hosts the token is NOT forwarded (safe; manifest.ts checks
   * hostname). If the manifest cannot be fetched, this throws — intentionally.
   */
  const verifiedText = await getVerifiedManifest(manifestBaseUrl, token);

  /**
   * Find the specific hash for this asset filename within the verified
   * cleartext of the SHASUMS256.txt file.
   */
  const manifestMatch = verifiedText
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Fa-f0-9]+) [* ](.+)$/))
    .find(
      (m): m is RegExpMatchArray => Boolean(m) && m[2].trim() === assetName,
    );

  if (!manifestMatch) {
    silentUnlink(zipPath);
    throw new Error(
      `No verified hash found for ${assetName} in the signed manifest.`,
    );
  }

  /**
   * index [1] contains the first capture group (the 64-char hex string)
   */
  const manifestHash = manifestMatch[1].toLowerCase();

  /**
   * Final cross-check: The local file hash must exactly match the
   * hash that was cryptographically signed by robobun.
   */
  if (actualHash !== manifestHash) {
    silentUnlink(zipPath);
    throw new Error(
      `Integrity Failure: Local hash (${actualHash}) does not match manifest (${manifestHash})`,
    );
  }

  info(`Successfully verified ${assetName} (PGP + SHA256)`);
}

function silentUnlink(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch {
    // preserve original verification error path
  }
}
