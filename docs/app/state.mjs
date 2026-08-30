// Render a laid out state machine. States are nodes and transitions are edges,
// so this reuses the graph layout entirely; what is different is the drawing: a
// small filled dot with an arrow marks the initial state, a final state gets a
// second inner outline, and transitions carry their event labels. Because the
// shapes still use the node classes and data attributes, the viewer treats a
// state machine as a graph, so clicking a state traces every state reachable
// from it. Literal colors are written alongside the classes so a card renders
// anywhere.

import { palette } from "./theme.mjs";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(label, w) {
  const max = Math.floor((w - 20) / 7.3);
  return label.length <= max ? label : label.slice(0, Math.max(1, max - 1)) + "\u2026";
}

export function renderState(model, P) {
  P = P || palette("dark");
  const horizontal = model.direction !== "TB";
  const parts = [];
  parts.push(
    `<svg class="nq-svg" data-kind="state" viewBox="0 0 ${model.width} ${model.height}" ` +
    `xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">`
  );
  parts.push(
    `<defs>` +
    `<marker id="nq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead" fill="${P.edge}"/></marker>` +
    `<marker id="nq-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead-hot" fill="${P.hot}"/></marker>` +
    `</defs>`
  );
  parts.push(`<g class="nq-viewport">`);

  // transitions
  for (const e of model.edges) {
    parts.push(
      `<g class="nq-edge" data-edge="${e.id}" data-from="${esc(e.from)}" data-to="${esc(e.to)}">` +
      `<path class="nq-edge-path" stroke="${P.edge}" stroke-width="1.6"${e.dashed ? ' stroke-dasharray="6 4"' : ""} d="${e.d}" fill="none" marker-end="url(#nq-arrow)"/>` +
      (e.label
        ? `<g class="nq-edge-label"><rect class="nq-edge-label-bg" fill="${P.edgeBg}" opacity="0.82" x="${e.mx - e.label.length * 3.4 - 5}" y="${e.my - 9}" width="${e.label.length * 6.8 + 10}" height="17" rx="4"/>` +
          `<text fill="${P.edgeText}" font-size="11" x="${e.mx}" y="${e.my + 3}" text-anchor="middle">${esc(e.label)}</text></g>`
        : "") +
      `</g>`
    );
  }

  // initial marker: a dot with an arrow into the initial state
  const start = model.initial ? model.nodes.find((n) => n.id === model.initial) : null;
  if (start) {
    const r = 6;
    let dx, dy, ax, ay, tx, ty;
    if (horizontal) { dx = start.x - 26; dy = start.cy; ax = dx + r; ay = dy; tx = start.x; ty = start.cy; }
    else { dx = start.cx; dy = start.y - 26; ax = dx; ay = dy + r; tx = start.cx; ty = start.y; }
    parts.push(
      `<g class="nq-initial">` +
      `<circle class="nq-initial-dot" cx="${dx}" cy="${dy}" r="${r}" fill="${P.edge}"/>` +
      `<path class="nq-edge-path" stroke="${P.edge}" stroke-width="1.6" fill="none" marker-end="url(#nq-arrow)" d="M ${ax} ${ay} L ${tx} ${ty}"/>` +
      `</g>`
    );
  }

  // states
  for (const n of model.nodes) {
    const ring = n.final
      ? `<rect class="nq-final-ring" x="${n.x + 3}" y="${n.y + 3}" width="${n.w - 6}" height="${n.h - 6}" rx="8" fill="none" stroke="${P.nodeStroke}" stroke-width="1"/>`
      : "";
    parts.push(
      `<g class="nq-node" data-node="${esc(n.id)}" data-shape="round"${n.final ? ' data-final="1"' : ""}>` +
      `<rect class="nq-shape" fill="${P.nodeFill}" stroke="${P.nodeStroke}" stroke-width="1.5" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="11"/>` +
      ring +
      `<text class="nq-node-label" fill="${P.nodeText}" font-size="13" font-weight="500" x="${n.cx}" y="${n.cy + 4}" text-anchor="middle">${esc(truncate(n.label, n.w))}</text>` +
      `</g>`
    );
  }

  parts.push(`</g></svg>`);
  return parts.join("");
}

// convert a parsed state IR into the graph shape the layout understands
export function stateToGraph(ir) {
  return {
    title: ir.title,
    direction: ir.direction,
    nodes: ir.states.map((s) => ({ id: s.id, label: s.label, group: "", shape: "round", final: !!s.final })),
    edges: ir.transitions.map((t) => ({ from: t.from, to: t.to, label: t.label, dashed: !!t.dashed })),
    groups: [],
  };
}
