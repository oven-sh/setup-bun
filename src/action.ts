import { mkdirSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { cwd } from "node:process";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { addPath, saveState, info, warning } from "@actions/core";
import { atomicWriteFileSync } from "./atomic-write";
import { writeBunfig } from "./bunfig";
import { downloadBun } from "./download-bun";
import { getDownloadUrl } from "./download-url";
import { quickFingerprint } from "./quick-checksum";
import { Registry } from "./registry";
import { isGitHub } from "./url";
import {
  exe,
  extractVersionFromUrl,
  getCacheKey,
  getRevision,
  isVersionMatch,
  stripUrlCredentials,
} from "./utils";

export type Input = {
  customUrl?: string;
  version?: string;
  os?: string;
  arch?: string;
  avx2?: boolean;
  profile?: boolean;
  registries?: Registry[];
  noCache?: boolean;
  token?: string;
};

export type Output = {
  version: string;
  revision: string;
  bunPath: string;
  url: string;
  checksum?: string;
  cacheHit: boolean;
};

export type CacheState = {
  cacheEnabled: boolean;
  cacheHit: boolean;
  bunPath: string;
  url: string;
  checksum?: string;
  binaryFingerprint?: string;
  revision?: string;
};

export default async (options: Input): Promise<Output> => {
  const bunfigPath = join(cwd(), "bunfig.toml");
  writeBunfig(bunfigPath, options.registries);

  const cacheEnabled = isCacheEnabled(options);
  const url = await getDownloadUrl(options);
  const sUrl = isGitHub(url) ? url : stripUrlCredentials(url);

  const binPath = join(homedir(), ".bun", "bin");
  try {
    mkdirSync(binPath, { recursive: true });
  } catch (error) {
    if ("EEXIST" !== error.code) {
      throw error;
    }
  }

  const bunPath = join(binPath, exe("bun"));
  try {
    symlinkSync(bunPath, join(binPath, exe("bunx")));
  } catch (error) {
    if ("EEXIST" !== error.code) {
      throw error;
    }
  }

  let checksum: string | undefined;
  let revision: string | undefined;
  let cacheHit = false;

  const cacheState: CacheState = {
    cacheEnabled,
    cacheHit,
    bunPath,
    url: sUrl,
    checksum,
    revision,
  };

  const cacheKey = getCacheKey(url);
  const statePath = join(homedir(), ".bun", "bun.json");
  if (cacheEnabled) {
    if (existsSync(statePath)) {
      try {
        const state = JSON.parse(readFileSync(statePath, "utf8")) as CacheState;
        if (state.url !== sUrl) {
          throw new Error("The URL did not match.");
        }

        if ("string" === typeof state.checksum) {
          checksum = state.checksum;
        }
        if ("string" === typeof state.binaryFingerprint) {
          cacheState.binaryFingerprint = state.binaryFingerprint;
        }
        if ("string" === typeof state.bunPath) {
          cacheState.bunPath = state.bunPath;
        }
        if ("string" === typeof state.revision) {
          cacheState.revision = state.revision;
        }
      } catch {
        warning(`Ignoring metadata from: ${statePath}`);
      }
      if (checksum) {
        cacheState.cacheHit = true;
        cacheState.checksum = checksum;
      }
    }
  }

  // Check if Bun executable already exists and matches requested version
  if (
    !options.customUrl &&
    cacheState.revision &&
    existsSync(cacheState.bunPath)
  ) {
    if (isVersionMatch(cacheState.revision, options.version)) {
      if (cacheState.binaryFingerprint) {
        try {
          const livePrint = quickFingerprint(cacheState.bunPath);
          if (livePrint === cacheState.binaryFingerprint) {
            revision = cacheState.revision;
            // Treat as cache hit to avoid unnecessary network requests
            cacheHit = cacheState.cacheHit;
            info(`Using existing Bun installation: ${revision}`);
          } else {
            info(
              `Binary at ${cacheState.bunPath} does not match stored fingerprint; re-downloading.`,
            );
          }
        } catch {
          info(
            `Could not verify binary at ${cacheState.bunPath}; re-downloading.`,
          );
        }
      }
      // No fingerprint in sidecar (first run after adding this feature):
      // fall through to re-download which will compute and persist it.
    }
  }

  const cachePaths = [cacheState.bunPath, statePath];
  if (!revision) {
    if (cacheEnabled) {
      const cacheRestored = await restoreCache(cachePaths, cacheKey);
      if (cacheRestored) {
        if (existsSync(statePath)) {
          try {
            const state = JSON.parse(
              readFileSync(statePath, "utf8"),
            ) as CacheState;
            if (state.url !== sUrl) {
              throw new Error("The URL did not match.");
            }

            if ("string" === typeof state.checksum) {
              checksum = state.checksum;
              cacheState.checksum = checksum;
            }
            if ("string" === typeof state.binaryFingerprint) {
              // There was a fingerprint, but restoring always invalidates it.
              cacheState.binaryFingerprint = "restored";
            }
            if ("string" === typeof state.bunPath) {
              cacheState.bunPath = state.bunPath;
            }
            if ("string" === typeof state.revision) {
              revision = state.revision;
              cacheState.revision = revision;
            }
          } catch {
            warning(`Ignoring cached metadata from: ${statePath}`);
          }
        }

        if (revision) {
          const expectedVersion = extractVersionFromUrl(url);
          const [actualVersion] = revision.split("+");
          if (!expectedVersion) {
            warning(
              `Could not parse expected version from URL: ${url}. Ignoring cache.`,
            );
            revision = undefined;
          } else if (actualVersion !== expectedVersion) {
            warning(
              `Cached Bun version ${revision} does not match expected version ${expectedVersion}. Re-downloading.`,
            );
            revision = undefined;
          } else if (cacheState.checksum) {
            cacheHit = true;
            cacheState.cacheHit = cacheHit;
            // Refresh fingerprint so the local fast-path works on the next run
            try {
              if ("restored" === cacheState.binaryFingerprint) {
                cacheState.binaryFingerprint = quickFingerprint(
                  cacheState.bunPath,
                );
                atomicWriteFileSync(statePath, JSON.stringify(cacheState));
              }
            } catch {
              // non-critical; next run will just fall back to restoreCache
            }
            info(`Using a cached version of Bun: ${revision}`);
          }
        } else {
          warning(
            `Found a Bun binary (with an unknown version) at: ${cacheState.bunPath}`,
          );
        }
      }
    }
  }

  if (!cacheHit) {
    cacheState.cacheHit = false;

    info(`Downloading a new version of Bun: ${url}`);
    const result = await downloadBun(url, bunPath, options.token);

    checksum = result.checksum;
    cacheState.bunPath = result.binPath;
    cacheState.checksum = checksum;
    cacheState.url = result.url;

    try {
      cacheState.binaryFingerprint = quickFingerprint(result.binPath);
    } catch {
      warning(`Could not fingerprint: ${result.binPath}`);
    }

    revision = await getRevision(result.binPath);
    cacheState.revision = revision;
  }

  if (!revision) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again.",
    );
  }

  const [version] = revision.split("+");

  cacheState.cacheHit = cacheHit;
  cacheState.checksum = checksum;
  cacheState.revision = revision;
  const stateValue = JSON.stringify({
    ...cacheState,
    url: stripUrlCredentials(cacheState.url),
  });
  if (cacheEnabled && !cacheHit) {
    atomicWriteFileSync(statePath, stateValue);
  }
  saveState("cache", stateValue);

  addPath(dirname(cacheState.bunPath));
  return {
    version,
    revision,
    bunPath: cacheState.bunPath,
    url: cacheState.url,
    checksum,
    cacheHit,
  };
};

function isCacheEnabled(options: Input): boolean {
  const { customUrl, version, noCache } = options;
  if (noCache) {
    process.env["FS_CACHE_FORCE_STALE"] = "1";
    return false;
  }
  if (customUrl) {
    return false;
  }
  if (!version || /latest|canary|action/i.test(version)) {
    return false;
  }
  return isFeatureAvailable();
}
