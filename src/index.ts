import { tmpdir } from "node:os";
import { getInput, setOutput, setFailed, getBooleanInput } from "@actions/core";
import runAction from "./action.js";
import { readVersionFromFile } from "./utils.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

runAction({
  version:
    getInput("bun-version") ||
    readVersionFromFile(getInput("bun-version-file")) ||
    undefined,
  customUrl: getInput("bun-download-url") || undefined,
  registryUrl: getInput("registry-url") || undefined,
  scope: getInput("scope") || undefined,
  noCache: getBooleanInput("no-cache") || false,
})
  .then(({ version, revision, bunPath, url, cacheHit }) => {
    setOutput("bun-version", version);
    setOutput("bun-revision", revision);
    setOutput("bun-path", bunPath);
    setOutput("bun-download-url", url);
    setOutput("cache-hit", cacheHit);
    process.exit(0);
  })
  .catch((error) => {
    setFailed(error);
    process.exit(1);
  });
