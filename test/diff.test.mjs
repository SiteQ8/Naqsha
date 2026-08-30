import { test } from "node:test";
import assert from "node:assert/strict";

import { parse } from "../docs/app/parse.mjs";
import { diffGraphs, renderDiff } from "../docs/app/diff.mjs";
import { layout } from "../docs/app/layout.mjs";
import { buildDiff } from "../docs/app/engine.mjs";

const V1 = `title P
node a "A"
node b "B"
node c "C"
edge a -> b "one"
edge b -> c`;

const V2 = `title P
node a "A"
node b "Bee"
node d "D"
edge a -> b "one"
edge b -> d`;

test("diffGraphs classifies added, removed, changed, and kept nodes", () => {
  const ir = diffGraphs(parse(V1), parse(V2));
  const status = Object.fromEntries(ir.nodes.map((n) => [n.id, n.status]));
  assert.equal(status.a, "kept");
  assert.equal(status.b, "changed"); // B -> Bee
  assert.equal(status.c, "removed");
  assert.equal(status.d, "added");
});

test("diffGraphs classifies edges", () => {
  const ir = diffGraphs(parse(V1), parse(V2));
  const byKey = Object.fromEntries(ir.edges.map((e) => [e.from + e.to, e.status]));
  assert.equal(byKey.ab, "kept"); // a->b same label
  assert.equal(byKey.bc, "removed");
  assert.equal(byKey.bd, "added");
});

test("a changed node keeps the after label", () => {
  const ir = diffGraphs(parse(V1), parse(V2));
  assert.equal(ir.nodes.find((n) => n.id === "b").label, "Bee");
});

test("diff refuses non graph sources", () => {
  const seq = parse("type sequence\na -> b");
  assert.throws(() => diffGraphs(seq, parse(V2)), /supports graph/);
});

test("buildDiff lays out the union and marks the kind", () => {
  const { model, svg } = buildDiff(V1, V2);
  assert.equal(model.kind, "diff");
  // union: a, b, c, d = 4 nodes
  assert.equal(model.nodes.length, 4);
  assert.ok(svg.includes('data-kind="diff"'));
  assert.ok(svg.includes("nq-mode-delta"));
});

test("renderDiff writes a status on every node and edge", () => {
  const ir = diffGraphs(parse(V1), parse(V2));
  const svg = renderDiff(layout(ir));
  assert.ok(svg.includes('data-status="added"'));
  assert.ok(svg.includes('data-status="removed"'));
  assert.ok(svg.includes('data-status="changed"'));
  assert.ok(svg.includes('data-status="kept"'));
});
