// Render a laid out graph to SVG. The SVG carries data attributes (a node's id,
// an edge's endpoints) so the viewer can wire interaction without re-deriving the
// graph, and CSS classes so one stylesheet themes it in dark and light. It also
// writes literal colors from a palette as presentation attributes, which the
// stylesheet overrides when present and which let a stylesheet free copy, such as
// a share card, still render in any tool.

import { palette } from "./theme.mjs";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(label, w) {
  const max = Math.floor((w - 20) / 7.3);
  if (label.length <= max) return label;
  return label.slice(0, Math.max(1, max - 1)) + "\u2026";
}

function nodeShape(n, P) {
  const { x, y, w, h, shape } = n;
  const stroke = P.shape[shape] || P.nodeStroke;
  const base = `class="nq-shape" fill="${P.nodeFill}" stroke="${stroke}" stroke-width="1.5"`;
  if (shape === "round" || shape === "actor") {
    const r = h / 2;
    return `<rect ${base} x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"/>`;
  }
  if (shape === "store") {
    return `<rect ${base} x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6"/>` +
      `<path class="nq-shape-line" stroke="${stroke}" stroke-width="1.3" fill="none" d="M ${x + 6} ${y + 9} q ${(w - 12) / 2} 8 ${w - 12} 0"/>`;
  }
  if (shape === "queue") {
    return `<rect ${base} x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ry="6"/>` +
      `<line class="nq-shape-line" stroke="${stroke}" stroke-width="1.3" x1="${x + w - 12}" y1="${y}" x2="${x + w - 12}" y2="${y + h}"/>`;
  }
  if (shape === "diamond") {
    const cx = x + w / 2, cy = y + h / 2;
    return `<polygon ${base} points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}"/>`;
  }
  return `<rect ${base} x="${x}" y="${y}" width="${w}" height="${h}" rx="9" ry="9"/>`;
}

export function renderSVG(model, P) {
  P = P || palette("dark");
  const parts = [];
  parts.push(
    `<svg class="nq-svg" data-kind="graph" viewBox="0 0 ${model.width} ${model.height}" ` +
    `xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">`
  );
  parts.push(
    `<defs>` +
    `<marker id="nq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead" fill="${P.edge}"/></marker>` +
    `<marker id="nq-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead-hot" fill="${P.hot}"/></marker>` +
    `</defs>`
  );

  parts.push(`<g class="nq-viewport">`);

  for (const g of model.groups) {
    parts.push(
      `<g class="nq-group" data-group="${esc(g.id)}">` +
      `<rect class="nq-group-box" fill="${P.groupFill}" stroke="${P.groupStroke}" stroke-dasharray="5 4" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12"/>` +
      `<text class="nq-group-label" fill="${P.groupText}" font-size="11" font-weight="600" x="${g.x + 12}" y="${g.y + 16}">${esc(g.label)}</text>` +
      `</g>`
    );
  }

  for (const e of model.edges) {
    parts.push(
      `<g class="nq-edge" data-edge="${e.id}" data-from="${esc(e.from)}" data-to="${esc(e.to)}">` +
      `<path class="nq-edge-path" stroke="${P.edge}" stroke-width="1.6" d="${e.d}" fill="none" marker-end="url(#nq-arrow)"/>` +
      (e.label
        ? `<g class="nq-edge-label"><rect class="nq-edge-label-bg" fill="${P.edgeBg}" opacity="0.82" x="${e.mx - e.label.length * 3.4 - 5}" y="${e.my - 9}" width="${e.label.length * 6.8 + 10}" height="17" rx="4"/>` +
          `<text fill="${P.edgeText}" font-size="11" x="${e.mx}" y="${e.my + 3}" text-anchor="middle">${esc(e.label)}</text></g>`
        : "") +
      `</g>`
    );
  }

  for (const n of model.nodes) {
    parts.push(
      `<g class="nq-node" data-node="${esc(n.id)}" data-shape="${esc(n.shape)}">` +
      nodeShape(n, P) +
      `<text class="nq-node-label" fill="${P.nodeText}" font-size="13" font-weight="500" x="${n.cx}" y="${n.cy + 4}" text-anchor="middle">${esc(truncate(n.label, n.w))}</text>` +
      `</g>`
    );
  }

  parts.push(`</g></svg>`);
  return parts.join("");
}
