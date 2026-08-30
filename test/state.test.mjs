import { test } from "node:test";
import assert from "node:assert/strict";

import { parse, validate } from "../docs/app/parse.mjs";
import { stateToGraph, renderState } from "../docs/app/state.mjs";
import { layout } from "../docs/app/layout.mjs";
import { build } from "../docs/app/engine.mjs";

const ST = `type state
title Order lifecycle
direction LR
initial draft
state draft "Draft"
state submitted "Submitted"
final delivered "Delivered"
draft -> submitted "submit"
submitted -> delivered "deliver"
submitted -> draft "reject"`;

test("parse detects the state type", () => {
  const ir = parse(ST);
  assert.equal(ir.type, "state");
  assert.equal(ir.title, "Order lifecycle");
  assert.equal(ir.initial, "draft");
});

test("parse reads states, labels, and finals", () => {
  const ir = parse(ST);
  assert.equal(ir.states.length, 3);
  assert.equal(ir.states.find((s) => s.id === "delivered").final, true);
  assert.equal(ir.states.find((s) => s.id === "draft").final, false);
});

test("parse reads transitions with labels", () => {
  const ir = parse(ST);
  assert.equal(ir.transitions.length, 3);
  assert.deepEqual(ir.transitions[0], { from: "draft", to: "submitted", label: "submit", dashed: false });
});

test("final keyword on a state line marks it final", () => {
  const ir = parse('type state\nstate done "Done" final');
  assert.equal(ir.states[0].final, true);
});

test("a state seen only in a transition is auto created", () => {
  const ir = parse("type state\na -> b");
  assert.deepEqual(ir.states.map((s) => s.id), ["a", "b"]);
});

test("validate flags a transition to an unknown state", () => {
  const ir = { type: "state", states: [{ id: "a" }], transitions: [{ from: "a", to: "z" }], initial: "a" };
  assert.ok(validate(ir).some((p) => p.includes("z")));
});

test("validate flags an unknown initial state", () => {
  const ir = { type: "state", states: [{ id: "a" }], transitions: [], initial: "ghost" };
  assert.ok(validate(ir).some((p) => p.includes("ghost")));
});

test("stateToGraph maps states to nodes and transitions to edges", () => {
  const g = stateToGraph(parse(ST));
  assert.equal(g.nodes.length, 3);
  assert.equal(g.edges.length, 3);
  assert.equal(g.nodes.find((n) => n.id === "delivered").final, true);
});

test("build lays out a state machine and marks the kind", () => {
  const { ir, model, svg } = build(ST);
  assert.equal(ir.type, "state");
  assert.equal(model.kind, "state");
  assert.equal(model.initial, "draft");
  assert.ok(svg.includes('data-kind="state"'));
});

test("renderState draws the initial marker and final rings", () => {
  const m = layout(stateToGraph(parse(ST)));
  m.initial = "draft";
  const svg = renderState(m);
  assert.ok(svg.includes("nq-initial-dot"));
  assert.equal((svg.match(/nq-final-ring/g) || []).length, 1);
  assert.ok(svg.includes('data-node="draft"'));
});

test("the state machine remains a directed graph the viewer can trace", () => {
  const { model } = build(ST);
  assert.deepEqual(model.adj.out.draft, ["submitted"]);
  assert.deepEqual(model.adj.out.submitted.sort(), ["delivered", "draft"]);
});
