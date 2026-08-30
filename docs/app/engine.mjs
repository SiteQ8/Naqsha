// The Naqsha engine: parse a source into IR, lay it out, render SVG. Pure and
// browser safe, shared by the command line and the playground so there is one
// implementation and nothing to keep in sync.
export { parse, validate, SHAPES } from "./parse.mjs";
export { layout } from "./layout.mjs";
export { renderSVG } from "./render.mjs";

import { parse } from "./parse.mjs";
import { layout } from "./layout.mjs";
import { renderSVG } from "./render.mjs";

export const VERSION = "0.1.0";

// convenience: source text -> { model, svg }
export function build(source) {
  const ir = parse(source);
  const model = layout(ir);
  const svg = renderSVG(model);
  return { ir, model, svg };
}
