import { homedir } from "node:os";
import { join } from "node:path";
import { readdir, symlink } from "node:fs/promises";
import * as action from "@actions/core";
import { downloadTool, extractZip } from "@actions/tool-cache";
import * as cache from "@actions/cache";
import { restoreCache, saveCache } from "@actions/cache";
import { mv } from "@actions/io";
import { getExecOutput } from "@actions/exec";

type Options = {
  customUrl?: string;
  checkLatest?: boolean;
  version: string;
  os: string;
  arch: string;
  baseline: boolean;
  profile: boolean;
};

type Result = {
  version: string;
  cacheHit: boolean;
};

export default async function (options: Options): Promise<Result> {
  const url = getDownloadUrl(options);
  const cacheKey = getCacheKey(options);
  const cacheEnabled = cache.isFeatureAvailable();
  const path = join(homedir(), ".bun", "bin");
  action.addPath(path);
  const bunPath = join(path, "bun");
  const bunxPath = join(path, "bunx");
  let version: string | undefined;
  let cacheHit = false;
  if (!options.checkLatest && cacheEnabled) {
    const cacheRestored = await restoreCache([bunPath], cacheKey);
    if (cacheRestored) {
      version = await getVersion(bunPath);
      if (version) {
        cacheHit = true;
        action.info("Found a cached version of Bun.");
      } else {
        action.warning(
          "Found a cached version of Bun, but it appears to be corrupted? Attempting to download a new version."
        );
      }
    }
  }
  if (!cacheHit) {
    action.info(`Downloading a new version of Bun: ${url}`);
    const zipPath = await downloadTool(url.toString());
    const extractedPath = await extractZip(zipPath);
    const exePath = await extractFileFromZip(extractedPath, "bun");
    await mv(exePath, bunPath);
    version = await getVersion(bunPath);
  }
  if (!version) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again in debug mode."
    );
  }
  try {
    await symlink(bunPath, bunxPath);
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  if (cacheEnabled) {
    try {
      await saveCache([bunPath], cacheKey);
    } catch (error) {
      action.warning("Failed to save Bun to cache.");
    }
  }
  return {
    version,
    cacheHit,
  };
}

function getCacheKey(options: Options): string {
  const { customUrl } = options;
  if (customUrl) {
    return customUrl;
  }
  const { os, arch, baseline, profile, version } = options;
  let name = `bun-${os}-${arch}`;
  if (baseline) {
    name += "-baseline";
  }
  if (profile) {
    name += "-profile";
  }
  return `${name}@${version}`;
}

function getDownloadUrl(options: Options): URL {
  const { customUrl } = options;
  if (customUrl) {
    return new URL(customUrl);
  }
  const { version, os, arch, baseline, profile } = options;
  const url = new URL(
    `${encodeURIComponent(version)}/${os}/${arch}/bun.zip`,
    "https://bun.sh/download/"
  );
  if (baseline) {
    url.searchParams.set("baseline", "true");
  }
  if (profile) {
    url.searchParams.set("profile", "true");
  }
  return url;
}

async function extractFileFromZip(
  path: string,
  filename: string
): Promise<string> {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const { name } = entry;
    const entryPath = join(path, name);
    if (entry.isFile()) {
      if (name === filename) {
        return entryPath;
      }
      if (name.includes(filename) && name.endsWith(".zip")) {
        const extractedPath = await extractZip(entryPath);
        return extractFileFromZip(extractedPath, filename);
      }
    }
    if (name.includes(filename) && entry.isDirectory()) {
      return extractFileFromZip(entryPath, filename);
    }
  }
  throw new Error(`Failed to extract '${filename}' from '${path}'.`);
}

async function getVersion(path: string): Promise<string | undefined> {
  const { exitCode, stdout } = await getExecOutput(path, ["--version"], {
    ignoreReturnCode: true,
  });
  return exitCode === 0 ? stdout.trim() : undefined;
}
