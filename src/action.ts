import { tmpdir } from "node:os";
import * as action from "@actions/core";
import setup from "./setup.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

function parseBoolean(value: string): boolean {
  return /^true$/i.test(value);
}

setup({
  customUrl: action.getInput("bun-download-url") || undefined,
  checkLatest: parseBoolean(action.getInput("check-latest")),
  version: action.getInput("bun-version") || "latest",
  os: process.platform,
  arch: process.arch,
  baseline: parseBoolean(action.getInput("baseline")),
  profile: parseBoolean(action.getInput("profile")),
})
  .then(({ version, cacheHit }) => {
    action.setOutput("bun-version", version);
    action.setOutput("cache-hit", cacheHit);
  })
  .catch((error) => {
    action.setFailed(error);
  });
