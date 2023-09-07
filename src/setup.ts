import { homedir } from "node:os";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import * as action from "@actions/core";
import { downloadTool, extractZip } from "@actions/tool-cache";
import * as cache from "@actions/cache";
import { restoreCache, saveCache } from "@actions/cache";
import { cp, rmRF } from "@actions/io";
import { getExecOutput } from "@actions/exec";

export default async (options?: {
  version?: string;
  customUrl?: string;
}): Promise<{
  version: string;
  cacheHit: boolean;
}> => {
  const { url, cacheKey } = getDownloadUrl(options);
  const cacheEnabled = cacheKey && cache.isFeatureAvailable();
  const dir = join(homedir(), ".bun", "bin");
  action.addPath(dir);
  const path = join(dir, "bun");
  let version: string | undefined;
  let cacheHit = false;
  if (cacheEnabled) {
    const cacheRestored = await restoreCache([path], cacheKey);
    if (cacheRestored) {
      version = await verifyBun(path);
      if (version) {
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
    await cp(exePath, path);
    await rmRF(exePath);
    version = await verifyBun(path);
  }
  if (!version) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again in debug mode."
    );
  }
  if (cacheEnabled) {
    try {
      await saveCache([path], cacheKey);
    } catch (error) {
      action.warning("Failed to save Bun to cache.");
    }
  }
  return {
    version,
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
  const { exitCode, stdout } = await getExecOutput(path, ["--version"], {
    ignoreReturnCode: true,
  });
  return exitCode === 0 ? stdout.trim() : undefined;
}
