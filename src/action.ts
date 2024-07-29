import { homedir } from "node:os";
import { join } from "node:path";
import {
  mkdirSync,
  readdirSync,
  symlinkSync,
  renameSync,
  copyFileSync,
} from "node:fs";
import { addPath, info, warning } from "@actions/core";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { downloadTool, extractZip } from "@actions/tool-cache";
import { getExecOutput } from "@actions/exec";
import { writeBunfig } from "./bunfig";
import { saveState } from "@actions/core";
import { addExtension, getArchitecture, getPlatform, request } from "./utils";
import { compareVersions, satisfies, validate } from "compare-versions";

export type Input = {
  customUrl?: string;
  version?: string;
  os?: string;
  arch?: string;
  avx2?: boolean;
  profile?: boolean;
  scope?: string;
  registryUrl?: string;
  noCache?: boolean;
  token: string;
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
  const bunfigPath = join(process.cwd(), "bunfig.toml");
  writeBunfig(bunfigPath, options);

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

  const exe = (name: string) =>
    process.platform === "win32" ? `${name}.exe` : name;
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
  if (cacheEnabled) {
    const cacheRestored = await restoreCache([bunPath], url);
    if (cacheRestored) {
      revision = await getRevision(bunPath);
      if (revision) {
        cacheHit = true;
        info(`Using a cached version of Bun: ${revision}`);
      } else {
        warning(
          `Found a cached version of Bun: ${revision} (but it appears to be corrupted?)`
        );
      }
    }
  }

  if (!cacheHit) {
    info(`Downloading a new version of Bun: ${url}`);
    revision = await downloadBun(url, bunPath);
  }

  if (!revision) {
    throw new Error(
      "Downloaded a new version of Bun, but failed to check its version? Try again."
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

async function downloadBun(
  url: string,
  bunPath: string
): Promise<string | undefined> {
  // Workaround for https://github.com/oven-sh/setup-bun/issues/79 and https://github.com/actions/toolkit/issues/1179
  const zipPath = addExtension(await downloadTool(url), ".zip");
  const extractedZipPath = await extractZip(zipPath);
  const extractedBunPath = await extractBun(extractedZipPath);
  try {
    renameSync(extractedBunPath, bunPath);
  } catch {
    // If mv does not work, try to copy the file instead.
    // For example: EXDEV: cross-device link not permitted
    copyFileSync(extractedBunPath, bunPath);
  }

  return await getRevision(bunPath);
}

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

async function getDownloadUrl(options: Input): Promise<string> {
  const { customUrl } = options;
  if (customUrl) {
    return customUrl;
  }

  const res = (await (
    await request("https://api.github.com/repos/oven-sh/bun/git/refs/tags", {
      headers: {
        "Authorization": `Bearer ${options.token}`,
      },
    })
  ).json()) as { ref: string }[];
  let tags = res
    .filter(
      (tag) =>
        tag.ref.startsWith("refs/tags/bun-v") || tag.ref === "refs/tags/canary"
    )
    .map((item) => item.ref.replace(/refs\/tags\/(bun-)?/g, ""));

  const { version, os, arch, avx2, profile } = options;

  let tag = tags.find((t) => t === version);
  if (!tag) {
    tags = tags.filter((t) => validate(t)).sort(compareVersions);

    if (version === "latest") tag = `bun-v${tags.at(-1)}`;
    else tag = `bun-${tags.filter((t) => satisfies(t, version)).at(-1)}`;
  }

  const eversion = encodeURIComponent(tag ?? version);
  const eos = encodeURIComponent(os ?? getPlatform());
  const earch = encodeURIComponent(arch ?? getArchitecture());
  const eavx2 = encodeURIComponent(avx2 ? "-baseline" : "");
  const eprofile = encodeURIComponent(profile ? "-profile" : "");

  const { href } = new URL(
    `${eversion}/bun-${eos}-${earch}${eavx2}${eprofile}.zip`,
    "https://github.com/oven-sh/bun/releases/download/"
  );

  return href;
}

async function extractBun(path: string): Promise<string> {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const { name } = entry;
    const entryPath = join(path, name);
    if (entry.isFile()) {
      if (name === "bun" || name === "bun.exe") {
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

async function getRevision(exe: string): Promise<string | undefined> {
  const revision = await getExecOutput(exe, ["--revision"], {
    ignoreReturnCode: true,
  });
  if (revision.exitCode === 0 && /^\d+\.\d+\.\d+/.test(revision.stdout)) {
    return revision.stdout.trim();
  }
  const version = await getExecOutput(exe, ["--version"], {
    ignoreReturnCode: true,
  });
  if (version.exitCode === 0 && /^\d+\.\d+\.\d+/.test(version.stdout)) {
    return version.stdout.trim();
  }
  return undefined;
}
