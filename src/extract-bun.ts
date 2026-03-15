import { readdirSync } from "node:fs";
import { join } from "node:path";

import { extractZip } from "@actions/tool-cache";

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
        try {
          return await extractBun(extractedPath);
        } catch {
          // keep searching sibling entries
        }
      }
    }
    if (/^bun/.test(name) && entry.isDirectory()) {
      try {
        return await extractBun(entryPath);
      } catch {
        // keep searching sibling entries
      }
    }
  }
  throw new Error("Could not find executable: bun");
}
