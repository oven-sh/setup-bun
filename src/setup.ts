import { homedir } from "node:os";
import { join } from "node:path";
import { readdir, symlink } from "node:fs/promises";
import * as action from "@actions/core";
import { downloadTool, extractZip } from "@actions/tool-cache";
import * as cache from "@actions/cache";
import { restoreCache, saveCache } from "@actions/cache";
import { cp, mkdirP, rmRF } from "@actions/io";
import { getExecOutput } from "@actions/exec";

export default async (options?: {
  version?: string;
  customUrl?: string;
}): Promise<{
  version: string;
  revision: string;
  cacheHit: boolean;
}> => {
  const { url, cacheKey } = getDownloadUrl(options);
  const cacheEnabled = cacheKey && cache.isFeatureAvailable();
  const dir = join(homedir(), ".bun", "bin");
  action.addPath(dir);
  const path = join(dir, "bun");
  let revision: string | undefined;
  let cacheHit = false;
  if (cacheEnabled) {
    const cacheRestored = await restoreCache([path], cacheKey);
    if (cacheRestored) {
      revision = await verifyBun(path);
      if (revision) {
        cacheHit = true;
        action.info("Using a cached version of Bun.");
      } else {
        action.warning(
          "Found a cached version of Bun, but it appears to be corrupted? Attempting to download a new version."
        );
      }
    }
  }
  if (!cacheHit) {
    action.info(`Downloading a new version of Bun: ${url}`);
    const zipPath = await downloadTool(url);
    const extractedPath = await extractZip(zipPath);
    const exePath = await extractBun(extractedPath);
    await mkdirP(dir);
    await cp(exePath, path);
    await rmRF(exePath);
    revision = await verifyBun(path);
  }
  try {
    await symlink(path, join(dir, "bunx"));
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  if (!revision) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again in debug mode."
    );
  }
  if (cacheEnabled && !cacheHit) {
    try {
      await saveCache([path], cacheKey);
    } catch (error) {
      action.warning("Failed to save Bun to cache.");
    }
  }
  const [version] = revision.split("+");
  return {
    version,
    revision,
    cacheHit,
  };
};

function getDownloadUrl(options?: {
  customUrl?: string;
  version?: string;
  os?: string;
  arch?: string;
  avx2?: boolean;
  profile?: boolean;
}): {
  url: string;
  cacheKey: string | null;
} {
  if (options?.customUrl) {
    return {
      url: options.customUrl,
      cacheKey: null,
    };
  }
  const release = encodeURIComponent(options?.version ?? "latest");
  const os = encodeURIComponent(options?.os ?? process.platform);
  const arch = encodeURIComponent(options?.arch ?? process.arch);
  const avx2 = encodeURIComponent(options?.avx2 ?? true);
  const profile = encodeURIComponent(options?.profile ?? false);
  const { href } = new URL(
    `${release}/${os}/${arch}?avx2=${avx2}&profile=${profile}`,
    "https://bun.sh/download/"
  );
  return {
    url: href,
    cacheKey: /^latest|canary|action/i.test(release)
      ? null
      : `bun-${release}-${os}-${arch}-${avx2}-${profile}`,
  };
}

async function extractBun(path: string): Promise<string> {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const { name } = entry;
    const entryPath = join(path, name);
    if (entry.isFile()) {
      if (name === "bun") {
        return entryPath;
      }
      if (/^bun.*\.zip/.test(name)) {
        const extractedPath = await extractZip(entryPath);
        return extractBun(extractedPath);
      }
    }
    if (/^bun/.test(name) && entry.isDirectory()) {
      return extractBun(entryPath);
    }
  }
  throw new Error("Could not find executable: bun");
}

async function verifyBun(path: string): Promise<string | undefined> {
  const revision = await getExecOutput(path, ["--revision"], {
    ignoreReturnCode: true,
  });
  if (revision.exitCode === 0 && /^\d+\.\d+\.\d+/.test(revision.stdout)) {
    return revision.stdout.trim();
  }
  const version = await getExecOutput(path, ["--version"], {
    ignoreReturnCode: true,
  });
  if (version.exitCode === 0 && /^\d+\.\d+\.\d+/.test(version.stdout)) {
    return version.stdout.trim();
  }
  return undefined;
}
