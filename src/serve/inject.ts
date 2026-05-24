// Builds the <link> + <script> tags injected into raw .html files.
// The actual bar runtime + styles live in client.ts and are served as
// static assets at /__hb/client.css and /__hb/client.js. Going external
// instead of inline means pages with CSP `script-src 'self'` / `style-src 'self'`
// accept the bar (inline `<style>` and `<script>` would otherwise be rejected).

interface InjectOpts {
  reload: boolean;
  /** When false, the bar is skipped entirely. SSE reload still works. */
  overlay: boolean;
  /** Basename or relative path of the served file (shown in the bar). */
  path: string;
  /** Absolute path used in the "publish" popover so the copied command
   *  works regardless of where it's pasted. Empty string hides the
   *  publish affordance (non-publishable files). */
  publishPath: string;
  /** "localhost:62821". */
  localAddr: string;
}

export function buildClientScript(opts: InjectOpts): string {
  if (!opts.reload && !opts.overlay) return "";
  const params = new URLSearchParams();
  params.set("reload", opts.reload ? "1" : "0");
  params.set("overlay", opts.overlay ? "1" : "0");
  if (opts.path) params.set("path", opts.path);
  if (opts.localAddr) params.set("addr", opts.localAddr);
  if (opts.publishPath) params.set("publish", opts.publishPath);
  return `<link rel="stylesheet" href="/__hb/client.css">` +
    `<script src="/__hb/client.js?${params.toString()}" defer></script>`;
}

// Insert just before </body>. Fallback: append at end when no body tag.
export function injectIntoHtml(html: string, tags: string): string {
  if (!tags) return html;
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + tags;
  return html.slice(0, idx) + tags + html.slice(idx);
}
