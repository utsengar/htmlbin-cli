// Page chrome for content we own: rendered Markdown, dir index, 404.
// Two layers, matching htmlbin.dev exactly:
//   1. Top: full-width .viewer-bar — same shape as a production drop page,
//      with a [local] chip + localhost:<port> as the local signal.
//   2. Body: 720px <main> column with Geist sans, the same prose color
//      tokens as htmlbin3/src/styles.ts.

const TOKENS = `
:root {
  --bg: #FFFFFF; --bg-2: #FAFAFA; --bg-3: #F5F5F5;
  --ink: #0A0A0A; --ink-2: #171717; --ink-soft: #737373; --ink-softer: #A3A3A3;
  --rule: #E5E5E5; --rule-soft: #F0F0F0;
  --red: #D93025; --red-bg: #FCE8E6; --red-bg-stroke: #F4C7C3;
  --green-dot: #1F8F4A; --amber-dot: #B45309;
  --sans: "Geist", -apple-system, "Inter", system-ui, sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
`.trim();

const BASE = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: var(--bg); color: var(--ink);
  font-family: var(--sans); font-size: 16px; line-height: 1.6;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
::selection { background: var(--red); color: #fff; }
a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:hover { color: var(--red); text-decoration-color: var(--red); }
`.trim();

// Lifted directly from htmlbin3/src/styles.ts .viewer-bar, with the same
// tokens. The only addition is .hb-local-chip (the red-on-red [local] pill)
// and the connection-status dot — both are local-only affordances.
const BAR = `
header.hb-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--rule);
  background: var(--bg-2);
  flex-wrap: wrap;
  font-size: 13px;
  font-family: var(--sans);
  position: sticky; top: 0; z-index: 50;
}
header.hb-bar .hb-sep {
  color: var(--ink-softer); font-family: var(--mono);
}
header.hb-bar .hb-title {
  font-weight: 600; font-size: 14px; color: var(--ink);
  flex: 0 1 auto; min-width: 0; max-width: 36vw;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
header.hb-bar .hb-right {
  margin-left: auto; flex: 0 0 auto;
  display: flex; align-items: center; gap: 14px;
  font-family: var(--mono); font-size: 12px; color: var(--ink-soft);
}
header.hb-bar .hb-right a { color: inherit; }
header.hb-bar .hb-right a:hover { color: var(--red); }
header.hb-bar .hb-chip {
  display: inline-flex; align-items: center;
  background: var(--bg-2); border: 1px solid var(--rule);
  border-radius: 4px; padding: 3px 8px;
  font: 500 11.5px/1 var(--mono);
  color: var(--ink-2);
  letter-spacing: 0.02em;
}
header.hb-bar .hb-chip.hb-local-chip {
  color: var(--red); border-color: var(--red-bg-stroke); background: var(--red-bg);
}
header.hb-bar .hb-status {
  display: inline-flex; align-items: center; gap: 6px;
}
header.hb-bar .hb-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ink-softer); display: inline-block;
}
header.hb-bar[data-state="connected"]    .hb-dot { background: var(--green-dot); }
header.hb-bar[data-state="reconnecting"] .hb-dot { background: var(--amber-dot); }
@media (max-width: 720px) {
  header.hb-bar { gap: 10px; padding: 10px 14px; }
  header.hb-bar .hb-title { max-width: none; flex: 1 1 0; min-width: 0; font-size: 13.5px; }
  header.hb-bar .hb-right { width: 100%; margin-left: 0; gap: 12px; font-size: 11.5px; flex-wrap: wrap; }
}
`.trim();

const MAIN = `
main.hb-main { max-width: 720px; margin: 0 auto; padding: 28px 28px 96px; }
main.hb-main h1 { font-size: clamp(28px, 4vw, 38px); letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 14px; }
main.hb-main h2 { font-size: 22px; line-height: 1.25; margin: 28px 0 12px; letter-spacing: -0.01em; }
main.hb-main h3 { font-size: 18px; line-height: 1.3; margin: 22px 0 10px; }
main.hb-main p { margin: 0 0 18px; max-width: 64ch; font-size: 17px; line-height: 1.65; color: var(--ink-2); }
main.hb-main p strong { color: var(--ink); font-weight: 600; }
main.hb-main p em { font-style: normal; color: var(--red); font-weight: 500; }
main.hb-main ul, main.hb-main ol { margin: 0 0 18px 24px; }
main.hb-main li { margin: 6px 0; max-width: 64ch; font-size: 17px; color: var(--ink-2); }
main.hb-main hr { border: 0; border-top: 1px solid var(--rule); margin: 28px 0; }
main.hb-main blockquote {
  margin: 0 0 20px; padding: 4px 18px;
  border-left: 3px solid var(--red); color: var(--ink-soft);
  font-size: 17px;
}
code, .hb-mono { font-family: var(--mono); font-size: 0.86em; }
main.hb-main p code, main.hb-main li code {
  background: var(--bg-2); border: 1px solid var(--rule);
  padding: 1px 6px; border-radius: 4px; white-space: nowrap;
  font-weight: 500; color: var(--ink-2);
}
main.hb-main pre {
  background: #0A0A0A; color: #FAFAFA;
  padding: 18px 22px; border-radius: 6px; overflow-x: auto;
  margin: 0 0 24px; font: 13.5px/1.7 var(--mono);
}
main.hb-main pre code { background: none; border: 0; padding: 0; color: inherit; }
main.hb-main table {
  border-collapse: collapse; margin: 0 0 22px;
  font-size: 15px; width: 100%;
}
main.hb-main th, main.hb-main td {
  text-align: left; padding: 10px 14px;
  border-bottom: 1px solid var(--rule-soft);
}
main.hb-main th {
  font: 500 11px/1 var(--mono); color: var(--ink-soft);
  letter-spacing: 0.06em; text-transform: uppercase;
}
@media (max-width: 720px) { main.hb-main { padding: 22px 22px 80px; } }
ul.hb-index { list-style: none; padding: 0; margin: 0; }
ul.hb-index li {
  padding: 10px 0;
  border-bottom: 1px solid var(--rule-soft);
  display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: baseline;
}
ul.hb-index li:last-child { border-bottom: 0; }
ul.hb-index a {
  font-family: var(--mono); font-size: 13px;
  text-decoration: none; color: var(--ink);
}
ul.hb-index a:hover { color: var(--red); }
ul.hb-index .hb-meta {
  color: var(--ink-softer); font: 12px var(--mono);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
p.hb-empty { color: var(--ink-soft); font-family: var(--mono); font-size: 13px; }
`.trim();

const CLIENT = `<script>(function(){
var bar = document.querySelector("header.hb-bar");
if(!bar) return;
var label = bar.querySelector(".hb-label");
var es = new EventSource("/__hb/sse");
es.addEventListener("open",  function(){ bar.dataset.state = "connected";    if(label) label.textContent = "connected"; });
es.addEventListener("error", function(){ bar.dataset.state = "reconnecting"; if(label) label.textContent = "reconnecting"; });
es.addEventListener("reload", function(){ location.reload(); });
})();</script>`;

interface PageOpts {
  /** <title>. */
  title: string;
  /** Shown in the bar as the file/path. */
  path: string;
  /** "localhost:62821". */
  localAddr: string;
  /** Rendered body HTML. */
  bodyHtml: string;
  /** When false, omit the live-reload client (status dot stays "disconnected"). */
  reload: boolean;
}

export function renderPage(opts: PageOpts): string {
  const client = opts.reload ? CLIENT : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>${TOKENS}
${BASE}
${BAR}
${MAIN}</style>
</head>
<body>
<header class="hb-bar" data-state="disconnected">
  <a class="hb-wordmark" href="/" title="local serve root">htmlbin</a>
  <span class="hb-sep">/</span>
  <span class="hb-title">${escapeHtml(opts.path)}</span>
  <span class="hb-right">
    <span class="hb-chip hb-local-chip">local</span>
    <span class="hb-addr">${escapeHtml(opts.localAddr)}</span>
    <span class="hb-status"><span class="hb-dot"></span><span class="hb-label">disconnected</span></span>
  </span>
</header>
<main class="hb-main">
${opts.bodyHtml}
</main>
${client}
</body>
</html>
`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
