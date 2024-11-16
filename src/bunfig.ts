import { EOL } from "node:os";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { info } from "@actions/core";

export type Registry = {
  url: string;
  scope: string;
  token: string;
};

enum FieldType {
  GLOBAL_REGISTRY,
  INSTALL_WITH_SCOPE,
}

type Field = {
  type: FieldType;
  value: string;
};

export function createField(registry: Registry): Field {
  const { url: registryUrl, scope, token } = registry;

  let url: URL | undefined;
  if (registryUrl) {
    try {
      url = new URL(registryUrl);
    } catch {
      throw new Error(`Invalid registry url ${registryUrl}`);
    }
  }

  let owner: string | undefined;
  if (scope) {
    owner = scope.startsWith("@")
      ? scope.toLocaleLowerCase()
      : `@${scope.toLocaleLowerCase()}`;
  }

  if (url && owner) {
    return {
      type: FieldType.INSTALL_WITH_SCOPE,
      value: `'${owner}' = { token = "${token}", url = "${url}" }`,
    };
  }

  if (url && !owner) {
    return {
      type: FieldType.GLOBAL_REGISTRY,
      value: `registry = "${url}"`,
    };
  }

  return null;
}

export function createBunfig(registries: Registry[]): Field[] | null {
  const fields = registries.map(createField).filter((field) => field);
  if (fields.length === 0) {
    return null;
  }

  if (
    fields.filter((field) => field.type === FieldType.GLOBAL_REGISTRY).length >
    1
  ) {
    throw new Error("You can't have more than one global registry.");
  }

  return fields;
}

export function serializeInstallScopes(
  fields: Field[],
  header: boolean = false
): string {
  const installScopes = fields
    .filter((field) => field.type === FieldType.INSTALL_WITH_SCOPE)
    .map((field) => field.value)
    .join(EOL);

  if (!installScopes) {
    return "";
  }

  return `${header ? `[install.scopes]${EOL}` : ""}${installScopes}${EOL}`;
}

export function serializeGlobalRegistry(
  fields: Field[],
  header: boolean = false
): string {
  const globalRegistry = fields
    .filter((field) => field.type === FieldType.GLOBAL_REGISTRY)
    .map((field) => field.value)
    .join(EOL);

  if (!globalRegistry) {
    return "";
  }

  return `${header ? `[install]${EOL}` : ""}${globalRegistry}${EOL}`;
}

export function writeBunfig(path: string, registries: Registry[]): void {
  const bunfig = createBunfig(registries);
  if (!bunfig) {
    return;
  }

  info(`Writing bunfig.toml to '${path}'.`);

  if (!existsSync(path)) {
    writeFileSync(
      path,
      `${serializeGlobalRegistry(bunfig, true)}${serializeInstallScopes(
        bunfig,
        true
      )}`,
      {
        encoding: "utf8",
      }
    );

    return;
  }

  let newContent = "";
  const contents = readFileSync(path, {
    encoding: "utf-8",
  }).split(EOL);

  contents.forEach((line, index, array) => {
    if (index > 0 && array[index - 1].includes("[install.scopes]")) {
      newContent += serializeInstallScopes(bunfig);
    }

    if (index > 0 && array[index - 1].includes("[install]")) {
      newContent += serializeGlobalRegistry(bunfig);
    }

    if (
      line.startsWith("registry = ") ||
      !bunfig.some(
        (field) =>
          field.type === FieldType.INSTALL_WITH_SCOPE &&
          (line.startsWith(field.value.split(" ")[0]) ||
            ((line[0] === "'" || line[0] === '"') &&
              line
                .toLowerCase()
                .startsWith(field.value.split(" ")[0].slice(1).slice(0, -1))))
      )
    ) {
      newContent += line + EOL;
    }
  });

  if (!contents.includes("[install.scopes]")) {
    newContent += serializeInstallScopes(bunfig, true);
  }

  if (!contents.includes("[install]")) {
    newContent += serializeGlobalRegistry(bunfig, true);
  }

  writeFileSync(path, newContent, {
    encoding: "utf8",
  });
}
