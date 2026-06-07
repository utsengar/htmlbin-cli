# Publishing the htmlbin agent skill

This repo ships a skills.sh-compatible agent skill at
[`skills/htmlbin-publish/SKILL.md`](../skills/htmlbin-publish/SKILL.md). It is
installable on any agent supported by [skills.sh](https://skills.sh) (Claude
Code, Cursor, Codex, Gemini, and 70+ others) with one command:

    npx skills add https://github.com/utsengar/htmlbin-cli --skill htmlbin-publish

This is the canonical form that skills.sh displays on the skill's page. A
subpath form also works (`npx skills add utsengar/htmlbin-cli/skills/htmlbin-publish`),
but the `--skill <name>` form is what users will see on skills.sh and is the
form to document.

Pinned-version install (after a release tag is cut):

    npx skills add https://github.com/utsengar/htmlbin-cli/tree/v0.3.1 --skill htmlbin-publish

## What ships automatically (no maintainer action)

- **Discovery on skills.sh.** The `vercel-labs/skills` resolver walks the repo
  looking for `SKILL.md` files and matches by frontmatter `name:`. No registry
  PR is required.
- **Security Verified badge.** Every `npx skills add` install triggers a Snyk
  scan server-side. Results post to the skill's skills.sh page automatically.
- **Per-agent install paths.** The CLI knows the project/global skill directory
  for every supported agent and writes there directly (symlink by default,
  copy with `--copy`).
- **skills.sh page.** Once installs start happening, a page appears at
  `https://skills.sh/utsengar/htmlbin-cli/htmlbin-publish` with the install
  command, summary, install count, and Security Verified badge.

## What the maintainer must do

After this PR merges to `main`:

1. **Seed the listing.** From any clean directory, run the install yourself
   once so skills.sh telemetry picks up the skill:

       npx skills add https://github.com/utsengar/htmlbin-cli --skill htmlbin-publish -a claude-code -g -y

2. **Smoke test the bootstrap.** In a Claude Code session, say
   "publish a drop to htmlbin explaining this PR" and confirm the agent walks
   through steps 1→5 of the skill (CLI presence → `patterns list` → pattern
   match → read pattern → publish).

3. **Pin a release tag (optional but recommended).** Cut a git tag matching the
   npm version (e.g. `v0.3.1`) so users can install a pinned version of the
   skill. Update the install command at the top of this file when a tag is
   cut.

## Naming convention

The skill is named `htmlbin-publish` (not `htmlbin`) to match how every other
established publisher names their skills on skills.sh: the owner/repo path
already carries the brand (`utsengar/htmlbin-cli`), so the skill name describes
the action. References:

- Anthropic: `frontend-design`, `mcp-builder`, `pdf` — never `anthropic`.
- Vercel: `deploy-to-vercel`, `agent-browser` — never just `vercel`.
- Stripe: `upgrade-stripe`, `create-payment-credential` — verb-led when the
  action is specific enough, brand-prefixed when grouping a family.
- Webflow: `site-audit`, `safe-publish`, `bulk-cms-update` — drops the
  `webflow-` prefix on standalone skills.

If we ever ship sibling skills (e.g. for the local `serve` preview), they
should follow the same shape: `htmlbin-serve`, `htmlbin-patterns`, etc.

## Stretch goal: "Official" badge

The `/official` listing on skills.sh is reserved for first-party skills curated
by Vercel. There is no public submission form or catalog PR.

To pursue it for htmlbin:

- Open a discussion in [vercel-labs/skills](https://github.com/vercel-labs/skills/discussions)
  asking how third-party tools become official.
- Pitch: htmlbin owns the `@htmlbin/cli` package on npm and the SKILL.md ships
  from the same repo as the CLI, so the source of truth is the same maintainer.

The Security Verified badge is independent and does not require this step.

## SKILL.md frontmatter notes

The `npx skills` CLI only reads `name` and `description` from frontmatter.
`description` is the routing-trigger surface — the agent's matcher reads it to
decide whether the skill applies — so edits to the description meaningfully
change which user requests pull the skill in. Real trigger phrases live in the
SKILL.md body for human and agent readers; they are not parsed by the registry.

## Local validation

To check the skill parses cleanly:

    npx skills validate skills/htmlbin-publish

To preview the bootstrap end-to-end without publishing telemetry, install into
a scratch directory:

    cd $(mktemp -d) && npx skills add ../path/to/htmlbin-cli/skills/htmlbin-publish --copy
