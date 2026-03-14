// tests/bundled.suite.ts
import "./init.suite";

import { register as registerAtomicTests } from "./atomic-write.test";
import { register as registerFilesystemTests } from "./filesystem-cache.test";

// Register all sub-suites
registerAtomicTests();
registerFilesystemTests();
