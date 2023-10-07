import { tmpdir } from "node:os";
import * as action from "@actions/core";
import setup from "./setup.js";
import { existsSync, readFileSync } from "fs";
import * as path from "path";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

function readVersionFromPackageJson(): string | undefined {
  const { GITHUB_WORKSPACE } = process.env;
  if (!GITHUB_WORKSPACE) {
    return;
  }
  const pathToPackageJson = path.join(GITHUB_WORKSPACE, "package.json");
  if (!existsSync(pathToPackageJson)) {
    return;
  }
  const { packageManager } = JSON.parse(
    readFileSync(pathToPackageJson, "utf8")
  ) as { packageManager?: string };
  return packageManager?.split("bun@")[1];
}

setup({
  version:
    readVersionFromPackageJson() || action.getInput("bun-version") || undefined,
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
