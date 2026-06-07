# Publishing the htmlbin agent skill

This repo ships a skills.sh-compatible agent skill at
[`skills/htmlbin/SKILL.md`](../skills/htmlbin/SKILL.md). It is installable on
any agent supported by [skills.sh](https://skills.sh) (Claude Code, Cursor,
Codex, Gemini, and 70+ others) with one command:

    npx skills add utsengar/htmlbin-cli/skills/htmlbin

Pinned-version install (after a release tag is cut):

    npx skills add https://github.com/utsengar/htmlbin-cli/tree/v0.3.1/skills/htmlbin

## What ships automatically (no maintainer action)

- **Discovery on skills.sh.** The vercel-labs/skills resolver supports
  subdirectory installs, so `utsengar/htmlbin-cli/skills/htmlbin` resolves
  directly. No registry PR is required.
- **Security Verified badge.** Every `npx skills add` install triggers a Snyk
  scan server-side. Results post to the skill's skills.sh page automatically.
- **Per-agent install paths.** The CLI knows the project/global skill directory
  for every supported agent and writes there directly (symlink by default,
  copy with `--copy`).

## What the maintainer must do

After this PR merges to `main`:

1. **Seed the listing.** From any clean directory, run the install yourself
   once so skills.sh telemetry picks up the skill:

       npx skills add utsengar/htmlbin-cli/skills/htmlbin -a claude-code -g -y

2. **Smoke test the bootstrap.** In a Claude Code session, say
   "publish a drop to htmlbin explaining this PR" and confirm the agent walks
   through steps 1→5 of the skill (CLI presence → `patterns list` → pattern
   match → read pattern → publish).

3. **Pin a release tag (optional but recommended).** Cut a git tag matching the
   npm version (e.g. `v0.3.1`) so users can install a pinned version of the
   skill. Update the install command at the top of this file when a tag is
   cut.

## Stretch goal: "Official" badge

The `/official` listing on skills.sh is reserved for first-party skills from
the technology vendor. There is no public submission form or catalog PR; the
listing is curated by Vercel.

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

    npx skills validate skills/htmlbin

To preview the bootstrap end-to-end without publishing telemetry, install into
a scratch directory:

    cd $(mktemp -d) && npx skills add ../path/to/htmlbin-cli/skills/htmlbin --copy
