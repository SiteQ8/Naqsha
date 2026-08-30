// The playground. Type a source on the left, get the live interactive diagram on
// the right, using the very same engine the command line uses. The viewer is
// re-initialized on each render and the previous one is torn down so nothing
// leaks while you type.
import { build } from "./engine.mjs";

const EXAMPLES = {
  sequence: `type sequence
title Checkout
participant user "User"
participant web "Web app"
participant pay "Payments"
participant bank "Bank"
user -> web "click pay"
web -> pay "create charge"
pay -> bank "authorize"
bank --> pay "approved"
pay --> web "charge ok"
web -> web "write order"
note over web "idempotent"
web --> user "receipt"`,
  payments: `title Payments platform
direction LR

group edge "Edge"
group core "Core services"

node users "Users" shape=actor
node cdn "CDN" group=edge
node api "API gateway" group=edge
node auth "Auth service" group=core
node orders "Orders service" group=core
node db "PostgreSQL" shape=store group=core
node cache "Redis" shape=store group=core
node bus "Event bus" shape=queue

edge users -> cdn "https"
edge cdn -> api "cache miss"
edge api -> auth "verify token"
edge api -> orders "place order"
edge orders -> db "read and write"
edge orders -> cache "read through"
edge orders -> bus "emit events"
edge bus -> orders "retry"`,
  cicd: `title CI and CD pipeline
direction LR

node dev "Developer" shape=actor
node pr "Pull request"
node build "Build"
node test "Test suite"
node scan "Security scan"
node stage "Staging"
node approve "Manual approval" shape=diamond
node prod "Production"
node rollback "Rollback" shape=diamond

edge dev -> pr "push"
edge pr -> build
edge build -> test
edge test -> scan
edge scan -> stage "deploy"
edge stage -> approve
edge approve -> prod "release"
edge prod -> rollback "on failure"
edge rollback -> stage "redeploy"`,
  rag: `title Retrieval pipeline
direction TB

node user "User" shape=actor
node app "Chat app"
node embed "Embed query"
node vec "Vector store" shape=store
node rerank "Reranker"
node llm "LLM"
node docs "Documents" shape=store

edge user -> app "question"
edge app -> embed
edge embed -> vec "similarity search"
edge vec -> rerank "candidates"
edge rerank -> llm "top context"
edge docs -> vec "indexed"
edge llm -> app "answer"
edge app -> user "reply"`,
};

const root = document.getElementById("nq-root");
const stage = document.getElementById("nq-stage");
const ta = document.getElementById("nq-source");
const err = document.getElementById("nq-error");
let api = null;

function render() {
  let result;
  try {
    result = build(ta.value);
  } catch (e) {
    err.textContent = e.message;
    err.style.display = "block";
    return;
  }
  err.style.display = "none";
  if (api) api.destroy();
  stage.innerHTML = result.svg;
  api = window.NaqshaViewer.init(root, result.model.adj, { name: "naqsha", keys: false, title: result.model.title || result.ir.title || "Diagram" });
}

let timer = null;
ta.addEventListener("input", function () {
  clearTimeout(timer);
  timer = setTimeout(render, 250);
});

// toolbar wiring
document.getElementById("nq-search").addEventListener("input", function (e) { if (api) api.search(e.target.value); });
document.getElementById("nq-theme").onclick = function () { if (api) api.toggleTheme(); };
document.getElementById("nq-zin").onclick = function () { if (api) api.zoomBy(1.15); };
document.getElementById("nq-zout").onclick = function () { if (api) api.zoomBy(1 / 1.15); };
document.getElementById("nq-zreset").onclick = function () { if (api) api.resetView(); };
document.getElementById("nq-svg").onclick = function () { if (api) api.exportSVG(); };
document.getElementById("nq-png").onclick = function () { if (api) api.exportPNG(); };
document.getElementById("nq-card").onclick = function () { if (api) api.exportCard(); };

// example switcher
for (const key of Object.keys(EXAMPLES)) {
  const btn = document.getElementById("ex-" + key);
  if (btn) btn.onclick = function () { ta.value = EXAMPLES[key]; render(); };
}

ta.value = EXAMPLES.payments;
render();

// let the version label fill in
const v = document.getElementById("nq-ver");
if (v) import("./engine.mjs").then((m) => (v.textContent = m.VERSION));
