# @htmlbin/cli

> Publish HTML, get a URL.

```
$ htmlbin publish ./out.html
https://htmlbin.dev/p/aB3xK7g

$ htmlbin publish ./out.html --to gh-pages
https://myorg.github.io/myrepo/pr-1234/

$ htmlbin publish ./out.html --to cloudflare --project preview --pr 1234
https://pr-1234.preview.pages.dev
```

A command-line client for [htmlbin.dev](https://htmlbin.dev). The cloud backend is the default. Two opt-in backends are available for organizations that need previews behind single sign-on: GitHub Pages and Cloudflare Pages with Cloudflare Access.

## Install

```bash
npm install -g @htmlbin/cli
```

Requires Node.js 20 or later.

## Quickstart

```bash
htmlbin login
htmlbin publish ./out.html
```

`htmlbin login` mints an API token via the GitHub device-code flow and writes it to `./.htmlbin/token`. Subsequent commands read the token from that file, from the `HTMLBIN_TOKEN` environment variable, or from `~/.config/htmlbin/token`, in that order.

## For coding agents

If you are an agent reading this:

1. Run `htmlbin --help` and `htmlbin <command> --help` for the full command surface.
2. Pass `--output json` for one-line structured payloads on stdout and `{"error": {...}}` on stderr. Detection is automatic when `CLAUDE_CODE`, `CURSOR_AGENT`, `CODEX`, `AIDER`, `CLINE`, `AMP_CODE`, or `DEVIN` is set in the environment.
3. The full agent skill is served at [htmlbin.dev/.well-known/agent-skills/htmlbin/SKILL.md](https://htmlbin.dev/.well-known/agent-skills/htmlbin/SKILL.md). It covers when to publish, drop-quality heuristics, and pattern resolution. Fetch it before publishing.

## GitHub Actions

```yaml
name: PR preview
on:
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  pull-requests: write
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build && cp dist/index.html ./preview.html
      - id: publish
        run: |
          npx -y @htmlbin/cli@latest publish ./preview.html \
            --title "PR #${{ github.event.pull_request.number }}" \
            --output json > drop.json
          echo "url=$(jq -r .url drop.json)" >> $GITHUB_OUTPUT
        env:
          HTMLBIN_TOKEN: ${{ secrets.HTMLBIN_TOKEN }}
      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: htmlbin-preview
          message: "Preview: ${{ steps.publish.outputs.url }}"
```

Add `HTMLBIN_TOKEN` to the repository secrets (`Settings → Secrets and variables → Actions`). The token is the contents of `~/.config/htmlbin/token` after running `htmlbin login` locally.

For a workflow with build-failure handling, metadata, and cleanup when the pull request closes, see [`examples/cloud-publish-workflow.yml`](./examples/cloud-publish-workflow.yml).

## Backends

| Backend | When to use | Authentication |
|---|---|---|
| `cloud` (default) | Public previews | `hb_*` token |
| `gh-pages` | Organization-internal previews behind GitHub SSO | `$GITHUB_TOKEN` |
| `cloudflare` | SSO-gated previews via Cloudflare Access (free tier, up to 50 users) | `$CLOUDFLARE_API_TOKEN` |

Selection precedence: the `--to <name>` flag, then `$HTMLBIN_BACKEND`, then `backend = "..."` in `./.htmlbin/config`, then the default of `cloud`.

Each non-default backend has a one-time setup step. Run `htmlbin setup --to gh-pages` or `htmlbin setup --to cloudflare` to provision the required resources. Reference workflows live in [`examples/`](./examples).

## Commands

```
htmlbin publish <file>    Publish a file and print the URL
htmlbin list              List existing drops
htmlbin url <slug>        Print the URL for a slug
htmlbin delete <slug>     Remove a drop
htmlbin login             Cloud sign-in via GitHub device code
htmlbin setup             One-time backend preparation

htmlbin patterns init     Install the official pattern catalog
htmlbin patterns add      Install one pattern
htmlbin patterns list     List installed patterns
```

Global options:

```
--to <backend>            cloud | gh-pages | cloudflare
--output <format>         text | json (auto-detects coding-agent environments)
--debug                   Include upstream HTTP response bodies in error details
```

Run `htmlbin <command> --help` for full options.

## Patterns

Patterns are short Markdown files that pre-shape a drop for a recurring use case (a pull-request explainer, a weekly roundup, a plan write-up). Coding agents discover them via the [agent skill](https://htmlbin.dev/.well-known/agent-skills/htmlbin/SKILL.md). Run `htmlbin patterns init` to install the official catalog.

## Metadata

Cloud backend only. Attach a flat `Record<string,string>` tag bag to drops. Useful for owner-side filtering (`htmlbin list --metadata kind=spec`) and for keeping a stable URL across re-publishes (`publish --upsert`).

```bash
# Publish with tags
htmlbin publish ./out.html --metadata repo=u/r --metadata pr=42

# Filter the list. Multiple --metadata flags AND together.
htmlbin list --metadata kind=spec --metadata status=draft

# Replace HTML on an existing drop (PUT, new version)
htmlbin update aB3xK7g --file ./newer.html

# Mutate fields without bumping the version (PATCH)
htmlbin update aB3xK7g --title "PR #42 (merged)" --metadata status=merged
htmlbin update aB3xK7g --clear-metadata
```

`publish --upsert` looks up an existing drop matching the given metadata. If a match is found, it updates that drop and the URL stays the same. If no match is found, it creates a new drop.

```bash
htmlbin publish ./out.html --upsert --metadata repo=u/r --metadata pr=42
```

This is the recommended pattern for PR-preview workflows. Tag with `repo` and `pr`, and the URL stays stable across pushes.

**Server-enforced limits:** up to 10 keys, key max 64 chars matching `^[a-z0-9_]([a-z0-9_.-]{0,62}[a-z0-9_])?$`, value max 256 chars, string values only. Violations return `invalid_arg` with `error.details`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `2` | Authentication failure |
| `3` | Forbidden |
| `4` | Not found |
| `5` | Rate limit or quota exceeded |
| `6` | Size limit exceeded |
| `7` | Invalid argument |
| `8` | Network or server error |

## License

MIT. See [LICENSE](./LICENSE).
