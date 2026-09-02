import { test } from "node:test";
import assert from "node:assert/strict";

import { parse, validate } from "../docs/app/parse.mjs";
import { layoutSequence, renderSequence } from "../docs/app/sequence.mjs";
import { build } from "../docs/app/engine.mjs";

const SEQ = `type sequence
title Checkout
participant user "User"
participant web "Web app"
participant pay "Payments"
user -> web "click pay"
web -> pay "charge"
pay --> web "ok"
web -> web "write order"
note over web "idempotent"
web --> user "receipt"`;

test("parse detects the sequence type", () => {
  const ir = parse(SEQ);
  assert.equal(ir.type, "sequence");
  assert.equal(ir.title, "Checkout");
});

test("parse reads participants in declaration order", () => {
  const ir = parse(SEQ);
  assert.deepEqual(ir.participants.map((p) => p.id), ["user", "web", "pay"]);
  assert.equal(ir.participants[1].label, "Web app");
});

test("parse reads messages and preserves order", () => {
  const ir = parse(SEQ);
  const msgs = ir.steps.filter((s) => s.type === "message");
  assert.equal(msgs.length, 5);
  assert.equal(msgs[0].from, "user");
  assert.equal(msgs[0].to, "web");
  assert.equal(msgs[0].label, "click pay");
});

test("parse marks dashed and self messages", () => {
  const ir = parse(SEQ);
  const msgs = ir.steps.filter((s) => s.type === "message");
  assert.equal(msgs[2].dashed, true); // pay --> web
  assert.equal(msgs[3].self, true); // web -> web
});

test("parse reads a note over a participant", () => {
  const ir = parse(SEQ);
  const note = ir.steps.find((s) => s.type === "note");
  assert.ok(note);
  assert.equal(note.over, "web");
  assert.equal(note.label, "idempotent");
});

test("parse auto declares a participant seen only in a message", () => {
  const ir = parse("type sequence\na -> b \"hi\"");
  assert.deepEqual(ir.participants.map((p) => p.id), ["a", "b"]);
});

test("validate flags a message to an unknown participant", () => {
  const ir = { type: "sequence", participants: [{ id: "a" }], steps: [{ type: "message", from: "a", to: "z" }] };
  assert.ok(validate(ir).some((p) => p.includes("z")));
});

test("layoutSequence places participants left to right", () => {
  const m = layoutSequence(parse(SEQ));
  const xs = m.participants.map((p) => p.x);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
  assert.ok(m.participants.every((p) => p.lifeBottom > p.lifeTop));
});

test("layoutSequence orders steps down the page", () => {
  const m = layoutSequence(parse(SEQ));
  const ys = m.steps.map((s) => s.y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1]);
});

test("layoutSequence is deterministic", () => {
  const a = layoutSequence(parse(SEQ));
  const b = layoutSequence(parse(SEQ));
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
});

test("renderSequence marks the kind and draws lifelines and messages", () => {
  const svg = renderSequence(layoutSequence(parse(SEQ)));
  assert.ok(svg.includes('data-kind="sequence"'));
  assert.equal((svg.match(/nq-lifeline/g) || []).length, 3);
  assert.equal((svg.match(/class="nq-msg"/g) || []).length, 5);
  assert.ok(svg.includes("nq-async")); // the dashed return
  assert.ok(svg.includes("nq-note"));
});

test("build dispatches to the sequence engine", () => {
  const { ir, model, svg } = build(SEQ);
  assert.equal(ir.type, "sequence");
  assert.equal(model.kind, "sequence");
  assert.ok(svg.includes('data-kind="sequence"'));
});

test("RL sequence puts the first participant on the right and mirrors messages", () => {
  const src = "type sequence\ndirection RL\nparticipant a \"Alpha\"\nparticipant b \"Beta\"\na -> b \"hello\"\nb -> b \"think\"";
  const lr = layoutSequence(parse(src.replace("direction RL\n", "")));
  const rl = layoutSequence(parse(src));
  assert.equal(rl.direction, "RL");
  assert.ok(rl.participants[0].cx > rl.participants[1].cx, "first participant is on the right");
  const mLr = lr.steps.find((s) => s.type === "message" && !s.self), mRl = rl.steps.find((s) => s.type === "message" && !s.self);
  assert.ok(Math.abs(mRl.x1 - (rl.width - mLr.x1)) < 0.01 && Math.abs(mRl.x2 - (rl.width - mLr.x2)) < 0.01, "message endpoints mirrored");
  const svg = renderSequence(rl);
  assert.ok(svg.includes('text-anchor="end"'), "self loop label anchors to the left in RL");
});
