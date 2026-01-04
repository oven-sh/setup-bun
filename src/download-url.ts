import { compareVersions, satisfies, validate } from "compare-versions";
import { Input } from "./action";
import { getArchitecture, getPlatform, request } from "./utils";

export interface DownloadMeta {
  url: string;
  auth?: string;
}

export async function getDownloadMeta(options: Input): Promise<DownloadMeta> {
  const { customUrl } = options;
  if (customUrl) {
    return {
      url: customUrl,
    };
  }

  if (options.version && /^[0-9a-f]{40}$/i.test(options.version)) {
    return await getShaDownloadMeta(options);
  }

  return await getSemverDownloadMeta(options);
}

interface Run {
  id: string;
  head_sha: string;
}

interface Runs {
  workflow_runs: Run[];
}

async function getShaDownloadMeta(options: Input): Promise<DownloadMeta> {
  let res: Runs;
  let page = 1;
  let run: Run | undefined;
  while (
    (res = (await (
      await request(
        `https://api.github.com/repos/oven-sh/bun/actions/workflows/ci.yml/runs?per_page=100&page=${page}`,
        {
          headers: options.token
            ? { "Authorization": `Bearer ${options.token}` }
            : {},
        },
      )
    ).json()) as Runs)
  ) {
    if (res.workflow_runs.length === 0) {
      break;
    }

    run = res.workflow_runs.find((item) => item.head_sha === options.version);
    if (run) break;

    page++;
  }

  if (!run) {
    throw new Error(`Failed to find workflow run for SHA '${options.version}'`);
  }

  const artifacts = (await (
    await request(
      `https://api.github.com/repos/oven-sh/bun/actions/runs/${run.id}/artifacts`,
      {
        headers: options.token
          ? { "Authorization": `Bearer ${options.token}` }
          : {},
      },
    )
  ).json()) as { artifacts: { name: string; archive_download_url: string }[] };

  const { os, arch, avx2, profile, token } = options;

  const name = `bun-${os ?? getPlatform()}-${arch ?? getArchitecture()}${
    avx2 ? "" : "-baseline"
  }${profile ? "-profile" : ""}`;

  const artifact = artifacts.artifacts.find((item) => item.name === name);
  if (!artifact) {
    throw new Error(`Failed to find artifact '${name}' in run '${run.id}'`);
  }

  return {
    url: artifact.archive_download_url,
    auth: token ? `Bearer ${token}` : undefined,
  };
}

async function getSemverDownloadMeta(options: Input): Promise<DownloadMeta> {
  const res = (await (
    await request("https://api.github.com/repos/oven-sh/bun/git/refs/tags", {
      headers: options.token
        ? { "Authorization": `Bearer ${options.token}` }
        : {},
    })
  ).json()) as { ref: string }[];
  let tags = res
    .filter(
      (tag) =>
        tag.ref.startsWith("refs/tags/bun-v") || tag.ref === "refs/tags/canary",
    )
    .map((item) => item.ref.replace(/refs\/tags\/(bun-v)?/g, ""));

  const { version, os, arch, avx2, profile } = options;

  let tag = tags.find((t) => t === version);
  if (!tag) {
    tags = tags.filter((t) => validate(t)).sort(compareVersions);

    const matchedTag =
      version === "latest"
        ? tags.at(-1)
        : tags.filter((t) => satisfies(t, version)).at(-1);

    if (!matchedTag) {
      throw new Error(`No Bun release found matching version '${version}'`);
    }

    tag = `bun-v${matchedTag}`;
  } else if (validate(tag)) {
    tag = `bun-v${tag}`;
  }

  const eversion = encodeURIComponent(tag ?? version);
  const eos = encodeURIComponent(os ?? getPlatform());
  const earch = encodeURIComponent(arch ?? getArchitecture());
  const eavx2 = encodeURIComponent(avx2 ? "" : "-baseline");
  const eprofile = encodeURIComponent(profile ? "-profile" : "");

  const { href } = new URL(
    `${eversion}/bun-${eos}-${earch}${eavx2}${eprofile}.zip`,
    "https://github.com/oven-sh/bun/releases/download/",
  );

  return {
    url: href,
  };
}
