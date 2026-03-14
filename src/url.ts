import { URL } from "node:url";

type Protocol = "http" | "https";
const DEFAULT_PORTS: Record<Protocol, string> = { http: "80", https: "443" };

export function buildUrl(
  hostname: string,
  pathname: string,
  protocol: Protocol = "https",
  port?: string | number,
  params?: Record<string, string>,
): string {
  const url = new URL(`${protocol}://${hostname}`);
  url.port = port?.toString() || DEFAULT_PORTS[protocol];
  url.pathname = `/${pathname.replace(/^\/+/, "")}`;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.href;
}

export function gitHubAssetDownloadUrl(
  owner: string,
  repo: string,
  tag: string,
  asset: string,
): string {
  const rawOpts: string[] = [owner, repo, "releases", "download", tag, asset];
  const encoded = rawOpts.map(encodeURIComponent);
  return buildUrl("github.com", encoded.join("/"), "https");
}

export function isGitHub(url: string, api: boolean = false): boolean {
  const parsedUrl = new URL(url);
  if (api) {
    return "api.github.com" === parsedUrl.hostname;
  }

  return "github.com" === parsedUrl.hostname;
}

export const getVksUrl = (host: string, fp: string) =>
  buildUrl(
    host,
    `/vks/v1/by-fingerprint/${fp.replace(/\s/g, "").toUpperCase()}`,
  );

export const getHkpUrl = (host: string, fp: string, port?: number) =>
  buildUrl(host, "/pks/lookup", port === 11371 ? "http" : "https", port, {
    op: "get",
    options: "mr",
    search: `0x${fp.replace(/\s/g, "").toLowerCase()}`,
  });

export const getGitHubGpgUrl = (user: string) =>
  buildUrl("github.com", `/${user.replace(/^@/, "")}.gpg`);
