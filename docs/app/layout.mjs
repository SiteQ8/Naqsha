// Lay out a graph as layers, the way a person draws an architecture: sources on
// one side, what they depend on flowing to the other, related things lined up so
// the arrows read cleanly. This is a compact layered layout in the spirit of the
// Sugiyama method: break cycles, assign each node to a layer by its longest path,
// order nodes within a layer to reduce crossings, then place and route.
//
// Pure module. Deterministic: the same source always produces the same drawing.

const CHAR_W = 7.3;
const PAD_X = 30;
const MIN_W = 92;
const MAX_W = 264;
const NODE_H = 48;
const LAYER_GAP = 78;
const NODE_GAP = 28;
const MARGIN = 40;

function nodeWidth(label) {
  return Math.max(MIN_W, Math.min(MAX_W, Math.round(label.length * CHAR_W + PAD_X)));
}

function breakCycles(ids, out) {
  // DFS, marking edges that point back to a node still on the stack. Those are
  // reversed for the purpose of layering so the graph becomes acyclic.
  const state = {}; // 0 unvisited, 1 on stack, 2 done
  const back = new Set();
  ids.forEach((id) => (state[id] = 0));
  const visit = (u) => {
    state[u] = 1;
    for (const v of out[u] || []) {
      if (state[v] === 1) back.add(u + "\u0000" + v);
      else if (state[v] === 0) visit(v);
    }
    state[u] = 2;
  };
  for (const id of ids) if (state[id] === 0) visit(id);
  return back;
}

function assignLayers(ids, edges, back) {
  const preds = {};
  const succ = {};
  ids.forEach((id) => { preds[id] = []; succ[id] = []; });
  for (const e of edges) {
    let a = e.from, b = e.to;
    if (a === b) continue; // self loops do not constrain layering
    if (back.has(a + "\u0000" + b)) { const t = a; a = b; b = t; } // reversed
    succ[a].push(b);
    preds[b].push(a);
  }
  // Kahn topological order on the acyclic graph
  const indeg = {};
  ids.forEach((id) => (indeg[id] = preds[id].length));
  const queue = ids.filter((id) => indeg[id] === 0);
  const order = [];
  while (queue.length) {
    const u = queue.shift();
    order.push(u);
    for (const v of succ[u]) { indeg[v]--; if (indeg[v] === 0) queue.push(v); }
  }
  // any leftover from a residual cycle: append so nothing is lost
  for (const id of ids) if (!order.includes(id)) order.push(id);

  const layer = {};
  ids.forEach((id) => (layer[id] = 0));
  for (const u of order) {
    for (const v of succ[u]) layer[v] = Math.max(layer[v], layer[u] + 1);
  }
  return { layer, preds, succ };
}

function orderWithinLayers(layersArr, preds, succ, groupIndex) {
  // barycenter sweeps, biased so nodes in the same group stay adjacent
  const indexOf = {};
  const reindex = () => layersArr.forEach((L) => L.forEach((id, i) => (indexOf[id] = i)));
  reindex();
  const bary = (id, neighbors) => {
    const ns = neighbors[id];
    if (!ns || !ns.length) return indexOf[id];
    let s = 0;
    for (const n of ns) s += indexOf[n];
    return s / ns.length;
  };
  const sortLayer = (L, neighbors) => {
    const keyed = L.map((id) => ({
      id,
      g: groupIndex[id] != null ? groupIndex[id] : 999,
      b: bary(id, neighbors),
    }));
    keyed.sort((p, q) => (p.g - q.g) || (p.b - q.b));
    return keyed.map((k) => k.id);
  };
  for (let pass = 0; pass < 4; pass++) {
    for (let k = 1; k < layersArr.length; k++) layersArr[k] = sortLayer(layersArr[k], preds);
    reindex();
    for (let k = layersArr.length - 2; k >= 0; k--) layersArr[k] = sortLayer(layersArr[k], succ);
    reindex();
  }
  return layersArr;
}

