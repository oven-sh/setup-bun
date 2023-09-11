import { tmpdir } from "node:os";
import * as action from "@actions/core";
import setup from "./setup.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

setup({
  version: action.getInput("bun-version") || undefined,
  customUrl: action.getInput("bun-download-url") || undefined,
})
  .then(({ version, revision, cacheHit }) => {
    action.setOutput("bun-version", version);
    action.setOutput("bun-revision", revision);
    action.setOutput("cache-hit", cacheHit);
  })
  .catch((error) => {
    action.setFailed(error);
  });
