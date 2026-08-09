# A2A Net SDKs

JavaScript and TypeScript SDKs for [A2A Net](https://a2anet.com).

This repository is a [Bun](https://bun.sh/) workspace. It is set up to publish the React SDK,
while leaving room for other JavaScript framework packages.

## Packages

| Package | Description |
| --- | --- |
| [`@a2anet/react`](./packages/react) | React SDK for A2A Net |

Framework-neutral code should remain in the package that needs it until another package has
a concrete reason to share it. At that point, it can be extracted into `packages/core`.

SDKs for other languages should live in their own repositories so they can follow their
ecosystems' packaging and release conventions independently.

## Development

Install [Bun](https://bun.sh/) and then run:

```bash
make install
make install-hooks
make ci
```

Run `make fix` to apply safe formatting and lint fixes.

## Releases

This repository uses [Release Please](https://github.com/googleapis/release-please) and
[Conventional Commits](https://www.conventionalcommits.org/) to version each package
independently.

The npm package must exist before Trusted Publishing can be configured. For the first release:

1. Build the package with `make build`.
2. Run `npm publish --access public` from `packages/react` to publish version `0.0.0`.
3. Configure `release-please.yml` as the package's trusted publisher on npm.
4. Create an `npm` environment in the GitHub repository.

Subsequent releases are published automatically when their Release Please pull requests are
merged.
