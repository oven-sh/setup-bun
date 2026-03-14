import { mkdirSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { cwd } from "node:process";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { addPath, saveState, info, warning } from "@actions/core";
import { atomicWriteFileSync } from "./atomic-write";
import { writeBunfig } from "./bunfig";
import { downloadBun } from "./download-bun";
import { getDownloadUrl } from "./download-url";
import { Registry } from "./registry";
import {
  exe,
  extractVersionFromUrl,
  getCacheKey,
  getRevision,
  isVersionMatch,
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
  cacheHit: boolean;
};

export type CacheState = {
  cacheEnabled: boolean;
  cacheHit: boolean;
  bunPath: string;
  url: string;
};

export default async (options: Input): Promise<Output> => {
  const bunfigPath = join(cwd(), "bunfig.toml");
  writeBunfig(bunfigPath, options.registries);

  const url = await getDownloadUrl(options);
  const cacheEnabled = isCacheEnabled(options);

  const binPath = join(homedir(), ".bun", "bin");
  try {
    mkdirSync(binPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  addPath(binPath);

  const bunPath = join(binPath, exe("bun"));
  try {
    symlinkSync(bunPath, join(binPath, exe("bunx")));
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  let revision: string | undefined;
  let cacheHit = false;

  // Check if Bun executable already exists and matches requested version
  if (!options.customUrl && existsSync(bunPath)) {
    const existingRevision = await getRevision(bunPath);
    if (existingRevision && isVersionMatch(existingRevision, options.version)) {
      revision = existingRevision;
      cacheHit = true; // Treat as cache hit to avoid unnecessary network requests
      info(`Using existing Bun installation: ${revision}`);
    }
  }

  if (!revision) {
    if (cacheEnabled) {
      const cacheKey = getCacheKey(url);

      const cacheRestored = await restoreCache([bunPath], cacheKey);
      if (cacheRestored) {
        revision = await getRevision(bunPath);
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
          } else {
            cacheHit = true;
            info(`Using a cached version of Bun: ${revision}`);
          }
        } else {
          warning(
            `Found a cached version of Bun: ${revision} (but it appears to be corrupted?)`,
          );
        }
      }
    }

    if (!cacheHit) {
      info(`Downloading a new version of Bun: ${url}`);
      const result = await downloadBun(url, bunPath, options.token);
      cacheState.cacheHit = false;
      checksum = result.checksum;
      cacheState.checksum = checksum;

      revision = await getRevision(bunPath);
      cacheState.revision = revision;
    }
  }

  if (!revision) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again.",
    );
  }

  const [version] = revision.split("+");

  const cacheState: CacheState = {
    cacheEnabled,
    cacheHit,
    bunPath,
    url,
  };

  saveState("cache", JSON.stringify(cacheState));

  return {
    version,
    revision,
    bunPath,
    url,
    cacheHit,
  };
};

function isCacheEnabled(options: Input): boolean {
  const { customUrl, version, noCache } = options;
  if (noCache) {
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
