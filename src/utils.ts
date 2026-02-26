import { debug, warning } from "@actions/core";
import { info } from "node:console";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { resolve, basename } from "node:path";

export function getCacheKey(url: string): string {
  return `bun-${createHash("sha1").update(url).digest("base64")}`;
}

export async function request(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "@oven-sh/setup-bun");
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch url ${url}. (status code: ${res.status}, status text: ${res.statusText})${body ? `\n${body}` : ""}`,
    );
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
  if (platform === "win32") return "windows";

  return platform;
}

export function getArchitecture(arch: string): string {
  if (arch === "arm64") return "aarch64";
  return arch;
}

export function getAvx2(arch: string, avx2?: boolean): boolean {
  // ARM64 architectures do not have a baseline version.
  if (arch === "aarch64" || arch === "arm64") {
    return true;
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
