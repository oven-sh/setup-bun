import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  getInput,
  setOutput,
  setFailed,
  warning,
  getBooleanInput,
} from "@actions/core";
import runAction from "./action.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

function readVersionFromPackageJson(): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const path = join(cwd, "package.json");
  try {
    if (!existsSync(path)) {
      return;
    }
    const { packageManager } = JSON.parse(readFileSync(path, "utf8"));
    if (!packageManager?.includes("bun@")) {
      return;
    }
    const [_, version] = packageManager.split("bun@");
    return version;
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read package.json: ${message}`);
  }
}

function readVersionFromToolVersions(): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const path = join(cwd, ".tool-versions");
  try {
    if (!existsSync(path)) {
      return;
    }

    const match = readFileSync(path, "utf8").match(/^bun\s(?<version>.*?)$/m);

    return match?.groups?.version;
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read .tool-versions: ${message}`);
  }
}

runAction({
  version:
    getInput("bun-version") ||
    readVersionFromPackageJson() ||
    readVersionFromToolVersions() ||
    undefined,
  customUrl: getInput("bun-download-url") || undefined,
  registryUrl: getInput("registry-url") || undefined,
  scope: getInput("scope") || undefined,
  noCache: getBooleanInput("no-cache") || false,
})
  .then(({ version, revision, cacheHit }) => {
    setOutput("bun-version", version);
    setOutput("bun-revision", revision);
    setOutput("cache-hit", cacheHit);
    process.exit(0);
  })
  .catch((error) => {
    setFailed(error);
    process.exit(1);
  });
