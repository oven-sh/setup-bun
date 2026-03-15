import { renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { debug, error, info, warning } from "@actions/core";
import type { AnnotationProperties } from "@actions/core";
import { downloadTool, extractZip } from "@actions/tool-cache";

import { extractBun } from "./extract-bun";
import { addExtension, getCacheKey } from "./utils";
import { verifyAsset } from "./verify";

// This type covers info, debug, notice, warning, and error
type Logger =
  | ((message: string | Error) => void)
  | ((message: string | Error, properties?: AnnotationProperties) => void);

function downloadLog(
  f: Logger,
  preface: string,
  error: unknown,
  prefix: string = "download-bun",
): void {
  if (error instanceof Error) {
    // Create a new Error so the original isn't mutated
    const derived = new Error(`${prefix}: ${preface}: ${error.message}`, {
      cause: error,
    });
    derived.stack = error.stack;
    f(derived);
  } else {
    f(`${prefix}: ${preface}: ${String(error)}`);
  }
}

export async function downloadBun(
  url: string,
  bunPath: string,
  token?: string,
): Promise<{ binPath: string; checksum: string; url: string }> {
  const extracted: { zipPath?: string; bunPath?: string } = {};

  // Workaround for https://github.com/oven-sh/setup-bun/issues/79 and https://github.com/actions/toolkit/issues/1179
  const zipPath = addExtension(await downloadTool(url), ".zip");

  // INTEGRITY CHECK: Verify the download before extraction.
  // This checks the Local Hash, GitHub Asset Digest, and the robobun PGP Signature.
  const checksum = await verifyAsset(zipPath, url, token);

  // Temporarily set RUNNER_TEMP to a directory next to bunPath
  // This allows for rename to work for atomic replacement
  const parentDir = resolve(dirname(bunPath));
  const temporaryDir = join(
    parentDir,
    `${getCacheKey(url).replace(/[^A-Za-z0-9-]/g, "")}.tmp`,
  );
  const savedRunnerTemp = process.env["RUNNER_TEMP"] || "";

  try {
    process.env["RUNNER_TEMP"] = temporaryDir;

    try {
      extracted.zipPath = await extractZip(zipPath);
    } catch (err) {
      downloadLog(
        error,
        `could not unzip: ${basename(zipPath)}`,
        err,
        "downloadBun",
      );
      throw err;
    }

    try {
      extracted.bunPath = await extractBun(extracted.zipPath!);
    } catch (err) {
      downloadLog(
        error,
        `could not extract bun from: ${extracted.zipPath}`,
        err,
        "downloadBun",
      );
      throw err;
    }

    try {
      renameSync(extracted.bunPath!, bunPath);
    } catch (err) {
      downloadLog(
        error,
        `could not rename: ${extracted.bunPath} => ${bunPath}`,
        err,
        "downloadBun",
      );
      throw err;
    }
  } finally {
    // Restore RUNNER_TEMP to the previous value
    process.env["RUNNER_TEMP"] = savedRunnerTemp;

    // Clean up the extracted files
    try {
      rmSync(temporaryDir, { force: true, recursive: true });
    } catch (err) {
      downloadLog(
        warning,
        `failed to remove: ${basename(temporaryDir)}`,
        err,
        "downloadBun",
      );
    }
  }

  return {
    binPath: bunPath,
    checksum: checksum,
    url: url,
  };
}
