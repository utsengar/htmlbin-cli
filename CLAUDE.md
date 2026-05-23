# Project context for AI assistants

This is the source for [`@htmlbin/cli`](https://www.npmjs.com/package/@htmlbin/cli), the command-line client for [htmlbin.dev](https://htmlbin.dev). The package is open source and published publicly on npm. Treat every file in this repo as if it ships to users.

## What the CLI does

A single verb (`publish`) that takes an HTML file and returns a URL. Three backends are pluggable behind the same surface:

- `cloud` (default) — POSTs to `htmlbin.dev`. Public previews.
- `gh-pages` — commits to a `gh-pages` branch via the GitHub Git Data API. Org-internal previews behind GitHub SSO.
- `cloudflare` — deploys to Cloudflare Pages with optional Cloudflare Access gating.

The CLI is shipped to be used by humans on the command line, by GitHub Actions in CI, and by coding agents (Claude Code, Cursor, Codex, etc.). It auto-detects coding-agent environments via env vars and switches to JSON output without a flag.

## Repository layout

- `src/bin.ts` — CLI entrypoint. Wires commander subcommands to backend methods.
- `src/backend.ts` — the `Backend` interface every backend implements.
- `src/backends/cloud.ts`, `src/backends/gh-pages.ts`, `src/backends/cloudflare.ts` — backend impls.
- `src/backends/metadata-guard.ts` — shared boundary check; non-cloud backends reject `--metadata` and `--upsert`.
- `src/cloud/` — htmlbin.dev API client and the metadata parsing module.
- `src/gh/` — GitHub Git Data API client and helpers.
- `src/cf/` — Cloudflare API client (Pages + Access).
- `src/patterns/` — local pattern installer (the agent skill teaches agents to look for these).
- `src/errors.ts` — `CliError` class and the stable exit-code mapping.
- `src/debug.ts` — gate for raw upstream response bodies in error details (off by default).
- `test/` — vitest unit + e2e tests.
- `examples/` — reference GitHub Actions workflows.
- `scripts/build-bundled-patterns.mjs` — bakes the official pattern catalog into the build so `patterns init` works offline.

## Conventions

- TypeScript strict, ESM, Node 20+.
- Public surface is the `Backend` interface plus the CLI flags. Code outside `src/bin.ts` should not assume CLI specifics.
- Error codes are snake_case strings that mirror the htmlbin API's `error.code` shape. The mapping to exit codes lives in `src/errors.ts:exitCodeFor`.
- Tests use vitest; e2e tests in `test/e2e/` spawn the built binary.
- No `console.log` / `console.error` in `src/`. Use `process.stdout.write` / `process.stderr.write` so output mode (`text` vs `json`) stays in control.
- Token storage is `0o600` and the parent `.htmlbin/` directory is `0o700`.

## Verb model

Distinct verbs for distinct intents (kubectl / gh / stripe convention):

- `publish <file>` always POSTs (creates).
- `update <slug>` mutates an existing drop. `--file` triggers PUT (new HTML version), metadata-only flags trigger PATCH (no version bump). Cloud only.
- `publish --upsert --metadata k=v` is the agent-idempotent bridge: GETs by metadata, PUTs to the match if found, POSTs otherwise.

`--upsert` is metadata-keyed only and requires at least one `--metadata` flag.

## Working in this repo

- Open a branch for every change. Direct push to `main` is not allowed.
- Run `npm run build && npm test` before opening a PR.
- Public-facing copy (README, npm metadata, errors, example workflows) reads as neutral product documentation. No emojis, no em-dash flourishes, no marketing voice.
- Source maps ship with the package. They reference `../src/...` paths, never absolute developer paths.
- New backend features that touch the cloud API should also be considered for the htmlbin server-side advertised surface: `https://htmlbin.dev/.well-known/agent-skills/htmlbin/SKILL.md`, `/api/onboard`, and `/.well-known/agent-card.json` are the live discovery surfaces; coordinate updates with the htmlbin server.

## Build, test, release

```bash
npm run build            # tsup bundles to dist/
npm test                 # vitest run
npm run typecheck        # tsc --noEmit (test helpers have known errors)
npm pack --dry-run       # inspect what would ship
npm publish --access public   # publish to @htmlbin/cli
```

The CLI's `--version` is hard-coded in `src/bin.ts` and must stay in sync with `package.json`.
