import { EOL } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as core from "@actions/core";

export function configureAuthentication(registryUrl: string, scope: string) {
  const bunfigPath = resolve(process.cwd(), "bunfig.toml");

  if (!registryUrl.endsWith("/")) {
    registryUrl += "/";
  }

  writeRegistryToConfigFile({ registryUrl, fileLocation: bunfigPath, scope });
}

type WriteRegistryToConfigFile = {
  registryUrl: string;
  fileLocation: string;
  scope: string;
};

function writeRegistryToConfigFile({
  registryUrl,
  fileLocation,
  scope,
}: WriteRegistryToConfigFile) {
  if (scope && scope[0] !== "@") {
    scope = "@" + scope;
  }

  if (scope) {
    scope = scope.toLocaleLowerCase();
  }

  core.info(`Setting auth in ${fileLocation}`);

  const bunRegistryString = `'${scope}' = { token = "$BUN_AUTH_TOKEN", url = "${registryUrl}" }`;
  let newContents = "";

  if (existsSync(fileLocation)) {
    const curContents = readFileSync(fileLocation, "utf8");

    const contents = curContents.split(EOL);

    contents.forEach((line, index, array) => {
      // If last item is [install.scopes], than it should add the action scope + registry
      if (index > 0 && array[index - 1].includes('[install.scopes]')) {
        newContents += bunRegistryString + EOL;
      }

      // Only add the line if scope does not exists
      if (!line.toLowerCase().includes(scope)) {
        newContents += line + EOL;
      }
    });

    // In case bunfig.toml has other properties and does not have [install.scopes]
    if (!contents.includes('[install.scopes]')) {
      newContents += `[install.scopes]${EOL}${EOL}${bunRegistryString}${EOL}`
    }

    newContents += EOL;
  }

  if (!existsSync(fileLocation)) {
    newContents += `[install.scopes]${EOL}${EOL}${bunRegistryString}${EOL}`
  }

  writeFileSync("./bunfig.toml", newContents);
}
