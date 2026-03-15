import { randomBytes } from "node:crypto";
import { renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { WriteFileOptions } from "node:fs";
import { basename } from "node:path";
import { debug } from "@actions/core";

/**
 * Generates an 8-character base36 string from 6 random bytes.
 * 6 bytes (48 bits) ensures we have enough entropy to fill 8 characters.
 */
const getTempExt = () => {
  const bytes = randomBytes(6);
  // Convert Buffer to a BigInt, then to base36
  const id = BigInt(`0x${bytes.toString("hex")}`).toString(36);
  return `.${id.slice(0, 8)}.tmp`;
};

function writeDebug(operation: string, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  debug(`atomic-write: ${operation} failed for key "${key}": ${message}`);
}

export function atomicWriteFileSync(
  path: string,
  value: string | Buffer | DataView,
  options?: string | Omit<Extract<WriteFileOptions, object>, "flag" | "flush">,
): void {
  const normalizedOpts =
    "string" === typeof options ? { encoding: options } : (options ?? {});
  const optObj: WriteFileOptions = {
    ...normalizedOpts,
    encoding: normalizedOpts?.encoding ?? "utf8",
    flag: "wx",
    flush: true,
    mode: normalizedOpts?.mode ?? 0o666,
  };
  const tmpPath = `${path}${getTempExt()}`;
  const tmpFilename = basename(tmpPath);

  try {
    const mode = 0o777 & statSync(path).mode;
    if (mode) {
      optObj.mode = mode;
    }
  } catch {
    // destination may not exist yet
  }

  try {
    writeFileSync(tmpPath, value, optObj);
    renameSync(tmpPath, path);
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && "EEXIST" === error.code)
    ) {
      try {
        rmSync(tmpPath, { force: true });
      } catch (e) {
        writeDebug("cleanup", tmpFilename, e);
      }
    }
    throw error;
  }
}
