# Contributing to Breeze

Keep changes focused and describe the behavior being changed. Include reproduction steps for fixes and relevant validation in the pull request. Start branches from `main` and use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## Development

Use Node.js and pnpm versions specified in the root `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Load `extension/.output/chrome-mv3-dev` as an unpacked extension. WXT updates the development build as source files change.

## Validation

Run from the repository root:

```sh
pnpm run lint:fix
pnpm run typecheck
pnpm --filter extension exec vitest run
pnpm run build
pnpm run docs:build
pnpm --filter extension exec playwright install chromium
pnpm run test:e2e
```

E2E tests use the production build in an isolated Chromium profile. Do not use personal browser profiles or credentials in tests, screenshots, or fixtures.

## Local installation

To update a fixed unpacked extension directory, run:

```sh
pnpm build:local --target /path/to/loaded-extension
pnpm build:local
```

The target path stays in the ignored `.local-extension.json`. Reopen the popup after UI changes; reload the extension after background, content-script, or manifest changes.

## Releases and documentation

CI validates pushes to `main` and pull requests. A `vX.Y.Z` tag must match `extension/package.json` and point to a commit on `main`. The release workflow reruns checks and publishes the checked Chrome ZIP, source ZIP, and SHA-256 file. Successful `main` CI deploys documentation and the share page to GitHub Pages.

Keep copyright notices and third-party component licenses when editing or redistributing source files.
