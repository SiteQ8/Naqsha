// Assemble one self contained HTML file: the diagram, the stylesheet, and the
// viewer all inlined, with a small bootstrap that wires the toolbar. The result
// opens anywhere with no server and no network. Node only, because it reads the
// shared assets from disk; the engine it renders with is the same one the
// browser uses.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "docs", "app");

function slug(s) {
  return (s || "naqsha").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "naqsha";
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toHTML(model, svg, options) {
  options = options || {};
  const css = readFileSync(join(APP, "styles.css"), "utf8");
  const viewer = readFileSync(join(APP, "viewer.js"), "utf8");
  const title = model.title || options.title || "Naqsha diagram";
  const name = slug(title);
  const light = options.theme === "light";
  const adj = JSON.stringify(model.adj);

  const toolbar = `
    <div class="nq-toolbar">
      <span class="nq-title">${esc(title)}</span>
      <input id="nq-search" class="nq-search" type="text" placeholder="Search nodes  /" spellcheck="false">
      <button class="nq-btn" id="nq-theme" title="Toggle theme (T)">Theme</button>
      <button class="nq-btn" id="nq-zout" title="Zoom out (-)">&#8722;</button>
      <button class="nq-btn" id="nq-zin" title="Zoom in (+)">&#43;</button>
      <button class="nq-btn" id="nq-zreset" title="Reset view (0)">Reset</button>
      <button class="nq-btn" id="nq-svg" title="Export SVG">SVG</button>
      <button class="nq-btn" id="nq-png" title="Export PNG">PNG</button>
      <span class="nq-spacer"></span>
      <span class="nq-hint">click a node to trace its reach</span>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="generator" content="Naqsha">
<style>
html,body{margin:0;height:100%}
body{background:var(--nq-bg);color:var(--nq-text);font:14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:12px}
${css}
</style>
</head>
<body>
<div id="nq-root" class="nq-app${light ? " nq-light" : ""}">
${toolbar}
<div class="nq-stage">${svg}</div>
</div>
<script>${viewer}</script>
<script>
(function(){
  var adj = ${adj};
  var root = document.getElementById("nq-root");
  var api = window.NaqshaViewer.init(root, adj, { keys: true, name: ${JSON.stringify(name)} });
  if(!api) return;
  var s = document.getElementById("nq-search");
  s.addEventListener("input", function(e){ api.search(e.target.value); });
  document.getElementById("nq-theme").onclick = function(){ api.toggleTheme(); };
  document.getElementById("nq-zin").onclick = function(){ api.zoomBy(1.15); };
  document.getElementById("nq-zout").onclick = function(){ api.zoomBy(1/1.15); };
  document.getElementById("nq-zreset").onclick = function(){ api.resetView(); };
  document.getElementById("nq-svg").onclick = function(){ api.exportSVG(); };
  document.getElementById("nq-png").onclick = function(){ api.exportPNG(); };
})();
</script>
</body>
</html>`;
}
