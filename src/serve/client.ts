// Bar runtime + styles. Served as static assets at
//   GET /__hb/client.css
//   GET /__hb/client.js
// instead of injected inline, so pages with CSP `script-src 'self'`
// (or `style-src 'self'`) accept them. The injected HTML just has
// <link> and <script src> tags pointing here — see inject.ts.
//
// All visual properties carry `!important` so user CSS like
// `* { all: revert !important }` can't override our positioning.
// The bar is appended to `document.documentElement` rather than
// `document.body` so a user-level `body { transform / filter / ... }`
// (which creates a containing block) can't trap our `position: fixed`.

export const CLIENT_CSS = `
.hb-bar, .hb-bar * { all: unset !important; box-sizing: border-box !important; }
.hb-bar {
  display: flex !important; align-items: center !important; gap: 14px !important;
  padding: 10px 18px !important;
  border-bottom: 1px solid #E5E5E5 !important;
  background: #FAFAFA !important;
  font-family: "Geist", -apple-system, "Inter", system-ui, sans-serif !important;
  font-size: 13px !important; line-height: 1.4 !important;
  color: #0A0A0A !important;
  position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
  width: 100% !important; z-index: 2147483647 !important;
  flex-wrap: wrap !important;
  -webkit-font-smoothing: antialiased !important;
}
.hb-bar a { cursor: pointer !important; }
.hb-bar .hb-wordmark {
  color: #0A0A0A !important;
  text-decoration: underline !important; text-decoration-color: #E5E5E5 !important;
  text-underline-offset: 3px !important; text-decoration-thickness: 1px !important;
}
.hb-bar .hb-wordmark:hover { color: #D93025 !important; text-decoration-color: #D93025 !important; }
.hb-bar .hb-sep {
  color: #A3A3A3 !important;
  font-family: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace !important;
}
.hb-bar .hb-title {
  font-weight: 600 !important; font-size: 14px !important; color: #0A0A0A !important;
  flex: 0 1 auto !important; min-width: 0 !important; max-width: 36vw !important;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;
  display: inline-block !important;
}
.hb-bar .hb-right {
  margin-left: auto !important; flex: 0 0 auto !important;
  display: inline-flex !important; align-items: center !important; gap: 14px !important;
  font-family: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace !important;
  font-size: 12px !important; color: #737373 !important;
}
.hb-bar .hb-chip {
  display: inline-flex !important; align-items: center !important;
  background: #FAFAFA !important; border: 1px solid #E5E5E5 !important;
  border-radius: 4px !important; padding: 3px 8px !important;
  font: 500 11.5px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace !important;
  color: #171717 !important;
  letter-spacing: 0.02em !important;
}
.hb-bar .hb-chip.hb-local-chip {
  color: #D93025 !important; border-color: #F4C7C3 !important; background: #FCE8E6 !important;
}
.hb-bar .hb-addr { color: #737373 !important; }
.hb-bar .hb-status {
  display: inline-flex !important; align-items: center !important; gap: 6px !important;
  color: #737373 !important;
}
.hb-bar .hb-dot {
  width: 7px !important; height: 7px !important; border-radius: 50% !important;
  background: #A3A3A3 !important; display: inline-block !important;
}
.hb-bar[data-state="connected"]    .hb-dot { background: #1F8F4A !important; }
.hb-bar[data-state="reconnecting"] .hb-dot { background: #B45309 !important; }
.hb-bar .hb-publish {
  color: #737373 !important; cursor: pointer !important; padding: 0 !important;
  text-decoration: underline !important; text-decoration-color: #E5E5E5 !important;
  text-underline-offset: 3px !important; text-decoration-thickness: 1px !important;
}
.hb-bar .hb-publish:hover { color: #D93025 !important; text-decoration-color: #D93025 !important; }
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
  background: #0A0A0A; color: #FAFAFA; border: 1px solid #0A0A0A;
  font: 500 12px/1 "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 8px 14px; border-radius: 4px; cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.hb-pop .hb-pop-copy:hover { background: #D93025; border-color: #D93025; }
.hb-pop .hb-pop-copy.ok { background: #1F8F4A; border-color: #1F8F4A; }
@media (max-width: 720px) {
  .hb-bar { gap: 10px !important; padding: 10px 14px !important; font-size: 12.5px !important; }
  .hb-bar .hb-title { max-width: none !important; flex: 1 1 0 !important; min-width: 0 !important; font-size: 13.5px !important; }
  .hb-bar .hb-right { width: 100% !important; margin-left: 0 !important; gap: 12px !important; font-size: 11.5px !important; flex-wrap: wrap !important; }
}
@media (prefers-color-scheme: dark) {
  .hb-bar { background: #16161A !important; color: #FAFAFA !important; border-bottom-color: #2A2A30 !important; }
  .hb-bar .hb-wordmark, .hb-bar .hb-title { color: #FAFAFA !important; }
  .hb-bar .hb-chip { background: #1F1F25 !important; border-color: #2A2A30 !important; color: #FAFAFA !important; }
}
`;

