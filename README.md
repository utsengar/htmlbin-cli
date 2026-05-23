# @htmlbin/cli

> Publish HTML, get a URL. One verb, pluggable backends.

```
$ htmlbin publish ./out.html
https://htmlbin.dev/p/aB3xK7g

$ htmlbin publish ./out.html --to gh-pages
https://myorg.github.io/myrepo/pr-1234/

$ htmlbin publish ./out.html --to cloudflare --project preview --pr 1234
https://pr-1234.preview.pages.dev
```

The CLI for [htmlbin](https://htmlbin.dev). The cloud is the default. Alternative backends ship as opt-ins for environments where a public URL is the wrong fit — GitHub Pages (org-internal SSO via Pages → Private) and Cloudflare Pages + Access (free identity-aware gate up to 50 users).

Built for CI and coding agents from the start. Auth via env var (`HTMLBIN_TOKEN`), JSON output for piping into `jq`, no interactive prompts, no terminal assumptions. See [Headless / GitHub Actions](#headless--github-actions) below — that's the primary use case this CLI exists to serve.

## Install

```bash
npm i -g @htmlbin/cli
# or
npx @htmlbin/cli publish ./out.html
```

Requires Node 20+.

## Headless / GitHub Actions

This is the core reason the CLI exists: publish HTML from CI without a human in the loop. The fastest possible setup against the cloud backend:

```yaml
# .github/workflows/preview.yml
name: PR preview
on: { pull_request: { types: [opened, synchronize, reopened] } }
permissions: { pull-requests: write }
jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      # Replace this with whatever produces your HTML.
      - run: npm ci && npm run build && cp dist/index.html ./preview.html

      - id: publish
        run: |
          npx -y @htmlbin/cli@latest publish ./preview.html \
            --title "PR #${{ github.event.pull_request.number }} preview" \
            --output json > drop.json
          echo "url=$(jq -r .url drop.json)" >> $GITHUB_OUTPUT
        env:
          HTMLBIN_TOKEN: ${{ secrets.HTMLBIN_TOKEN }}

      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: htmlbin-preview
          message: "Preview: ${{ steps.publish.outputs.url }}"
```

**One-time setup:**

1. `htmlbin login` on your laptop (device-code flow with GitHub).
2. `cat ~/.config/htmlbin/token` → copy the value.
3. Repo → Settings → Secrets → Actions → New secret named `HTMLBIN_TOKEN`.

That's the entire auth setup. `htmlbin login` is the only command that needs a browser; everything else runs from `$HTMLBIN_TOKEN`.

**Why this works in CI:**

- Token resolution order is `./.htmlbin/token` → `$HTMLBIN_TOKEN` → `~/.config/htmlbin/token`. CI hits the env-var branch.
- `--output json` emits one-line envelopes like `{"url":"...","slug":"...","backend":"cloud"}` — pipe through `jq -r .url` to feed the next step.
- Exit codes are stable (see [Exit codes](#exit-codes)) — CI can branch on them.
- No EPIPE crashes when Actions log truncation closes stdout mid-write.

**Slug stability across pushes:** the cloud backend generates a fresh slug per publish, so the URL changes on every push. A deterministic `--title` gives you a stable handle for find-by-title cleanup (`htmlbin list --output json | jq '… select(.title==$t)'`). If you need a slug that survives across pushes (so the sticky comment URL never changes), use `--to gh-pages --pr <n>` — see the Pages backend section. The `cloud-publish-workflow.yml` example shows the full find-by-title pattern with pre-publish cleanup and on-close teardown.

**Full reference workflows** in `examples/`:

- `cloud-publish-workflow.yml` — the above plus pre-publish cleanup and on-close teardown.
- `preview-workflow.yml` / `agent-preview-workflow.yml` — same idea but `--to gh-pages` for org-internal SSO-gated previews. Use these if your HTML can't be public.

For org-internal HTML (must stay behind SAML SSO), swap `HTMLBIN_TOKEN` for the auto-injected `GITHUB_TOKEN` and add `--to gh-pages`. See the Pages backend section below.

## Backends

| Backend | When to use | Auth | Cost barrier |
|---|---|---|---|
| `cloud` *(default)* | Public-by-URL publishing. Most uses. | `hb_*` token (device-code) | Free |
| `gh-pages` | Internal review previews inside a GitHub org | `$GITHUB_TOKEN` | GitHub Enterprise / Teams (private Pages) |
| `cloudflare` | Free SSO-gated previews via Cloudflare Access | `$CLOUDFLARE_API_TOKEN` | Free Zero Trust tier (up to 50 users) |

### Backend resolution order

1. `--to <name>` flag
2. `$HTMLBIN_BACKEND` env var
3. `backend = "…"` in `./.htmlbin/config` (TOML)
4. Default: `cloud`

## Commands

```
htmlbin publish <file> [options]   Publish an HTML file, print the URL
htmlbin list                       List your drops
htmlbin delete <slug>              Remove a drop
htmlbin url <slug>                 Print the URL for a slug (no publish)
htmlbin login                      Cloud: device-code sign-in via GitHub
htmlbin setup                      One-time prep for the selected backend

htmlbin patterns list              List installed local patterns
htmlbin patterns init              Install the official catalog patterns
htmlbin patterns add <source>      Install one pattern from a source
```

Global flags:

```
--to cloud | gh-pages | cloudflare    backend selector
--output text | json                  output format (default: text)
```

## Output modes (agent-friendly)

`--output json` makes every command emit a structured payload on stdout. Errors emit `{"error": {"code", "message", "hint?", "details?"}}` on stderr — same `error.code` shape as the htmlbin.dev API.

```bash
$ htmlbin --output json publish ./out.html
{"url":"https://htmlbin.dev/p/aB3xK7g","slug":"aB3xK7g","backend":"cloud"}

$ htmlbin --output json list
[{"slug":"aB3xK7g","url":"...","updated_at":"...","title":"..."}, ...]

$ htmlbin --output json publish /tmp/missing.html
{"error":{"code":"file_not_found","message":"No such file: /tmp/missing.html","hint":"...","details":{...}}}
# exit code 4
```

### Auto-detection

If any of these env vars is set, `--output json` becomes the default — no flag needed:

```
CLAUDE_CODE · CURSOR_AGENT · CODEX · CODEX_AGENT · AIDER · CLINE · AMP_CODE · DEVIN
```

Most coding-agent runners set one of these. The agent gets JSON without having to know about the flag; humans running interactively get the text formatting. Explicit `--output text` always overrides the detection.

## Patterns — local drop authoring guidance

The skill at `https://htmlbin.dev/.well-known/agent-skills/htmlbin/SKILL.md` teaches agents to look for **patterns** — small markdown files that pre-shape what a drop should look like for a recurring use case (a PR explainer, a weekly roundup, a plan/spec writeup). The CLI makes installing and managing them ergonomic.

Resolution order (matches what the skill teaches):

1. `./.htmlbin/patterns/*.md` — project-local; wins.
2. `$XDG_CONFIG_HOME/htmlbin/patterns/*.md` (or `~/.config/htmlbin/patterns/*.md`) — machine-global.
3. The catalog at `https://htmlbin.dev/.well-known/patterns/<name>.md`.
4. Freestyle within the quality floor the skill describes.

### `htmlbin patterns init`

```bash
htmlbin patterns init                  # global dir (~/.config/htmlbin/patterns)
htmlbin patterns init --project        # ./.htmlbin/patterns instead
htmlbin patterns init --force          # overwrite existing
```

Fetches the live catalog index from `https://htmlbin.dev/.well-known/patterns/index.json` and installs every entry. If the network is unreachable, falls back to the 3 starter patterns bundled into the CLI at build time and prints `(offline — using bundled fallback)`. Idempotent: re-runs skip existing files unless `--force`.

### `htmlbin patterns add <source>`

Installs one pattern. The source argument is flexible:

| Form | Resolves to |
|---|---|
| `pr-explainer` (bare kebab-case name) | catalog → `https://htmlbin.dev/.well-known/patterns/pr-explainer.md` |
| `https://example.com/foo.md` | fetched verbatim |
| `github:owner/repo/path/to/file.md` | `https://raw.githubusercontent.com/owner/repo/HEAD/path/to/file.md` |
| `gist:<hash>` or `gist:<hash>/<file>` | `https://gist.githubusercontent.com/raw/...` |
| `./relative.md` or `/abs/path.md` | local file copied in |

```bash
htmlbin patterns add summary-roundup
htmlbin patterns add github:utsengar/htmlbin-cli/patterns/pr-explainer.md
htmlbin patterns add gist:abc123def
htmlbin patterns add ./my-team-pattern.md --project
```

Conflict (`<name>.md` already exists at the destination) → `invalid_arg` exit 7; re-run with `--force` to overwrite. The `--catalog <url>` flag overrides the catalog base for forks or self-hosted setups.

### `htmlbin patterns list`

```bash
htmlbin patterns list                  # aligned table in a terminal
htmlbin patterns list --output json    # { project, global, effective }
```

Walks both dirs, shows which file wins per name. Project entries beat global entries with the same name; the `effective` array in JSON output reports the winning source per pattern.

### Pattern file schema

Validated at install time. Reject early, no auto-fix.

```markdown
---
name: pr-explainer           # required, kebab-case, must match filename
description: optional one-liner
triggers:                    # required, non-empty list of strings
  - explain this pr
  - summarize this diff
brand_sensing: true          # optional, default true
---

# Title

## At least one ## heading is required
```

The skill is the source of truth for agent behavior. If the CLI ever diverges, the CLI gets fixed first — the skill is what agents pin to.

## Cloud backend (default)

The fastest path. Wraps the htmlbin.dev API with no new server-side code.

### One-time login

```bash
htmlbin login
```

Mints a `hb_*` token via the device-code flow (open the verification URL, sign in with GitHub, token writes to `./.htmlbin/token`). Same token storage convention the API's `/api/onboard` descriptor advertises:

1. `./.htmlbin/token` (project-local, preferred)
2. `$HTMLBIN_TOKEN` env var
3. `~/.config/htmlbin/token`

### Publish

```bash
htmlbin publish ./out.html --title "Preview of PR #1234"
# → https://htmlbin.dev/p/aB3xK7g
```

`--title` defaults to the filename. `--description` is optional. Both are cloud-only; gh-pages and cloudflare ignore them.

### Manage

```bash
htmlbin list                     # paginated history (newest first)
htmlbin url aB3xK7g              # print URL for a slug
htmlbin delete aB3xK7g           # remove the drop
```

## GitHub Pages backend (`--to gh-pages`)

For org-internal previews gated by GitHub SSO. GitHub itself provides the gate: a **private repo** with **Settings → Pages → Access: "Private"** redirects unauthenticated viewers through the org's SAML SSO before serving HTML.

### Prerequisites

- A repo with GitHub Pages enabled, source = `gh-pages` branch.
- Repo visibility: **Private** or **Internal**.
- Org plan: **GitHub Enterprise Cloud** or **Teams** with private Pages enabled. Free / personal orgs serve public Pages regardless of repo visibility.

### Setup

```bash
GITHUB_TOKEN=$(gh auth token) htmlbin setup --to gh-pages
```

Creates `gh-pages` with an empty commit if missing, then prints the manual UI steps for flipping Pages → "Private" (no API).

### Publish

```bash
# Locally
htmlbin publish ./out.html --to gh-pages --pr 1234
# → https://myorg.github.io/myrepo/pr-1234/

# In GitHub Actions (PR number auto-detected from $GITHUB_REF)
htmlbin publish ./out.html --to gh-pages
```

### How publish works

One atomic commit per invocation via the GitHub Git Data API — no clone, no temp dir, no git binary:

```
GET    /repos/{o}/{r}/git/ref/heads/gh-pages   → current SHA
GET    .../git/commits/{sha}                   → current tree
POST   .../git/blobs                           → upload HTML
POST   .../git/trees { base_tree, [pr-N/...] }
POST   .../git/commits { tree, parents }
PATCH  .../git/refs/heads/gh-pages             → advance ref
```

Pages typically rebuilds within ~60s after the commit lands.

## Cloudflare backend (`--to cloudflare`)

For teams that want a free SSO gate without GitHub Enterprise. Cloudflare Access is an identity-aware proxy in front of any CF-hosted URL — Google, Okta, Azure AD, GitHub, one-time pin email codes, or email-domain rules.

### Prerequisites

- A Cloudflare account with **Zero Trust / Access enabled** (free tier works for up to 50 users).
- `$CLOUDFLARE_API_TOKEN` with **Pages: edit** and **Access: edit** scopes on the target account.
- `$CLOUDFLARE_ACCOUNT_ID`.

### Setup

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
htmlbin setup --to cloudflare --project preview-htmlbin --email-domain example.com
```

Creates the Pages project if it doesn't exist, then provisions an Access app covering `*.preview-htmlbin.pages.dev` with a default "allow" policy. Pass `--idp <id>` for a specific IdP, or `--email user@x.com`.

Without include flags, `setup` just prints the available IdPs and tells you how to re-run.

### Publish

```bash
htmlbin publish ./out.html --to cloudflare --project preview-htmlbin --pr 1234
# → https://pr-1234.preview-htmlbin.pages.dev
```

The deployment alias is the slug (`pr-1234` by default, or `--slug feature-x`). Cloudflare serves the URL within seconds; Access gates it via the policy you configured.

## Configuration file

Optional. `./.htmlbin/config` is read on every command:

```toml
backend = "cloudflare"
account_id = "abcdef..."
project = "preview-htmlbin"
```

For gh-pages:

```toml
backend = "gh-pages"
repo = "myorg/myrepo"
branch = "gh-pages"
```

## Exit codes

Stable across releases — CI can switch on these.

| Code | Meaning |
|---|---|
| `0` | success |
| `2` | auth failure (`unauthorized`, `auth_required`, `github_token_missing`, `cloudflare_token_missing`) |
| `3` | `forbidden` |
| `4` | not found (drop, file, branch, project) |
| `5` | rate limit / quota |
| `6` | size limit (HTML too large, title too long) |
| `7` | bad input (invalid slug, missing PR, bad backend name, setup required) |
| `8` | network / server misconfig |

The CLI prints `error: <message>  [<code>]` to stderr. The bracketed code mirrors the htmlbin.dev API's `error.code` for the cloud backend — agents and CI can switch on it.

## Reference GitHub Actions workflows

The CLI is publish-only. Whatever produces the HTML upstream is the user's choice. Three reference workflows ship in `examples/`, mixing two orthogonal questions: **where does the HTML come from** (your build vs an agent) and **where does it get published** (public cloud vs org-internal Pages).

### Public preview, you build the HTML — `examples/cloud-publish-workflow.yml`

Cloud backend (htmlbin.dev). Simplest possible setup: one `HTMLBIN_TOKEN` secret, no Pages config, no infra. Built-in teardown deletes the drop when the PR closes. Use this when the HTML is OK to be public. **This is the workflow most repos should start with.**

### Org-internal preview, static-site repo — `examples/preview-workflow.yml`

gh-pages backend, gated by Pages → Private (requires GH Enterprise Cloud or Teams). For repos whose build naturally produces HTML (Storybook, Vite SPA, Astro, Next.js static export, etc.). Runs `npm run build`, then publishes whatever HTML the build emits. Auth via the auto-injected `GITHUB_TOKEN`. Branching sticky comments handle the three failure modes: preview lives / build OK but no HTML at path / build failed entirely.

### Org-internal preview, non-static repo — `examples/agent-preview-workflow.yml`

gh-pages backend + a coding agent generates the HTML. For repos that don't build to HTML on their own (backend services, libraries, mobile apps, CLIs). A headless coding agent CLI — Claude Code `-p` mode by default, swap-points documented for OpenAI Codex CLI's `codex exec` — runs inside the CI runner with full tool use (file system, bash, multi-turn). The agent reads the PR diff and writes `./preview.html`; `htmlbin publish` ships it.

The agent harness is what makes this work — a raw model call against a diff produces noise; an agent that can read related files, run the build, and iterate produces a real preview. The repo content never leaves the CI environment (only model-API egress); pick whichever agent vendor your team is already paying for.

The two `gh-pages` workflows pair with `examples/teardown-workflow.yml` to clean up the preview when the PR closes. (The cloud workflow has teardown built in.)

## License

MIT. Source: [github.com/utsengar/htmlbin-cli](https://github.com/utsengar/htmlbin-cli).
