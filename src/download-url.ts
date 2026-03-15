import {
  compareVersions,
  satisfies,
  validate,
  validateStrict,
} from "compare-versions";
import { Input } from "./action";
import { addGitHubApiHeaders } from "./github-api";
import { buildUrl, gitHubAssetDownloadUrl } from "./url";
import { getArchitecture, getAvx2, getPlatform, request } from "./utils";

export async function getDownloadUrl(options: Input): Promise<string> {
  const { customUrl } = options;
  if (customUrl) {
    return customUrl;
  }

  return await getSemverDownloadUrl(options);
}

async function getSemverDownloadUrl(options: Input): Promise<string> {
  const { version, os, arch, avx2, profile } = options;
  let tag: string | undefined;

  if (validateStrict(version)) {
    tag = `bun-v${version}`;
  }

  if (!tag) {
    const apiUrl = buildUrl(
      "api.github.com",
      "repos/oven-sh/bun/git/refs/tags",
      "https",
    );
    const headers = addGitHubApiHeaders(apiUrl, {}, options.token);
    const res = (await (
      await request(apiUrl, { headers: headers })
    ).json()) as { ref: string }[];

    let tags = res
      .filter(
        (tag) =>
          tag.ref.startsWith("refs/tags/bun-v") ||
          tag.ref === "refs/tags/canary",
      )
      .map((item) => item.ref.replace(/refs\/tags\/(bun-v)?/g, ""))
      .filter(Boolean);

    tag = tags.find((t) => t === version);
    if (!tag) {
      tags = tags.filter((t) => validate(t)).sort(compareVersions);

      const matchedTag =
        version === "latest" || !version
          ? tags.at(-1)
          : tags.filter((t) => satisfies(t, version)).at(-1);

      if (!matchedTag) {
        throw new Error(`No Bun release found matching version '${version}'`);
      }

      tag = `bun-v${matchedTag}`;
    } else if (validate(tag)) {
      tag = `bun-v${tag}`;
    }
  }

  const resolvedTag = tag ?? version;
  const inputArch = arch ?? process.arch;
  const resolvedOs = os ?? getPlatform();
  const resolvedArch = getArchitecture(resolvedOs, inputArch, resolvedTag);
  const isAvx2 = getAvx2(resolvedOs, inputArch, avx2, resolvedTag);
  const assetParts: string[] = [
    "bun",
    resolvedOs,
    resolvedArch,
    isAvx2 ? "" : "baseline",
    profile ? "profile" : "",
  ];
  const assetName = assetParts.filter((p) => "" !== p).join("-") + ".zip";
  return gitHubAssetDownloadUrl("oven-sh", "bun", resolvedTag, assetName);
}
