import { tmpdir } from "node:os";
import { getInput, setOutput, setFailed, getBooleanInput } from "@actions/core";
import runAction from "./action.js";
import { readVersionFromFile } from "./utils.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

const registries = JSON.parse(getInput("registries") || "[]");
const registryUrl = getInput("registry-url");
const scope = getInput("scope");

if (registries.length > 0 && (registryUrl || scope)) {
  setFailed("Cannot specify both 'registries' and 'registry-url' or 'scope'.");
  process.exit(1);
}

if (registryUrl) {
  registries.push({
    url: registryUrl,
    scope: scope,
    token: "$$BUN_AUTH_TOKEN",
  });
}

runAction({
  version:
    getInput("bun-version") ||
    readVersionFromFile(getInput("bun-version-file")) ||
    undefined,
  customUrl: getInput("bun-download-url") || undefined,
  registries: registries.length > 0 ? registries : undefined,
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
