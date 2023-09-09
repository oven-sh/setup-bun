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

  let newContents = "";

  if (existsSync(fileLocation)) {
    const curContents = readFileSync(fileLocation, "utf8");

    curContents.split(EOL).forEach((line: string) => {
      // Add current contents unless they are setting the registry
      if (!line.toLowerCase().startsWith(scope)) {
        newContents += line + EOL;
      }
    });

    newContents += EOL;
  }

  const bunRegistryString = `'${scope}' = { token = "$BUN_AUTH_TOKEN", url = "${registryUrl}"}`;

  newContents += `[install.scopes]${EOL}${EOL}${bunRegistryString}${EOL}`;

  writeFileSync("./bunfig.toml", newContents);
}
