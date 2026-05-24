// Path → HTTP response. Three branches:
//   `.html` → serve raw, inject SSE/pill script before </body>
//   `.md`   → render via marked, wrap in our chrome template
//   other   → mime-type lookup and serve raw (only relevant in dir mode)
//
// Directory mode also renders an index page at "/" listing all .html/.md
// files under the root (recursive), sorted by mtime desc.

import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { marked } from "marked";
import { buildClientScript, injectIntoHtml } from "./inject.js";
import { renderPage, escapeHtml } from "./template.js";
import type { ServeOptions } from "./types.js";

export interface RenderResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".md": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

// Refuse anything that resolves outside the served root — this is the only
// directory-traversal guard we need since we always resolve relative to
// `opts.target` before reading.
export function resolveSafe(rootAbs: string, relPath: string): string | null {
  const decoded = decodeURIComponent(relPath.replace(/^\/+/, ""));
  const abs = resolve(rootAbs, decoded);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null;
  return abs;
}

export async function renderForRequest(
  urlPath: string,
  opts: ServeOptions
): Promise<RenderResult> {
  if (opts.mode === "file") return renderSingleFile(urlPath, opts);
  return renderDir(urlPath, opts);
}

async function renderSingleFile(urlPath: string, opts: ServeOptions): Promise<RenderResult> {
  // In file mode we only serve the target. Any path is fine — same response.
  return await renderFileAtPath(opts.target, opts);
}

async function renderDir(urlPath: string, opts: ServeOptions): Promise<RenderResult> {
  if (urlPath === "/" || urlPath === "") return renderIndex(opts);
  const safe = resolveSafe(opts.target, urlPath);
  if (!safe) return notFound(opts);
  try {
    const st = await stat(safe);
    if (st.isDirectory()) return renderIndex(opts, safe);
    return await renderFileAtPath(safe, opts);
  } catch {
    return notFound(opts);
  }
}

async function renderFileAtPath(absPath: string, opts: ServeOptions): Promise<RenderResult> {
  const ext = extname(absPath).toLowerCase();
  const displayPath = pathForChrome(absPath, opts);
  try {
    if (ext === ".md") {
      const raw = await readFile(absPath, "utf8");
      const rendered = await marked.parse(raw);
      const page = renderPage({
        title: displayPath,
        path: displayPath,
        localAddr: opts.localAddr ?? "",
        bodyHtml: rendered,
        reload: opts.reload,
      });
      return { status: 200, headers: ct(".md"), body: page };
    }
    if (ext === ".html" || ext === ".htm") {
      const raw = await readFile(absPath, "utf8");
      const script = buildClientScript({
        reload: opts.reload,
        overlay: opts.overlay,
        path: displayPath,
        publishPath: absPath,
        localAddr: opts.localAddr ?? "",
      });
      const body = injectIntoHtml(raw, script);
      return { status: 200, headers: ct(ext), body };
    }
    // Raw asset
    const buf = await readFile(absPath);
    return { status: 200, headers: ct(ext), body: buf };
  } catch {
    return notFound(opts);
  }
}

async function renderIndex(opts: ServeOptions, subDir?: string): Promise<RenderResult> {
  const root = subDir ?? opts.target;
  const entries = await listRenderable(root);
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const heading = (subDir && subDir !== opts.target)
    ? relative(opts.target, subDir) + "/"
    : basename(opts.target) + "/";
  const list = entries.length === 0
    ? `<p class="hb-empty">No <code>.html</code> or <code>.md</code> files here yet — save one and it will appear.</p>`
    : `<ul class="hb-index">
${entries.map((e) => `  <li><a href="${escapeHtml(e.urlPath)}">${escapeHtml(e.label)}</a><span class="hb-meta">${escapeHtml(formatMtime(e.mtimeMs))}</span></li>`).join("\n")}
</ul>`;
  const page = renderPage({
    title: heading,
    path: heading,
    localAddr: opts.localAddr ?? "",
    bodyHtml: list,
    reload: opts.reload,
  });
  return { status: 200, headers: ct(".html"), body: page };
}

interface IndexEntry {
  urlPath: string;
  label: string;
  mtimeMs: number;
}

async function listRenderable(rootAbs: string): Promise<IndexEntry[]> {
  const out: IndexEntry[] = [];
  await walk(rootAbs, rootAbs, out);
  return out;
}

async function walk(rootAbs: string, dirAbs: string, out: IndexEntry[]): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dirAbs);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const abs = join(dirAbs, name);
    let st;
    try {
      st = await stat(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      await walk(rootAbs, abs, out);
      continue;
    }
    const ext = extname(name).toLowerCase();
    if (ext !== ".html" && ext !== ".htm" && ext !== ".md") continue;
    const rel = relative(rootAbs, abs);
    out.push({
      urlPath: "/" + rel.split(sep).map(encodeURIComponent).join("/"),
      label: rel,
      mtimeMs: st.mtimeMs,
    });
  }
}

function notFound(opts: ServeOptions): RenderResult {
  const body = renderPage({
    title: "not found",
    path: "404",
    localAddr: opts.localAddr ?? "",
    bodyHtml: `<p>The requested file isn't here yet — <code>htmlbin serve</code> is watching, save the file to render it.</p>`,
    reload: opts.reload,
  });
  return { status: 404, headers: ct(".html"), body };
}

function pathForChrome(absPath: string, opts: ServeOptions): string {
  if (opts.mode === "file") return basename(absPath);
  const rel = relative(opts.target, absPath);
  return rel || basename(absPath);
}

function ct(ext: string): Record<string, string> {
  return {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  };
}

function basename(p: string): string {
  const idx = p.lastIndexOf(sep);
  return idx === -1 ? p : p.slice(idx + 1);
}

function formatMtime(ms: number): string {
  const diff = Date.now() - ms;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toISOString().slice(0, 10);
}
