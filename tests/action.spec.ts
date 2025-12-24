import { describe, expect, it, spyOn } from "bun:test";
import * as action from "../src/action";
import * as process from "node:process";
import * as semver from "semver";

function getAllVersions(): semver.SemVer[] {
  const stableList = [
    "1.3.1",
    "1.3.0",
    "1.2.23",
    "1.2.22",
    "1.2.21",
    "1.2.20",
    "1.2.19",
    "1.2.18",
    "1.2.17",
    "1.2.16",
    "1.2.15",
    "1.2.14",
    "1.2.13",
    "1.2.12",
    "1.2.11",
    "1.2.10",
    "1.2.9",
    "1.2.8",
    "1.2.7",
    "1.2.6",
    "1.2.5",
    "1.2.4",
    "1.2.3",
    "1.2.2",
    "1.2.1",
    "1.2.0",
    "1.1.45",
    "1.1.44",
    "1.1.43",
    "1.1.42",
    "1.1.41",
    "1.1.40",
    "1.1.39",
    "1.1.38",
    "1.1.37",
    "1.1.36",
    "1.1.35",
    "1.1.34",
    "1.1.33",
    "1.1.32",
    "1.1.31",
    "1.1.30",
    "1.1.29",
    "1.1.28",
    "1.1.27",
    "1.1.26",
    "1.1.25",
    "1.1.24",
    "1.1.22",
    "1.1.21",
    "1.1.20",
    "1.1.19",
    "1.1.18",
    "1.1.17",
    "1.1.16",
    "1.1.15",
    "1.1.14",
    "1.1.13",
    "1.1.12",
    "1.1.11",
    "1.1.10",
    "1.1.9",
    "1.1.8",
    "1.1.7",
    "1.1.6",
    "1.1.5",
    "1.1.4",
    "1.1.3",
    "1.1.2",
    "1.1.1",
    "1.1.0",
    "1.0.36",
    "1.0.35",
    "1.0.34",
    "1.0.33",
    "1.0.32",
    "1.0.31",
    "1.0.30",
    "1.0.29",
    "1.0.28",
    "1.0.27",
    "1.0.26",
    "1.0.25",
    "1.0.24",
    "1.0.23",
    "1.0.22",
    "1.0.21",
    "1.0.20",
    "1.0.19",
    "1.0.18",
    "1.0.17",
    "1.0.16",
    "1.0.15",
    "1.0.14",
    "1.0.13",
    "1.0.12",
    "1.0.11",
    "1.0.10",
    "1.0.9",
    "1.0.8",
    "1.0.7",
    "1.0.6",
    "1.0.5",
    "1.0.4",
    "1.0.3",
    "1.0.2",
    "1.0.1",
    "1.0.0",
    "0.8.1",
    "0.8.0",
    "0.7.3",
    "0.7.2",
    "0.7.1",
    "0.7.0",
    "0.6.14",
    "0.6.13",
    "0.6.12",
    "0.6.11",
    "0.6.10",
    "0.6.9",
    "0.6.8",
    "0.6.7",
    "0.6.6",
    "0.6.5",
    "0.6.4",
    "0.6.3",
    "0.6.2",
    "0.6.1",
    "0.6.0",
    "0.5.9",
    "0.5.8",
    "0.5.7",
    "0.5.6",
    "0.5.5",
    "0.5.4",
    "0.5.3",
    "0.5.2",
    "0.5.1",
    "0.5.0",
    "0.0.12",
    "0.0.11",
    "0.0.10",
    "0.0.9",
    "0.0.8",
    "0.0.7",
    "0.0.6",
    "0.0.5",
    "0.0.4",
    "0.0.3",
    "0.0.2",
    "0.0.1",
  ];
  const semverList = stableList
    .map((v) => semver.coerce(v))
    .filter((v): v is semver.SemVer => v !== null);
  return semverList;
}

function getOptions(version: string | null): action.Input {
  const options: action.Input = {
    version: version,
  };
  return options;
}

function expectSuccess(input: string | null, output: string) {
  it(`input ${input} - output ${output}`, async () => {
    const options = getOptions(input);
    const url = await action.getDownloadUrl(options);
    const expected = `https://bun.sh/download/${output}/${process.platform}/${process.arch}?avx2=true&profile=false`;
    expect(url).toBe(expected);
  });
}

function expectFailure(input: string) {
  it(`input ${input} - failure`, async () => {
    const options = getOptions(input);
    expect(action.getDownloadUrl(options)).rejects.toThrow(
      `Version "${input}" is not available`,
    );
  });
}

describe("action", () => {
  describe("getDownloadUrl", async () => {
    spyOn(action, "getAllVersions").mockResolvedValue(getAllVersions());

    expectSuccess("0", "0.8.1");
    expectSuccess("0.x", "0.8.1");

    expectSuccess("0.0", "0.0.12");
    expectSuccess("0.0.x", "0.0.12");

    expectSuccess("0.7", "0.7.3");
    expectSuccess("0.7.x", "0.7.3");
    expectFailure("0.7.4");

    expectSuccess("0.8", "0.8.1");
    expectSuccess("0.8.x", "0.8.1");

    expectFailure("0.9");

    expectSuccess("1", "1.3.1");
    expectSuccess("1.x", "1.3.1");

    expectSuccess("1.0", "1.0.36");
    expectSuccess("1.0.x", "1.0.36");

    expectSuccess("1.2", "1.2.23");
    expectSuccess("1.2.x", "1.2.23");

    expectSuccess("1.3", "1.3.1");
    expectSuccess("1.3.x", "1.3.1");

    expectFailure("1.4");

    expectFailure("2");

    expectSuccess("latest", "latest");
    expectSuccess("canary", "canary");
    expectSuccess("", "latest");
    expectSuccess(null, "latest");
    expectSuccess(undefined, "latest");
  });
});