export const CLIENT_JS = `(function(){
  // Pull config off our own <script src="...">'s query string. Avoids
  // inline-script CSP violations (the script is same-origin so 'self'
  // covers it).
  var thisScript = document.currentScript || document.querySelector('script[src*="/__hb/client.js"]');
  var src = thisScript ? thisScript.src : "";
  var params = new URL(src, location.origin).searchParams;
  var showBar = params.get("overlay") === "1";
  var enableReload = params.get("reload") === "1";
  var pathStr = params.get("path") || "";
  var addrStr = params.get("addr") || "";
  var publishPath = params.get("publish") || "";

  var bar = null;

  function mount(){
    if (!showBar) return;
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
        (publishPath ? '<a class="hb-publish" href="javascript:void(0)" title="show publish command">publish &rarr;</a>' : '') +
      '</span>';
    bar.querySelector(".hb-title").textContent = pathStr;
    bar.querySelector(".hb-addr").textContent = addrStr;
    var pubLink = bar.querySelector(".hb-publish");
    if (pubLink) pubLink.addEventListener("click", openPopover);
    // documentElement (not body): position:fixed resolves to viewport
    // even if user CSS sets body { transform / filter / will-change /
    // perspective } (any of which would otherwise create a containing
    // block and trap our bar inside body's box).
    document.documentElement.appendChild(bar);
    syncPad();
    if (window.ResizeObserver) new ResizeObserver(syncPad).observe(bar);
    else window.addEventListener("resize", syncPad);
  }

  function syncPad(){
    if (!bar || !document.body) return;
    var existing = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    var current  = parseFloat(document.body.dataset.hbPadAdded || "0");
    var h = bar.offsetHeight;
    var delta = h - current;
    if (delta === 0) return;
    document.body.style.paddingTop = (existing + delta) + "px";
    document.body.dataset.hbPadAdded = String(h);
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
        setTimeout(function(){
          copyBtn.classList.remove("ok");
          copyBtn.textContent = "Copy command";
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(done).catch(function(){ legacyCopy(cmd); done(); });
      } else {
        legacyCopy(cmd); done();
      }
    });
    document.documentElement.appendChild(pop);
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
  function escClose(e){ if (e.key === "Escape") closePopover(); }

  function legacyCopy(text){
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function setState(state, text){
    if (!bar) return;
    bar.setAttribute("data-state", state);
    var label = bar.querySelector(".hb-label");
    if (label) label.textContent = text;
  }

  function connect(){
    if (!enableReload) return;
    var es = new EventSource("/__hb/sse");
    es.addEventListener("open",  function(){ setState("connected", "connected"); });
    es.addEventListener("error", function(){ setState("reconnecting", "reconnecting"); });
    es.addEventListener("reload", function(){ location.reload(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ mount(); connect(); });
  } else {
    mount(); connect();
  }
})();`;
