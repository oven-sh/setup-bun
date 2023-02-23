# setup-bun

Download, install, and setup [Bun](https://bun.sh) in GitHub Actions.

## Usage

### Stable release

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest
```

### Specific release

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: "0.5.6"
```

### Canary release

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: canary
```

### Specific canary release

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: 9be68ac2350b965037f408ce4d47c3b9d9a76b63
```

### Custom Download URL

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-download-url: https://example.com/path/to/bun.zip
```
