# setup-bun

Download, install, and setup [Bun](https://bun.sh) in GitHub Actions.

## Usage

```yaml
- uses: oven-sh/setup-bun@v1.1
  with:
    bun-version: latest
```

### Setup custom registry-url and scope (for private packages)

```yaml
- uses: oven-sh/setup-bun@v1.1
  with:
    registry-url: "https://npm.pkg.github.com/"
    scope: "@foo-bar"
```

After setting up the registry-url and scope, when installing step comes, inject the env to authenticate and install all packages from the private registry

```yaml
- name: Installing dependencies
  env:
    BUN_AUTH_TOKEN: ${{ secrets.MY_SUPER_SECRET_PAT }}
  run: bun i
```

## Inputs

| Name           | Description                                        | Default     | Examples                        |
| -------------- | -------------------------------------------------- | ----------- | ------------------------------- |
| `bun-version`  | The version of Bun to download and install.        | `latest`    | `canary`, `1.0.0`, `<sha>`      |
| `registry-url` | Registry URL where some private package is stored. | `undefined` | `"https://npm.pkg.github.com/"` |
| `scope`        | Scope for private pacakages                        | `undefined` | `"@foo-bar"`, `"@orgname"`      |

## Outputs

| Name           | Description                                | Example                                          |
| -------------- | ------------------------------------------ | ------------------------------------------------ |
| `cache-hit`    | If the Bun executable was read from cache. | `true`                                           |
| `bun-version`  | The output from `bun --version`.           | `1.0.0`                                          |
| `bun-revision` | The output from `bun --revision`.          | `1.0.0+822a00c4d508b54f650933a73ca5f4a3af9a7983` |
