---
name: htmlbin-publish
description: Use when the user asks to publish a drop to htmlbin, make a page or preview for content, or share something as a quick HTML URL. Consults htmlbin's pattern library to shape the artifact before any HTML is authored.
---

# htmlbin-publish

htmlbin publishes a single HTML file to a public URL. The `htmlbin` CLI ships
with a **pattern library** — markdown design briefs that describe how to compose
a drop for a given use case (PR writeup, plan/spec, summary roundup, etc.). The
pattern must shape the HTML *before* it is written. By the time `htmlbin
publish` runs, the artifact already exists and the pattern can no longer help.

## When this skill applies

Trigger phrases include:

- "publish a drop to htmlbin"
- "publish to htmlbin"
- "make a page / drop / preview for this"
- "share this as an htmlbin"
- "put this online" when the context implies an htmlbin

## Workflow (in order, no shortcuts)

### 1. Ensure the CLI is available

    htmlbin --version

If the command is not found, substitute `npx @htmlbin/cli` everywhere `htmlbin`
appears below. No global install is required.

### 2. List patterns; install them if absent

    htmlbin patterns list

If no patterns are listed:

    htmlbin patterns init

This installs the official pattern catalog locally. The bundled set today is
`summary-roundup`, `pr-explainer`, `plan-spec-explainer`.

### 3. Match the task to a pattern

Map the user's request to one of the listed patterns using each pattern's
`description`. If nothing fits, **say so out loud** ("No matching pattern —
proceeding pattern-free with neutral defaults") and skip to step 5. Do not
silently improvise.

### 4. Read the chosen pattern *before* authoring

`htmlbin patterns list` prints a `path` for each entry. Read the entire file at
that path. The pattern document includes a content checklist, layout direction,
and brand-sensing rules. The pattern's job is to shape both what's on the page
and how it's laid out.

### 5. Author the HTML, then publish

Write a single self-contained HTML file to a temporary path, then:

    htmlbin publish <file>

The command prints the URL. That URL is the deliverable.

## Hard rules

- **Never publish a file the user has not seen described.** Surface the chosen
  pattern (or "pattern-free") before authoring.
- **Never run `htmlbin publish` first and pick a pattern after.** The artifact
  is what gets published; you cannot retro-shape it.
- **Do not invent patterns.** Only use what `htmlbin patterns list` returns.
- **Pattern-free is allowed but must be declared.** Do not quietly skip step 3.

## References

- Repo: https://github.com/utsengar/htmlbin-cli
- npm package: `@htmlbin/cli`
- Hosted service: https://htmlbin.dev
