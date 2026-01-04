# setup-bun

Download, install, and setup [Bun](https://bun.sh) in GitHub Actions.

## Usage

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest
```

## Using version file

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version-file: ".bun-version"
```

## Using custom registries

You can configure multiple package registries using the `registries` input. This supports both default and scoped registries with various authentication methods.

### Registry configuration

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    registries: |
      https://registry.npmjs.org/
      @myorg:https://npm.pkg.github.com/|$GITHUB_TOKEN
      @internal:https://username:$INTERNAL_PASSWORD@registry.internal.com/

- name: Install dependencies
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    INTERNAL_PASSWORD: ${{ secrets.INTERNAL_PASSWORD }}
  run: bun install
```

#### Registry format options

| Type                                 | Format                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| Default registry                     | `https://registry.example.com/`                           |
| Default registry with token          | `https://registry.example.com/\|$TOKEN`                   |
| Scoped registry                      | `@scope:https://registry.example.com/`                    |
| Scoped registry with token           | `@scope:https://registry.example.com/\|$TOKEN`            |
| Scoped registry with URL credentials | `@scope:https://username:$PASSWORD@registry.example.com/` |

> [!IMPORTANT]
> When using authentication, make sure to set the corresponding environment variables in your workflow steps that need access to the registries.

For more information about configuring registries in Bun, see the [official documentation](https://bun.sh/docs/install/registries).

### Override download url

If you need to override the download URL, you can use the `bun-download-url` input.

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-download-url: "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip"
```

## Inputs

| Name               | Description                                                                       | Default               | Examples                                         |
| ------------------ | --------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `bun-version`      | The version of Bun to download and install.                                       | `latest`              | `canary`, `1.0.0`, `1.0.x`                       |
| `bun-version-file` | The version of Bun to download and install from file.                             | `undefined`           | `package.json`, `.bun-version`, `.tool-versions` |
| `bun-download-url` | URL to download .zip file for Bun release                                         |                       |                                                  |
| `registry-url`     | Registry URL where some private package is stored.                                | `undefined`           | `"https://npm.pkg.github.com/"`                  |
| `scope`            | Scope for private packages.                                                       | `undefined`           | `"@foo"`, `"@orgname"`                           |
| `no-cache`         | Disable caching of the downloaded executable.                                     | `false`               | `true`, `false`                                  |
| `token`            | Personal access token (PAT) used to fetch tags from the `oven-sh/bun` repository. | `${{ github.token }}` | `${{ secrets.GITHUB_TOKEN }}`                    |

## Outputs

| Name               | Description                                | Example                                                            |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| `bun-version`      | The output from `bun --version`.           | `1.0.0`                                                            |
| `bun-revision`     | The output from `bun --revision`.          | `1.0.0+822a00c4`                                                   |
| `bun-path`         | The path to the Bun executable.            | `/path/to/bun`                                                     |
| `bun-download-url` | The URL from which Bun was downloaded.     | `https://bun.sh/download/latest/linux/x64?avx2=true&profile=false` |
| `cache-hit`        | If the Bun executable was read from cache. | `true`                                                             |
