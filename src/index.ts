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

function readVersionFromPackageJson(file: string): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const path = join(cwd, file);
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
    warning(`Failed to read ${file}: ${message}`);
  }
}

function readVersionFromToolVersions(file: string): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const path = join(cwd, file);
  try {
    if (!existsSync(path)) {
      return;
    }

    const match = readFileSync(path, "utf8").match(/^bun\s(?<version>.*?)$/m);

    return match?.groups?.version;
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read ${file}: ${message}`);
  }
}

function readVersionFromBumrc(file: string): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const path = join(cwd, file);
  try {
    if (!existsSync(path)) {
      return;
    }

    const match = readFileSync(path, "utf8");

    return JSON.parse(match);
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read ${file}: ${message}`);
  }
}

function readVersionFromFile(): string | undefined {
  const cwd = process.env.GITHUB_WORKSPACE;
  if (!cwd) {
    return;
  }
  const file = getInput("bun-version-file");
  const path = join(cwd, file);
  try {
    if (!existsSync(path)) {
      return;
    }

    if (file === "package.json") {
      return readVersionFromPackageJson(file)
    } else if (file === ".tool-versions") {
      return readVersionFromToolVersions(file)
    } else if (file === ".bumrc") {
      return readVersionFromBumrc(file)
    } else {
      warning(`Not allowed read version from ${file}`);
    }
  } catch (error) {
    const { message } = error as Error;
    warning(`Failed to read ${file}: ${message}`);
  }
}

runAction({
  version:
    getInput("bun-version") ||
    readVersionFromFile() ||
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
