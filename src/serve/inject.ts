// Injected into raw .html files. Mirrors htmlbin.dev's .viewer-bar — the
// strip you see on every drop (htmlbin3/src/views/viewer.ts). Full-width,
// Geist sans for the title, mono for the meta column on the right.
// The `[local]` chip is the unambiguous "this isn't a published drop"
// signal, structured like the production .vchip version pill.

interface InjectOpts {
  reload: boolean;
  /** When false, the bar is skipped entirely. SSE reload still works. */
  overlay: boolean;
  /** Basename or relative path of the served file. */
  path: string;
  /** "localhost:62821". */
  localAddr: string;
}

// Scoped under .hb-bar. The `all: initial / unset` walls reset user styles
// so a page with aggressive global resets (e.g. * { margin: 0 } or a CSS
// framework) can't break our chrome.
const BAR_CSS = `
.hb-bar, .hb-bar * { all: unset; box-sizing: border-box; }
.hb-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid #E5E5E5;
  background: #FAFAFA;
  font-family: "Geist", -apple-system, "Inter", system-ui, sans-serif;
  font-size: 13px; line-height: 1.4;
  color: #0A0A0A;
  /* Fixed (not sticky): user body may have max-width/centering that
     would constrain the bar. Fixed escapes that flow entirely. */
  position: fixed; top: 0; left: 0; right: 0; width: 100%;
  z-index: 2147483647;
  flex-wrap: wrap;
  -webkit-font-smoothing: antialiased;
}
.hb-bar a { cursor: pointer; }
.hb-bar .hb-wordmark {
  color: #0A0A0A;
  text-decoration: underline; text-decoration-color: #E5E5E5;
  text-underline-offset: 3px; text-decoration-thickness: 1px;
}
.hb-bar .hb-wordmark:hover {
  color: #D93025; text-decoration-color: #D93025;
}
.hb-bar .hb-sep {
  color: #A3A3A3;
  font-family: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
.hb-bar .hb-title {
  font-weight: 600; font-size: 14px; color: #0A0A0A;
  flex: 0 1 auto; min-width: 0; max-width: 36vw;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: inline-block;
}
.hb-bar .hb-right {
  margin-left: auto; flex: 0 0 auto;
  display: inline-flex; align-items: center; gap: 14px;
  font-family: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px; color: #737373;
}
.hb-bar .hb-chip {
  display: inline-flex; align-items: center;
  background: #FAFAFA; border: 1px solid #E5E5E5;
  border-radius: 4px; padding: 3px 8px;
  font: 500 11.5px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color: #171717;
  letter-spacing: 0.02em;
}
.hb-bar .hb-chip.hb-local-chip {
  color: #D93025; border-color: #F4C7C3; background: #FCE8E6;
}
.hb-bar .hb-addr { color: #737373; }
.hb-bar .hb-status {
  display: inline-flex; align-items: center; gap: 6px;
  color: #737373;
}
.hb-bar .hb-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #A3A3A3; display: inline-block;
}
.hb-bar[data-state="connected"]    .hb-dot { background: #1F8F4A; }
.hb-bar[data-state="reconnecting"] .hb-dot { background: #B45309; }
.hb-bar .hb-close {
  color: #A3A3A3; cursor: pointer; padding: 2px 4px;
  font-size: 13px; line-height: 1;
  display: inline-block;
}
.hb-bar .hb-close:hover { color: #D93025; }
@media (max-width: 720px) {
  .hb-bar { gap: 10px; padding: 10px 14px; font-size: 12.5px; }
  .hb-bar .hb-title { max-width: none; flex: 1 1 0; min-width: 0; font-size: 13.5px; }
  .hb-bar .hb-right { width: 100%; margin-left: 0; gap: 12px; font-size: 11.5px; flex-wrap: wrap; }
}
@media (prefers-color-scheme: dark) {
  .hb-bar { background: #16161A; color: #FAFAFA; border-bottom-color: #2A2A30; }
  .hb-bar .hb-wordmark, .hb-bar .hb-title { color: #FAFAFA; }
  .hb-bar .hb-chip { background: #1F1F25; border-color: #2A2A30; color: #FAFAFA; }
}
`.replace(/\s+/g, " ").trim();

export function buildClientScript(opts: InjectOpts): string {
  if (!opts.reload && !opts.overlay) return "";

  const showBar = opts.overlay ? "true" : "false";
  const enableReload = opts.reload ? "true" : "false";
  const pathLit = JSON.stringify(opts.path);
  const addrLit = JSON.stringify(opts.localAddr);

  return `<style>${BAR_CSS}</style>
<script>(function(){
var showBar = ${showBar};
var enableReload = ${enableReload};
var bar = null;
function mount(){
  if(!showBar) return;
  bar = document.createElement("header");
  bar.className = "hb-bar";
  bar.setAttribute("data-state", "disconnected");
  bar.innerHTML =
    '<a class="hb-wordmark" href="/" title="local serve root">htmlbin</a>' +
    '<span class="hb-sep">/</span>' +
    '<span class="hb-title"></span>' +
    '<span class="hb-right">' +
      '<span class="hb-chip hb-local-chip">local</span>' +
      '<span class="hb-addr"></span>' +
      '<span class="hb-status"><span class="hb-dot"></span><span class="hb-label">disconnected</span></span>' +
      '<span class="hb-close" title="hide bar (this tab only)">×</span>' +
    '</span>';
  bar.querySelector(".hb-title").textContent = ${pathLit};
  bar.querySelector(".hb-addr").textContent = ${addrLit};
  bar.querySelector(".hb-close").addEventListener("click", function(){ bar.remove(); });
  document.body.insertBefore(bar, document.body.firstChild);
}
function setState(state, text){
  if(!bar) return;
  bar.setAttribute("data-state", state);
  var label = bar.querySelector(".hb-label");
  if(label) label.textContent = text;
}
function connect(){
  if(!enableReload) return;
  var es = new EventSource("/__hb/sse");
  es.addEventListener("open",  function(){ setState("connected", "connected"); });
  es.addEventListener("error", function(){ setState("reconnecting", "reconnecting"); });
  es.addEventListener("reload", function(){ location.reload(); });
}
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", function(){ mount(); connect(); });
} else { mount(); connect(); }
})();</script>`;
}

// Insert just before </body>. Fallback: append at end when no body tag.
export function injectIntoHtml(html: string, script: string): string {
  if (!script) return html;
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + script;
  return html.slice(0, idx) + script + html.slice(idx);
}
