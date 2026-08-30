// Compare two snapshots of a graph and render the difference. Nodes are matched
// by id and edges by their endpoints. Each element is added (only in the after
// snapshot), removed (only in the before snapshot), changed (present in both but
// with a different label), or kept. The union of both snapshots is laid out once
// so the picture is stable, and each element carries its status as a data
// attribute and a literal color, which lets the viewer switch between a before,
// an after, and a delta view, and lets a card render the delta anywhere.

import { palette } from "./theme.mjs";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(label, w) {
  const max = Math.floor((w - 20) / 7.3);
  return label.length <= max ? label : label.slice(0, Math.max(1, max - 1)) + "\u2026";
}

export function diffGraphs(before, after) {
  if (before.type !== "graph" || after.type !== "graph") {
    throw new Error("diff supports graph diagrams; both sources must be graphs");
  }
  const bN = new Map(before.nodes.map((n) => [n.id, n]));
  const aN = new Map(after.nodes.map((n) => [n.id, n]));
  const nodes = [];
  for (const id of new Set([...bN.keys(), ...aN.keys()])) {
    const b = bN.get(id), a = aN.get(id);
    let status, src;
    if (a && b) { status = a.label !== b.label ? "changed" : "kept"; src = a; }
    else if (a) { status = "added"; src = a; }
    else { status = "removed"; src = b; }
    nodes.push({ id, label: src.label, group: src.group, shape: src.shape, status });
  }

  const key = (e) => e.from + "\u0000" + e.to;
  const bE = new Map(before.edges.map((e) => [key(e), e]));
  const aE = new Map(after.edges.map((e) => [key(e), e]));
  const edges = [];
  for (const k of new Set([...bE.keys(), ...aE.keys()])) {
    const b = bE.get(k), a = aE.get(k);
    let status, src;
    if (a && b) { status = (a.label || "") !== (b.label || "") ? "changed" : "kept"; src = a; }
    else if (a) { status = "added"; src = a; }
    else { status = "removed"; src = b; }
    edges.push({ from: src.from, to: src.to, label: src.label, status });
  }

  const groups = [];
  const seen = new Set();
  for (const g of [...after.groups, ...before.groups]) if (!seen.has(g.id)) { seen.add(g.id); groups.push(g); }

  return {
    title: after.title || before.title,
    direction: after.direction || before.direction,
    nodes,
    edges,
    groups,
  };
}

function shapePath(n, stroke, P) {
  const { x, y, w, h, shape } = n;
  const base = `class="nq-shape" fill="${P.nodeFill}" stroke="${stroke}" stroke-width="1.6"`;
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

export function renderDiff(model, P) {
  P = P || palette("dark");
  const statusStroke = { added: P.added, removed: P.removed, changed: P.changed };
  const parts = [];
  parts.push(
    `<svg class="nq-svg nq-mode-delta" data-kind="diff" viewBox="0 0 ${model.width} ${model.height}" ` +
    `xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">`
  );
  parts.push(
    `<defs>` +
    `<marker id="nq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead" fill="${P.edge}"/></marker>` +
    `<marker id="nq-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead-hot" fill="${P.hot}"/></marker>` +
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
    const stroke = statusStroke[e.status] || P.edge;
    const dash = e.status === "removed" ? ' stroke-dasharray="5 4"' : "";
    parts.push(
      `<g class="nq-edge" data-edge="${e.id}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-status="${e.status}">` +
      `<path class="nq-edge-path" stroke="${stroke}" stroke-width="1.7"${dash} d="${e.d}" fill="none" marker-end="url(#nq-arrow)"/>` +
      (e.label
        ? `<g class="nq-edge-label"><rect class="nq-edge-label-bg" fill="${P.edgeBg}" opacity="0.82" x="${e.mx - e.label.length * 3.4 - 5}" y="${e.my - 9}" width="${e.label.length * 6.8 + 10}" height="17" rx="4"/>` +
          `<text fill="${P.edgeText}" font-size="11" x="${e.mx}" y="${e.my + 3}" text-anchor="middle">${esc(e.label)}</text></g>`
        : "") +
      `</g>`
    );
  }

  for (const n of model.nodes) {
    const stroke = statusStroke[n.status] || P.shape[n.shape] || P.nodeStroke;
    parts.push(
      `<g class="nq-node" data-node="${esc(n.id)}" data-shape="${esc(n.shape)}" data-status="${n.status}">` +
      shapePath(n, stroke, P) +
      `<text class="nq-node-label" fill="${P.nodeText}" font-size="13" font-weight="500" x="${n.cx}" y="${n.cy + 4}" text-anchor="middle">${esc(truncate(n.label, n.w))}</text>` +
      `</g>`
    );
  }

  parts.push(`</g></svg>`);
  return parts.join("");
}
