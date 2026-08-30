#!/usr/bin/env node
// The Naqsha command line. Turn a source file into a self contained interactive
// diagram, print an example to start from, or serve the browser playground.
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, resolve, basename } from "node:path";
import { createServer } from "node:http";

import { parse, validate } from "../docs/app/parse.mjs";
import { layout } from "../docs/app/layout.mjs";
import { renderSVG } from "../docs/app/render.mjs";
import { toHTML } from "./html.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const VERSION = "0.1.0";

const EXAMPLE = `title Payments platform
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
edge bus -> orders "retry"
`;

function usage() {
  process.stdout.write(
`Naqsha ${VERSION}
Turn a text description of a system into a self contained interactive diagram.

Usage:
  naqsha render <source> [-o out.html] [--theme dark|light]   build a diagram
  naqsha example [-o file.naqsha]                             print a starter source
  naqsha serve [--port 8300] [--open]                         run the browser playground
  naqsha version

Source format (a .naqsha file):
  title My system
  direction LR                 LR (default) or TB
  group core "Core"            an optional box around related nodes
  node api "API" group=core    shape= box round store queue actor diamond
  edge api -> db "queries"     a directed connection with an optional label
`);
}

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function cmdRender(args) {
  const src = args[0];
  if (!src || src.startsWith("-")) { console.error("naqsha: render needs a source file"); return 2; }
  if (!existsSync(src)) { console.error("naqsha: no such file: " + src); return 2; }
  let ir;
  try {
    ir = parse(readFileSync(src, "utf8"));
  } catch (e) {
    console.error("naqsha: could not read the source: " + e.message);
    return 2;
  }
  const problems = validate(ir);
  for (const p of problems) console.error("warning: " + p);
  const model = layout(ir);
  const svg = renderSVG(model);
  const theme = argValue(args, "--theme") === "light" ? "light" : "dark";
  const html = toHTML(model, svg, { theme });
  const out = argValue(args, "-o") || argValue(args, "--output") ||
    join(dirname(resolve(src)), basename(src).replace(/\.[^.]+$/, "") + ".html");
  writeFileSync(out, html);
  console.log("wrote " + out + "  (" + model.nodes.length + " nodes, " + model.edges.length + " edges)");
  return 0;
}

function cmdExample(args) {
  const out = argValue(args, "-o") || argValue(args, "--output");
  if (out) { writeFileSync(out, EXAMPLE); console.log("wrote " + out); }
  else process.stdout.write(EXAMPLE);
  return 0;
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".naqsha": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};

function cmdServe(args) {
  const docs = join(ROOT, "docs");
  const port = parseInt(argValue(args, "--port") || "8300", 10);
  const server = createServer(function (req, res) {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/" || p === "") p = "/index.html";
    const full = join(docs, p.replace(/^\/+/, ""));
    if (!full.startsWith(docs) || !existsSync(full) || !statSync(full).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found"); return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[extname(full).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(full).pipe(res);
  });
  server.listen(port, "127.0.0.1", function () {
    const url = "http://127.0.0.1:" + port + "/";
    console.log("Naqsha playground at " + url + "  (Ctrl+C to stop)");
    if (args.includes("--open")) {
      import("node:child_process").then(function (cp) {
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        try { cp.spawn(cmd, [url], { stdio: "ignore", detached: true }); } catch (e) {}
      });
    }
  });
  return 0;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "render") return cmdRender(args);
  if (cmd === "example") return cmdExample(args);
  if (cmd === "serve") return cmdServe(args);
  if (cmd === "version" || cmd === "--version" || cmd === "-v") { console.log("naqsha " + VERSION); return 0; }
  if (cmd === "help" || cmd === "--help" || cmd === "-h" || !cmd) { usage(); return 0; }
  console.error("naqsha: unknown command '" + cmd + "'");
  usage();
  return 2;
}

const code = main();
if (code && code !== 0 && !process.argv.includes("serve")) process.exit(code);
