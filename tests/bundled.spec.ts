import { describe } from "bun:test";

import { register as registerAtomicTests } from "./atomic-write.test";
import { register as registerFilesystemTests } from "./filesystem-cache.test";
import { register as registerResponseTests } from "./response-storage.test";

describe("bundled", () => {
  describe("src/atomic-write.ts", registerAtomicTests);
  describe("src/filesystem-cache.ts", registerFilesystemTests);
  describe("src/response-storage.ts", registerResponseTests);
});
