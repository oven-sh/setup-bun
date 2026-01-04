import { debug, warning } from "@actions/core";
import { info } from "node:console";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { resolve, basename } from "node:path";

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

export function getArchitecture(): string {
  const arch = process.arch;
  if (arch === "arm64") return "aarch64";

  return arch;
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

export function readVersionFromFile(file: string): string | undefined {
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
    warning(`File ${path} not found`);
    return;
  }

  const reader = FILE_VERSION_READERS[base] ?? (() => undefined);

  let output: string | undefined;
  try {
    output = reader(readFileSync(path, "utf8"))?.trim();

    if (!output) {
      warning(`Failed to read version from ${file}`);
      return;
    }
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read ${file}: ${message}`);
  } finally {
    if (output) {
      info(`Obtained version ${output} from ${file}`);
      return output;
    }
  }
}
