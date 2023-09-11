# setup-bun

Download, install, and setup [Bun](https://bun.sh) in GitHub Actions.

## Usage

```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest
```

## Inputs

| Name          | Description                                 | Default  | Examples                   |
| ------------- | ------------------------------------------- | -------- | -------------------------- |
| `bun-version` | The version of Bun to download and install. | `latest` | `canary`, `1.0.0`, `<sha>` |

## Outputs

| Name           | Description                                | Example                                          |
| -------------- | ------------------------------------------ | ------------------------------------------------ |
| `cache-hit`    | If the Bun executable was read from cache. | `true`                                           |
| `bun-version`  | The output from `bun --version`.           | `1.0.0`                                          |
| `bun-revision` | The output from `bun --revision`.          | `1.0.0+822a00c4d508b54f650933a73ca5f4a3af9a7983` |
