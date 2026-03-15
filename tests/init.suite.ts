import { join } from "node:path";
import { tmpdir } from "node:os";

const previousEnvVars = { ...process.env };

// This is a side-effect only file
process.env["RUNNER_TEMP"] = join(tmpdir(), "setup-bun-integration-test");
