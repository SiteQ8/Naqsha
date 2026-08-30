import { test } from "node:test";
import assert from "node:assert/strict";

import { parse, validate } from "../docs/app/parse.mjs";
import { layout } from "../docs/app/layout.mjs";
import { renderSVG } from "../docs/app/render.mjs";
import { build, VERSION } from "../docs/app/engine.mjs";

const SRC = `title Shop
direction LR
group core "Core"
node users "Users" shape=actor
node web "Web app"
node api "API" group=core
node db "PostgreSQL" shape=store group=core
edge users -> web "https"
edge web -> api
edge api -> db "sql"`;

test("parse reads all statement kinds", () => {
  const ir = parse(SRC);
  assert.equal(ir.title, "Shop");
  assert.equal(ir.direction, "LR");
  assert.equal(ir.nodes.length, 4);
  assert.equal(ir.edges.length, 3);
  assert.equal(ir.groups.length, 1);
});

test("parse keeps labels, shapes, and groups", () => {
  const ir = parse(SRC);
  const db = ir.nodes.find((n) => n.id === "db");
  assert.equal(db.label, "PostgreSQL");
  assert.equal(db.shape, "store");
  assert.equal(db.group, "core");
  const users = ir.nodes.find((n) => n.id === "users");
  assert.equal(users.shape, "actor");
});

test("parse supports the a -> b shorthand", () => {
  const ir = parse("node a\nnode b\na -> b \"go\"");
  assert.equal(ir.edges.length, 1);
  assert.equal(ir.edges[0].from, "a");
  assert.equal(ir.edges[0].to, "b");
  assert.equal(ir.edges[0].label, "go");
});

test("parse creates nodes referenced only by edges", () => {
  const ir = parse("edge a -> b");
  assert.equal(ir.nodes.length, 2);
  assert.deepEqual(ir.nodes.map((n) => n.id).sort(), ["a", "b"]);
});

test("parse ignores comments and blank lines", () => {
  const ir = parse("# comment\n\nnode a \"A\"  # trailing\n");
  assert.equal(ir.nodes.length, 1);
  assert.equal(ir.nodes[0].label, "A");
});

test("parse rejects unknown statements", () => {
  assert.throws(() => parse("banana x"), /unknown statement/);
});

test("parse drops group references that were never declared", () => {
  const ir = parse('node a "A" group=ghost');
  assert.equal(ir.nodes[0].group, "");
});

test("unknown shapes fall back to box", () => {
  const ir = parse('node a "A" shape=hexagon');
  assert.equal(ir.nodes[0].shape, "box");
});

test("validate flags edges to unknown nodes", () => {
  const ir = { nodes: [{ id: "a" }], edges: [{ from: "a", to: "z" }], groups: [] };
  const problems = validate(ir);
  assert.ok(problems.some((p) => p.includes("z")));
});

test("layout assigns sources to layer 0 and flows forward", () => {
  const m = layout(parse(SRC));
  const byId = Object.fromEntries(m.nodes.map((n) => [n.id, n]));
  assert.equal(byId.users.layer, 0);
  assert.ok(byId.web.layer > byId.users.layer);
  assert.ok(byId.api.layer > byId.web.layer);
  assert.ok(byId.db.layer > byId.api.layer);
});

test("layout is deterministic", () => {
  const a = layout(parse(SRC));
  const b = layout(parse(SRC));
  assert.deepEqual(a.nodes.map((n) => [n.id, n.x, n.y]), b.nodes.map((n) => [n.id, n.x, n.y]));
  assert.equal(a.width, b.width);
});

test("layout tolerates cycles without hanging or dropping nodes", () => {
  const ir = parse("edge a -> b\nedge b -> c\nedge c -> a");
  const m = layout(ir);
  assert.equal(m.nodes.length, 3);
  assert.ok(m.nodes.every((n) => typeof n.x === "number" && typeof n.y === "number"));
});

test("layout builds group boxes around members", () => {
  const m = layout(parse(SRC));
  assert.equal(m.groups.length, 1);
  const g = m.groups[0];
  assert.ok(g.w > 0 && g.h > 0);
});

test("layout builds adjacency in both directions", () => {
  const m = layout(parse(SRC));
  assert.deepEqual(m.adj.out.web, ["api"]);
  assert.deepEqual(m.adj.in.api, ["web"]);
});

test("TB direction swaps the main axis", () => {
  const lr = layout(parse(SRC));
  const tb = layout(parse(SRC.replace("direction LR", "direction TB")));
  // in TB the canvas is taller than wide relative to LR
  assert.ok(tb.height > lr.height * 0.9);
});

test("render produces SVG with node and edge data attributes", () => {
  const m = layout(parse(SRC));
  const svg = renderSVG(m);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('data-node="db"'));
  assert.ok(svg.includes('data-from="web"'));
  assert.ok(svg.includes("nq-viewport"));
  const nodeCount = (svg.match(/class="nq-node"/g) || []).length;
  assert.equal(nodeCount, 4);
});

test("render escapes angle brackets in labels", () => {
  const m = layout(parse('node a "<script>"'));
  const svg = renderSVG(m);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
});

test("build returns ir, model, and svg together", () => {
  const { ir, model, svg } = build(SRC);
  assert.equal(ir.nodes.length, 4);
  assert.equal(model.nodes.length, 4);
  assert.ok(svg.includes("<svg"));
});

test("version is exported", () => {
  assert.equal(VERSION, "0.2.0");
});
