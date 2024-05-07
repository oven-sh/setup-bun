import { debug, warning } from "@actions/core";
import { existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

export function retry<T>(
  fn: () => Promise<T>,
  retries: number,
  timeout = 10000
): Promise<T> {
  return fn().catch((err) => {
    if (retries <= 0) {
      throw err;
    }
    return new Promise((resolve) => setTimeout(resolve, timeout)).then(() =>
      retry(fn, retries - 1, timeout)
    );
  });
}

const FILE_VERSION_READERS = {
  "package.json": (content: string) =>
    JSON.parse(content).packageManager?.split("bun@")?.[1],
  ".tool-versions": (content: string) =>
    content.match(/^bun\s(?<version>.*?)$/m)?.groups?.version,
  ".bumrc": (content: string) => content,
};

export function readVersionFromFile(
  files: string | string[]
): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }

  if (!files) {
    warning("No version file specified, trying all known files.");
    return readVersionFromFile(Object.keys(FILE_VERSION_READERS));
  }

  if (!Array.isArray(files)) files = [files];

  for (const file of files) {
    debug(`Reading version from ${file}`);

    const path = join(cwd, file);
    const base = basename(file);

    if (!existsSync(path)) {
      warning(`File ${path} not found`);
      continue;
    }

    const reader = FILE_VERSION_READERS[base] ?? (() => undefined);

    let output: string | undefined;
    try {
      output = reader(readFileSync(path, "utf8"));
    } catch (error) {
      const { message } = error as Error;
      warning(`Failed to read ${file}: ${message}`);
    } finally {
      if (output) {
        debug(`Found version ${output}`);
        return output;
      }
    }
  }
}
