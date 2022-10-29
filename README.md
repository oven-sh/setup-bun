# setup-bun
> Huge inspiration [setup-deno](https://github.com/denoland/setup-deno)

Set up your GitHub Actions workflow with a specific version of Bun.

## Usage

### Latest stable

```yaml
- uses: xhyrom/setup-bun@v0.1.8
  with:
    bun-version: latest
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Specific version

```yaml
- uses: xhyrom/setup-bun@v0.1.8
  with:
    bun-version: "0.1.5"
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Canary builds

```yaml
- uses: xhyrom/setup-bun@v0.1.8
  with:
    bun-version: canary
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom repository

```yaml
- uses: xhyrom/setup-bun@v0.1.8
  with:
    repository: https://github.com/oven-sh/misc-test-builds
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Custom download url

```yaml
- uses: xhyrom/setup-bun@v0.1.8
  with:
    custom-download-url: https://api.github.com/repos/oven-sh/bun/actions/artifacts/311939881/zip # must be github api
    github-token: ${{ secrets.GITHUB_TOKEN }}
```