export function layout(ir) {
  const horizontal = ir.direction !== "TB"; // LR by default
  const nodes = ir.nodes.map((n) => ({ ...n, w: nodeWidth(n.label), h: NODE_H }));
  const byId = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const ids = nodes.map((n) => n.id);
  const out = {};
  ids.forEach((id) => (out[id] = []));
  for (const e of ir.edges) if (byId[e.from] && byId[e.to] && e.from !== e.to) out[e.from].push(e.to);

  const groupIndex = {};
  const gi = {}, parentOf = {};
  ir.groups.forEach((g, i) => { gi[g.id] = i; parentOf[g.id] = g.parent || ""; });
  const rootOf = (id) => { let cur = id, hops = 0; while (parentOf[cur] && hops < 64) { cur = parentOf[cur]; hops++; } return cur; };
  nodes.forEach((n) => (groupIndex[n.id] = n.group ? gi[rootOf(n.group)] * 1000 + gi[n.group] : null));

  const back = breakCycles(ids, out);
  const { layer, preds, succ } = assignLayers(ids, ir.edges, back);

  const maxLayer = ids.reduce((m, id) => Math.max(m, layer[id]), 0);
  const layersArr = [];
  for (let k = 0; k <= maxLayer; k++) layersArr.push([]);
  // initial order: stable by declaration
  ids.forEach((id) => layersArr[layer[id]].push(id));
  orderWithinLayers(layersArr, preds, succ, groupIndex);

  // cross axis size per layer, and the largest so we can center
  const layerCross = layersArr.map((L) => {
    let total = 0;
    for (const id of L) total += (horizontal ? byId[id].h : byId[id].w) + NODE_GAP;
    return Math.max(0, total - NODE_GAP);
  });
  const crossMax = Math.max(1, ...layerCross);

  // main axis position per layer (columns for LR, rows for TB)
  const layerMainSize = layersArr.map((L) => {
    let m = 0;
    for (const id of L) m = Math.max(m, horizontal ? byId[id].w : byId[id].h);
    return m;
  });
  const layerMainStart = [];
  let acc = MARGIN;
  for (let k = 0; k <= maxLayer; k++) {
    layerMainStart[k] = acc;
    acc += layerMainSize[k] + LAYER_GAP;
  }

  // place nodes
  layersArr.forEach((L, k) => {
    let cross = MARGIN + (crossMax - layerCross[k]) / 2;
    for (const id of L) {
      const n = byId[id];
      if (horizontal) {
        n.x = layerMainStart[k] + (layerMainSize[k] - n.w) / 2;
        n.y = cross;
        cross += n.h + NODE_GAP;
      } else {
        n.y = layerMainStart[k] + (layerMainSize[k] - n.h) / 2;
        n.x = cross;
        cross += n.w + NODE_GAP;
      }
      n.cx = n.x + n.w / 2;
      n.cy = n.y + n.h / 2;
      n.layer = k;
    }
  });

  // extra room so self loops (which bow right) and back edges (which bow past
  // the nodes) stay inside the canvas
  const EXTRA = 52;
  const width = (horizontal ? acc - LAYER_GAP : MARGIN + crossMax) + MARGIN + EXTRA;
  const height = (horizontal ? MARGIN + crossMax : acc - LAYER_GAP) + MARGIN + EXTRA;
  const H = Math.round(height), Wd = Math.round(width);

  // route edges
  const edges = ir.edges
    .filter((e) => byId[e.from] && byId[e.to])
    .map((e, i) => {
      const a = byId[e.from], b = byId[e.to];
      let d, mx, my;
      if (e.from === e.to) {
        // self loop on the leading edge
        const r = 18;
        const sx = a.x + a.w, sy = a.cy - 8;
        d = `M ${sx} ${sy} C ${sx + r * 2} ${sy - r}, ${sx + r * 2} ${a.cy + r + 8}, ${sx} ${a.cy + 8}`;
        mx = sx + r * 1.7; my = a.cy;
      } else if (horizontal) {
        const forward = b.x >= a.x + a.w;
        const sx = forward ? a.x + a.w : a.x + a.w;
        const sy = a.cy;
        const tx = forward ? b.x : b.x + b.w;
        const ty = b.cy;
        const dx = Math.abs(tx - sx);
        const off = Math.max(30, dx * 0.45);
        if (forward) {
          d = `M ${sx} ${sy} C ${sx + off} ${sy}, ${tx - off} ${ty}, ${tx} ${ty}`;
        } else {
          // back edge: bow outward below the nodes
          const bowY = Math.min(H - 14, Math.max(a.cy, b.cy) + 46);
          d = `M ${a.x + a.w} ${a.cy} C ${a.x + a.w + off} ${bowY}, ${b.x + b.w + off} ${bowY}, ${b.x + b.w} ${b.cy}`;
        }
        mx = (sx + tx) / 2;
        my = forward ? (sy + ty) / 2 : Math.min(H - 10, Math.max(a.cy, b.cy) + 34);
      } else {
        const forward = b.y >= a.y + a.h;
        const sx = a.cx, sy = forward ? a.y + a.h : a.y + a.h;
        const tx = b.cx, ty = forward ? b.y : b.y + b.h;
        const dy = Math.abs(ty - sy);
        const off = Math.max(30, dy * 0.45);
        if (forward) {
          d = `M ${sx} ${sy} C ${sx} ${sy + off}, ${tx} ${ty - off}, ${tx} ${ty}`;
        } else {
          const bowX = Math.min(Wd - 14, Math.max(a.cx, b.cx) + 46);
          d = `M ${a.cx} ${a.y + a.h} C ${bowX} ${a.y + a.h + off}, ${bowX} ${b.y + b.h + off}, ${b.cx} ${b.y + b.h}`;
        }
        my = (sy + ty) / 2;
        mx = forward ? (sx + tx) / 2 : Math.min(Wd - 10, Math.max(a.cx, b.cx) + 34);
      }
      return { ...e, d, mx, my, id: "e" + i };
    });

  // group boxes: the bounding box of a group's own nodes and its child groups, built from the
  // deepest groups up, so a parent wraps its children with room for every label
  const depthOf = (g) => { let d = 0, cur = g.parent, hops = 0; const pm = {}; ir.groups.forEach((x) => (pm[x.id] = x.parent || "")); while (cur && hops < 64) { d++; cur = pm[cur]; hops++; } return d; };
  const boxes = {};
  const ordered = ir.groups.map((g) => ({ g, depth: depthOf(g) })).sort((a, b) => b.depth - a.depth);
  for (const { g, depth } of ordered) {
    const members = nodes.filter((n) => n.group === g.id).map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h }));
    const kids = ir.groups.filter((c) => c.parent === g.id && boxes[c.id]).map((c) => boxes[c.id]);
    const all = members.concat(kids);
    if (!all.length) continue;
    const pad = 18;
    const x0 = Math.min(...all.map((m) => m.x)) - pad;
    const y0 = Math.min(...all.map((m) => m.y)) - pad - 14;
    const x1 = Math.max(...all.map((m) => m.x + m.w)) + pad;
    const y1 = Math.max(...all.map((m) => m.y + m.h)) + pad;
    boxes[g.id] = { ...g, depth, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // parents first, so children draw on top of them
  const groups = ir.groups.map((g) => boxes[g.id]).filter(Boolean).sort((a, b) => a.depth - b.depth);

  // adjacency for the viewer (reach tracing)
  const adjOut = {}, adjIn = {};
  ids.forEach((id) => { adjOut[id] = []; adjIn[id] = []; });
  for (const e of ir.edges) {
    if (byId[e.from] && byId[e.to]) { adjOut[e.from].push(e.to); adjIn[e.to].push(e.from); }
  }

  // right to left: mirror the finished left to right layout across the vertical axis,
  // so the reading order suits Arabic, Hebrew, and Persian labels
  if (ir.direction === "RL") mirrorHorizontal(nodes, edges, groups, Wd);

  return {
    title: ir.title,
    direction: ir.direction,
    nodes,
    edges,
    groups,
    width: Wd,
    height: H,
    adj: { out: adjOut, in: adjIn },
  };
}

// mirror every x coordinate across the drawing width, paths included
export function mirrorPath(d, W) {
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => {
    const v = parseFloat(m);
    const out = i % 2 === 0 ? W - v : v;
    i++;
    return String(Math.round(out * 100) / 100);
  });
}

export function mirrorHorizontal(nodes, edges, groups, W) {
  for (const n of nodes) { n.x = W - n.x - n.w; n.cx = n.x + n.w / 2; }
  for (const g of groups) g.x = W - g.x - g.w;
  for (const e of edges) { e.d = mirrorPath(e.d, W); e.mx = W - e.mx; }
}
