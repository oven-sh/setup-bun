# setup-bun

Download, install, and setup [Bun](https://bun.sh) in GitHub Actions.

## Usage

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest
```

### Using a custom NPM registry

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    registry-url: "https://npm.pkg.github.com/"
    scope: "@foo"
```

If you need to authenticate with a private registry, you can set the `BUN_AUTH_TOKEN` environment variable.

```yaml
- name: Install Dependencies
  env:
    BUN_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  run: bun install --frozen-lockfile
```

### Node.js not needed

In most cases, you shouldn't need to use the [setup-node](https://github.com/actions/setup-node) GitHub Action.

## Inputs

| Name           | Description                                        | Default     | Examples                        |
| -------------- | -------------------------------------------------- | ----------- | ------------------------------- |
| `bun-version`  | The version of Bun to download and install.        | `latest`    | `canary`, `1.0.0`, `1.0.x`      |
| `registry-url` | Registry URL where some private package is stored. | `undefined` | `"https://npm.pkg.github.com/"` |
| `scope`        | Scope for private packages.                        | `undefined` | `"@foo"`, `"@orgname"`          |
| `no-cache`     | Disable caching of the downloaded executable.      | `false`     | `true`, `false`                 |

## Outputs

| Name           | Description                                | Example          |
| -------------- | ------------------------------------------ | ---------------- |
| `cache-hit`    | If the Bun executable was read from cache. | `true`           |
| `bun-version`  | The output from `bun --version`.           | `1.0.0`          |
| `bun-revision` | The output from `bun --revision`.          | `1.0.0+822a00c4` |
