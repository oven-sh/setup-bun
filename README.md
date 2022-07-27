# setup-bun
> Huge inspiration [setup-deno](https://github.com/denoland/setup-deno)

Set up your GitHub Actions workflow with a specific version of Bun.

## Usage

### Latest stable

```yaml
- uses: xhyrom/setup-bun@v0.1.6
  with:
    bun-version: latest
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Specific version

```yaml
- uses: xhyrom/setup-bun@v0.1.6
  with:
    bun-version: "0.1.5"
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Canary builds

```yaml
- uses: xhyrom/setup-bun@v0.1.6
  with:
    bun-version: canary
    github-token: ${{ secrets.GITHUB_TOKEN }}
```
