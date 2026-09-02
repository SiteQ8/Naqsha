import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The viewer is a plain browser script. It only attaches NaqshaViewer at load, so it
// can be evaluated in a bare context to test the pure helpers.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "docs", "app", "viewer.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const { ensureSvgNamespace } = ctx.NaqshaViewer;

const count = (s) => (s.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) || []).length;

test("adds the SVG namespace when the root has none", () => {
  const out = ensureSvgNamespace('<svg viewBox="0 0 10 10"><g/></svg>');
  assert.equal(count(out), 1);
  assert.match(out, /^<svg viewBox="0 0 10 10" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
});

test("does not duplicate the namespace when the root already has one", () => {
  // Regression: 0.6.0 exports carried xmlns twice, invalid XML that browsers would not
  // load as an image, which also silently broke the PNG export.
  const s = '<svg class="nq-svg" xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g/></svg>';
  assert.equal(ensureSvgNamespace(s), s);
  assert.equal(count(ensureSvgNamespace(s)), 1);
});

test("leaves the rest of the document untouched", () => {
  const s = '<svg viewBox="0 0 1 1"><rect xmlns="http://www.w3.org/2000/svg"/></svg>';
  const out = ensureSvgNamespace(s);
  assert.ok(out.endsWith('<rect xmlns="http://www.w3.org/2000/svg"/></svg>'));
});
