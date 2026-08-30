// The Naqsha engine: parse a source into IR, lay it out, render SVG. It picks the
// layout and renderer that match the diagram type. Pure and browser safe, shared
// by the command line and the playground so there is one implementation.
export { parse, validate, SHAPES } from "./parse.mjs";
export { layout } from "./layout.mjs";
export { renderSVG } from "./render.mjs";
export { layoutSequence, renderSequence } from "./sequence.mjs";
export { palette } from "./theme.mjs";
export { renderState, stateToGraph } from "./state.mjs";

import { parse } from "./parse.mjs";
import { layout } from "./layout.mjs";
import { renderSVG } from "./render.mjs";
import { layoutSequence, renderSequence } from "./sequence.mjs";
import { renderState, stateToGraph } from "./state.mjs";

export const VERSION = "0.3.0";

// source text -> { ir, model, svg }, dispatching on the diagram type
export function build(source) {
  const ir = parse(source);
  if (ir.type === "sequence") {
    const model = layoutSequence(ir);
    return { ir, model, svg: renderSequence(model) };
  }
  if (ir.type === "state") {
    const model = layout(stateToGraph(ir));
    model.kind = "state";
    model.initial = ir.initial;
    return { ir, model, svg: renderState(model) };
  }
  const model = layout(ir);
  return { ir, model, svg: renderSVG(model) };
}
