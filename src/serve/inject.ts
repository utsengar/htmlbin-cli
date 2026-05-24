// Injected into raw .html files. Mirrors htmlbin.dev's .viewer-bar — the
// strip you see on every drop (htmlbin3/src/views/viewer.ts). Full-width,
// Geist sans for the title, mono for the meta column on the right.
// The `[local]` chip is the unambiguous "this isn't a published drop"
// signal, structured like the production .vchip version pill.

interface InjectOpts {
  reload: boolean;
  /** When false, the bar is skipped entirely. SSE reload still works. */
  overlay: boolean;
  /** Basename or relative path of the served file (shown in the bar). */
  path: string;
  /** Absolute path used in the "publish" popover so the copied command
   *  works regardless of where it's pasted. Empty string hides the
   *  publish affordance (e.g. for non-publishable files). */
  publishPath: string;
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
.hb-bar .hb-publish {
  color: #737373; cursor: pointer; padding: 0;
  text-decoration: underline; text-decoration-color: #E5E5E5;
  text-underline-offset: 3px; text-decoration-thickness: 1px;
  transition: color 0.12s, text-decoration-color 0.12s;
}
.hb-bar .hb-publish:hover { color: #D93025; text-decoration-color: #D93025; }
.hb-pop {
  position: fixed; z-index: 2147483646;
  background: #FFFFFF; border: 1px solid #E5E5E5;
  border-radius: 6px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.16);
  padding: 14px; min-width: 360px; max-width: 540px;
  font-family: "Geist", -apple-system, "Inter", system-ui, sans-serif;
}
.hb-pop .hb-pop-label {
  display: block; margin: 0 0 8px;
  font: 500 10.5px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  color: #737373; letter-spacing: 0.08em; text-transform: uppercase;
}
.hb-pop .hb-pop-cmd {
  display: block; padding: 10px 12px; margin: 0 0 10px;
  background: #0A0A0A; color: #FAFAFA; border-radius: 4px;
  font: 13px/1.4 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  white-space: pre-wrap; word-break: break-all;
}
.hb-pop .hb-pop-copy {
  display: inline-flex; align-items: center; gap: 6px;
  background: #0A0A0A; color: #FAFAFA;
  border: 1px solid #0A0A0A;
  font: 500 12px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 8px 14px; border-radius: 4px; cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.hb-pop .hb-pop-copy:hover { background: #D93025; border-color: #D93025; }
.hb-pop .hb-pop-copy.ok { background: #1F8F4A; border-color: #1F8F4A; }
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
  const publishLit = JSON.stringify(opts.publishPath);

  return `<style>${BAR_CSS}</style>
<script>(function(){
var showBar = ${showBar};
var enableReload = ${enableReload};
var bar = null;
var publishPath = ${publishLit};
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
      (publishPath ? '<a class="hb-publish" href="javascript:void(0)" title="show publish command">publish →</a>' : '') +
    '</span>';
  bar.querySelector(".hb-title").textContent = ${pathLit};
  bar.querySelector(".hb-addr").textContent = ${addrLit};
  var pubLink = bar.querySelector(".hb-publish");
  if (pubLink) pubLink.addEventListener("click", openPopover);
  document.body.insertBefore(bar, document.body.firstChild);
  // Push the user's content down by the bar's height (preserving any
  // existing body padding). The bar is position:fixed so it floats over
  // the top of the page; without this, the first ~40px of the page is
  // hidden behind the bar.
  function syncPad(){
    var existing = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    var current = parseFloat(document.body.dataset.hbPadAdded || "0");
    var delta = bar.offsetHeight - current;
    if (delta === 0) return;
    document.body.style.paddingTop = (existing + delta) + "px";
    document.body.dataset.hbPadAdded = String(bar.offsetHeight);
  }
  syncPad();
  if (window.ResizeObserver) {
    new ResizeObserver(syncPad).observe(bar);
  } else {
    window.addEventListener("resize", syncPad);
  }
}
function openPopover(){
  closePopover();
  var pop = document.createElement("div");
  pop.className = "hb-pop";
  pop.innerHTML =
    '<span class="hb-pop-label">Publish to htmlbin</span>' +
    '<code class="hb-pop-cmd"></code>' +
    '<button type="button" class="hb-pop-copy">Copy command</button>';
  var cmd = "htmlbin publish " + publishPath;
  pop.querySelector(".hb-pop-cmd").textContent = cmd;
  var copyBtn = pop.querySelector(".hb-pop-copy");
  copyBtn.addEventListener("click", function(){
    var done = function(){
      copyBtn.classList.add("ok");
      copyBtn.textContent = "Copied";
      setTimeout(function(){ copyBtn.classList.remove("ok"); copyBtn.textContent = "Copy command"; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmd).then(done).catch(function(){
        legacyCopy(cmd); done();
      });
    } else {
      legacyCopy(cmd); done();
    }
  });
  document.body.appendChild(pop);
  // Position under the publish link (top-right). Fixed positioning so it
  // tracks the bar even if the page scrolls.
  var rect = bar.querySelector(".hb-publish").getBoundingClientRect();
  var popRect = pop.getBoundingClientRect();
  pop.style.top = (rect.bottom + 6) + "px";
  pop.style.left = Math.max(8, Math.min(window.innerWidth - popRect.width - 8, rect.right - popRect.width)) + "px";
  setTimeout(function(){
    document.addEventListener("click", outsideClose, true);
    document.addEventListener("keydown", escClose, true);
  }, 0);
}
function closePopover(){
  var existing = document.querySelector(".hb-pop");
  if (existing) existing.remove();
  document.removeEventListener("click", outsideClose, true);
  document.removeEventListener("keydown", escClose, true);
}
function outsideClose(e){
  var pop = document.querySelector(".hb-pop");
  if (!pop) return;
  if (pop.contains(e.target)) return;
  if (e.target.classList && e.target.classList.contains("hb-publish")) return;
  closePopover();
}
function escClose(e){
  if (e.key === "Escape") closePopover();
}
function legacyCopy(text){
  var ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch(e) {}
  document.body.removeChild(ta);
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
