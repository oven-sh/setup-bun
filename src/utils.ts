import { info } from "node:console";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { debug, warning } from "@actions/core";
import { getExecOutput } from "@actions/exec";
import { extractZip } from "@actions/tool-cache";
import { compareVersions, validate } from "compare-versions";

import { getStoredResponse, setStoredResponse } from "./response-storage";

// First Bun version that ships native Windows ARM64 binaries.
const WINDOWS_ARM64_MIN_VERSION = "1.3.10";

export const exe = (name: string) =>
  "windows" === getPlatform() ? `${name}.exe` : name;

const normalizeVersion = (v: string) => v.replace(/^v/i, "");

const windows_arm = (os: string, arch: string) =>
  "windows" === os && ("aarch64" === arch || "arm64" === arch);

export function getCacheKey(url: string): string {
  return `bun-${createHash("sha1").update(url).digest("base64")}`;
}

export function extractVersionFromUrl(url: string): string | undefined {
  const match = url.match(/\/bun-v([^/]+)\//);
  return match?.[1];
}

export async function request(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "@oven-sh/setup-bun");
  }

  const method = (init?.method ?? "GET").toUpperCase();
  const canUseResponseCache = "GET" === method;
  const stored = getStoredResponse(url);
  if (canUseResponseCache) {
    if (stored) {
      if (stored.isRevivalNeeded) {
        const etag = stored.response.headers.get("ETag");
        if (etag) {
          headers.set("If-None-Match", etag);
        }
        const lastModified = stored.response.headers.get("Last-Modified");
        if (lastModified) {
          headers.set("If-Modified-Since", lastModified);
        }
      } else {
        return stored.response;
      }
    }
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (304 === res.status && canUseResponseCache && stored) {
    // We re-save the cached response to update the modification time
    // to 'now' effectively resetting the TTL.
    await setStoredResponse(url, stored.response, method);
    return stored.response;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch url ${url}. (status code: ${res.status}, status text: ${res.statusText})${body ? `\n${body}` : ""}`,
    );
  }

  if (canUseResponseCache) {
    await setStoredResponse(url, res, method);
  }

  return res;
}

export function addExtension(path: string, ext: string): string {
  if (!path.endsWith(ext)) {
    renameSync(path, path + ext);
    return path + ext;
  }

  return path;
}

export function getPlatform(): string {
  const platform = process.platform;
  if ("win32" === platform) return "windows";

  return platform;
}

export function hasNativeWindowsArm64(version?: string): boolean {
  if (!version) return false;
  const cleaned = version.replace(/^bun-v/, "");
  // Non-semver versions like "canary" represent latest builds which ship ARM64.
  if (!validate(cleaned)) return true;
  return compareVersions(cleaned, WINDOWS_ARM64_MIN_VERSION) >= 0;
}

export function getArchitecture(
  os: string,
  arch: string,
  version?: string,
): string {
  if (windows_arm(os, arch)) {
    if (!hasNativeWindowsArm64(version)) {
      warning(
        [
          "⚠️ This version of Bun does not provide native arm64 builds for Windows.",
          "Using x64 baseline build which will run through Microsoft's x64 emulation layer.",
          "This may result in reduced performance and potential compatibility issues.",
          "💡 For best performance, consider using Bun >= 1.3.10, x64 Windows runners, or other platforms with native support.",
        ].join("\n"),
      );

      return "x64";
    }
  }

  if ("arm64" === arch) return "aarch64";
  return arch;
}

export function getAvx2(
  os: string,
  arch: string,
  avx2?: boolean,
  version?: string,
): boolean {
  // Workaround for absence of arm64 builds on Windows before 1.3.10 (#130)
  if (windows_arm(os, arch)) {
    if (!hasNativeWindowsArm64(version)) {
      return false;
    }
    // Native ARM64 builds don't use AVX2 suffix
    return true;
  }

  // Check AVX2 support on x64 Linux
  if (os === "linux" && arch === "x64" && avx2 === undefined) {
    try {
      const cpuInfo = readFileSync("/proc/cpuinfo", "utf8");
      const hasAvx2 = cpuInfo.includes("avx2");
      return hasAvx2;
    } catch (error) {
      warning(`Failed to detect AVX2 support.`);
      return false;
    }
  }

  return avx2 ?? true;
}

const FILE_VERSION_READERS = {
  "package.json": (content: string) => {
    const pkg = JSON.parse(content);
    return pkg.packageManager?.split("bun@")?.[1] ?? pkg.engines?.bun;
  },
  ".tool-versions": (content: string) =>
    content.match(/^bun\s*(?<version>.*?)$/m)?.groups?.version,
  ".bumrc": (content: string) => content, // https://github.com/owenizedd/bum
  ".bun-version": (content: string) => content,
};

export function readVersionFromFile(
  file: string,
  silent = false,
): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }

  if (!file) {
    return;
  }

  debug(`Reading version from ${file}`);

  const path = resolve(cwd, file);
  const base = basename(file);

  if (!existsSync(path)) {
    if (!silent) {
      warning(`File ${path} not found`);
    }
    return;
  }

  const reader = FILE_VERSION_READERS[base] ?? (() => undefined);

  let output: string | undefined;
  try {
    output = reader(readFileSync(path, "utf8"))?.trim();

    if (!output) {
      if (!silent) {
        warning(`Failed to read version from ${file}`);
      }
      return;
    }
  } catch (error) {
    const { message } = error as Error;
    if (!silent) {
      warning(`Failed to read ${file}: ${message}`);
    }
  } finally {
    if (output) {
      info(`Obtained version ${output} from ${file}`);
      return output;
    }
  }
}

export function isVersionMatch(
  existingRevision: string,
  requestedVersion?: string,
): boolean {
  // If no version specified, default is "latest" - don't match existing
  if (!requestedVersion) {
    return false;
  }

  // Non-pinned versions should never match existing installations
  if (/^(latest|canary|action)$/i.test(requestedVersion)) {
    return false;
  }

  const [existingVersion] = existingRevision.split("+");

  return (
    normalizeVersion(existingVersion) === normalizeVersion(requestedVersion)
  );
}

export async function extractBun(path: string): Promise<string> {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const { name } = entry;
    const entryPath = join(path, name);
    if (entry.isFile()) {
      if ("bun" === name || "bun.exe" === name) {
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

export async function getRevision(exe: string): Promise<string | undefined> {
  const revision = await getExecOutput(exe, ["--revision"], {
    ignoreReturnCode: true,
  });
  if (0 === revision.exitCode && /^\d+\.\d+\.\d+/.test(revision.stdout)) {
    return revision.stdout.trim();
  }
  const version = await getExecOutput(exe, ["--version"], {
    ignoreReturnCode: true,
  });
  if (0 === version.exitCode && /^\d+\.\d+\.\d+/.test(version.stdout)) {
    return version.stdout.trim();
  }
  return undefined;
}

/**
 * Returns the 'Last-Modified' Date only if it is valid and falls
 * between 'created' and now. Otherwise returns undefined.
 */
export function getValidatedLastModified(
  res: Response,
  created: Date,
): Date | undefined {
  const headerValue = res.headers.get("Last-Modified");
  if (!headerValue) return undefined;

  const mtime = new Date(headerValue);
  const mtimeNum = mtime.getTime();

  // 1. Check for 'Invalid Date' (NaN)
  // 2. Ensure it isn't before the 'created' bound
  // 3. Ensure it isn't in the future (server clock drift)
  const isValid =
    !isNaN(mtimeNum) && mtimeNum > created.getTime() && mtimeNum < Date.now();

  return isValid ? mtime : undefined;
}

/**
 * Returns the URL with query-string and fragment removed.
 * Safe to call on any string; returns the original on parse failure.
 */
export function stripUrlCredentials(url: string): string {
  try {
    const u = new URL(url);
    u.username = "";
    u.password = "";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}
