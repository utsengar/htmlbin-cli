// Title resolution for cloud-backend publishes.
//
// The worker requires `title` in the POST body and stores it verbatim —
// there is no server-side <title> parsing. Authors expect the document's
// own <title>...</title> to win over the filename, so the precedence
// lives here:
//
//   1. explicit --title flag
//   2. <title>...</title> from the HTML
//   3. file stem
//   4. "Untitled" (no filename, e.g. stdin)
//
// Output is whitespace-collapsed, trimmed, and truncated to the worker's
// MAX_TITLE so we don't bounce off a 400.

import { basename, extname } from "node:path";

const MAX_TITLE = 200;

export interface ResolveTitleOpts {
  explicit?: string | undefined;
  html: string;
  filePath?: string | null | undefined;
}

export function resolveTitle(opts: ResolveTitleOpts): string {
  const explicit = opts.explicit?.trim();
  if (explicit) return truncate(explicit, MAX_TITLE);

  const fromHtml = extractTitleFromHtml(opts.html);
  if (fromHtml) return truncate(fromHtml, MAX_TITLE);

  if (opts.filePath) {
    const stem = basename(opts.filePath, extname(opts.filePath));
    if (stem) return truncate(stem, MAX_TITLE);
  }

  return "Untitled";
}

function extractTitleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const decoded = decodeEntities(m[1]!);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return collapsed || null;
}

// Decode the handful of entities authors actually write in titles.
// &amp; runs last so that authored &amp;lt; round-trips to &lt; (not <).
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}
