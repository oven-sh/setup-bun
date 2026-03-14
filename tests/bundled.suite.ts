// tests/bundled.suite.ts
import { register as registerAtomicTests } from "./atomic-write.test";
// import { register as registerChecksumTests } from "./checksum.test";

// Register all sub-suites
registerAtomicTests();
// registerChecksumTests();
