import { statSync, openSync, readSync, closeSync } from "node:fs";
import { createHash } from "node:crypto";

const BINARY_PARTIAL_SIZE = 1024 * 256; // KiB

export function quickFingerprint(filePath: string): string {
  const { size, mtimeMs, ino } = statSync(filePath);

  const headBuf = Buffer.alloc(BINARY_PARTIAL_SIZE);
  const tailBuf = Buffer.alloc(BINARY_PARTIAL_SIZE);

  const fd = openSync(filePath, "r");
  let headRead: number;
  let tailRead: number;
  try {
    headRead = readSync(fd, headBuf, 0, BINARY_PARTIAL_SIZE, 0);
    const tailOffset = Math.max(0, size - BINARY_PARTIAL_SIZE);
    tailRead = readSync(fd, tailBuf, 0, BINARY_PARTIAL_SIZE, tailOffset);
  } finally {
    closeSync(fd);
  }

  const headHash = createHash("sha512")
    .update(headBuf.subarray(0, headRead))
    .digest("hex");
  const tailHash = createHash("sha512")
    .update(tailBuf.subarray(0, tailRead))
    .digest("hex");

  const combined =
    `size:${size}|mtimeMs:${mtimeMs}|ino:${ino}` +
    `|head:${headHash}|tail:${tailHash}`;

  return "sha512:" + createHash("sha512").update(combined).digest("hex");
}
