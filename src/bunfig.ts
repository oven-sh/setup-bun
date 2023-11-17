import { EOL } from "node:os";
import { appendFileSync } from "node:fs";
import { info } from "@actions/core";

type BunfigOptions = {
  registryUrl?: string;
  scope?: string;
};

export function createBunfig(options: BunfigOptions): string | null {
  const { registryUrl, scope } = options;

  let url: URL | undefined;
  if (registryUrl) {
    try {
      url = new URL(registryUrl);
    } catch {
      throw new Error(`Invalid registry-url: ${registryUrl}`);
    }
  }

  let owner: string | undefined;
  if (scope) {
    owner = scope.startsWith("@")
      ? scope.toLocaleLowerCase()
      : `@${scope.toLocaleLowerCase()}`;
  }

  if (url && owner) {
    return `[install.scopes]${EOL}'${owner}' = { token = "$BUN_AUTH_TOKEN", url = "${url}"}${EOL}`;
  }

  if (url && !owner) {
    return `[install]${EOL}registry = "${url}"${EOL}`;
  }

  return null;
}

export function writeBunfig(path: string, options: BunfigOptions): void {
  const bunfig = createBunfig(options);
  if (!bunfig) {
    return;
  }

  info(`Writing bunfig.toml to '${path}'.`);
  appendFileSync(path, bunfig, {
    encoding: "utf8",
  });
}
