// Parse the Naqsha source language into a typed intermediate representation.
//
// The source is line based and reads close to plain notes. A diagram is a set
// of nodes, directed edges between them, and optional groups that box related
// nodes together. This module is pure: it uses no platform features, so the same
// code runs in Node for the command line and in the browser for the playground.
//
//   title Payments platform
//   direction LR
//
//   group edge "Edge"
//   node users "Users" shape=actor
//   node api "API gateway" group=edge
//   node db "PostgreSQL" shape=store
//
//   edge users -> api "requests"
//   edge api -> db "read and write"
//
// Anything after a hash is a comment. Labels are wrapped in double quotes.

export const SHAPES = ["box", "round", "store", "queue", "actor", "diamond"];

function tokenize(line) {
  const out = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    while (i < n && /\s/.test(line[i])) i++;
    if (i >= n) break;
    let tok = "";
    if (line[i] === '"') {
      i++;
      while (i < n && line[i] !== '"') { tok += line[i]; i++; }
      i++;
      out.push({ v: tok, quoted: true });
    } else {
      while (i < n && !/\s/.test(line[i])) { tok += line[i]; i++; }
      out.push({ v: tok, quoted: false });
    }
  }
  return out;
}

function opts(tokens) {
  // key=value tokens after the fixed positional ones
  const o = {};
  for (const t of tokens) {
    const s = t.v;
    const eq = s.indexOf("=");
    if (eq > 0 && !t.quoted) o[s.slice(0, eq).toLowerCase()] = s.slice(eq + 1);
  }
  return o;
}

export function parse(text) {
  const ir = {
    title: "",
    type: "graph",
    direction: "LR",
    nodes: [],
    edges: [],
    groups: [],
  };
  const nodeIds = new Set();
  const groupIds = new Set();
  const lines = String(text).split("\n");

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const tokens = tokenize(line);
    const head = tokens[0].v.toLowerCase();

    if (head === "title") {
      ir.title = line.slice(line.toLowerCase().indexOf("title") + 5).trim().replace(/^"|"$/g, "");
    } else if (head === "type") {
      ir.type = (tokens[1] ? tokens[1].v : "graph").toLowerCase();
    } else if (head === "direction" || head === "dir") {
      const d = (tokens[1] ? tokens[1].v : "LR").toUpperCase();
      ir.direction = d === "TB" || d === "TD" ? "TB" : "LR";
    } else if (head === "group") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: group needs an id`);
      const id = tokens[1].v;
      const label = tokens[2] && tokens[2].quoted ? tokens[2].v : id;
      if (!groupIds.has(id)) { groupIds.add(id); ir.groups.push({ id, label }); }
    } else if (head === "node") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: node needs an id`);
      const id = tokens[1].v;
      const label = tokens[2] && tokens[2].quoted ? tokens[2].v : id;
      const o = opts(tokens.slice(2));
      let shape = (o.shape || "box").toLowerCase();
      if (!SHAPES.includes(shape)) shape = "box";
      if (nodeIds.has(id)) {
        const existing = ir.nodes.find((x) => x.id === id);
        existing.label = label;
        existing.group = o.group || existing.group || "";
        existing.shape = shape;
      } else {
        nodeIds.add(id);
        ir.nodes.push({ id, label, group: o.group || "", shape });
      }
    } else if (head === "edge" || head === "link" || tokens.some((t) => t.v === "->")) {
      // support "edge a -> b" and the shorthand "a -> b"
      const arrow = tokens.findIndex((t) => t.v === "->");
      if (arrow < 1) throw new Error(`line ${ln + 1}: an edge needs 'a -> b'`);
      const from = tokens[arrow - 1].v;
      const to = tokens[arrow + 1] ? tokens[arrow + 1].v : "";
      if (!to) throw new Error(`line ${ln + 1}: an edge needs a target after '->'`);
      const label = tokens[arrow + 2] && tokens[arrow + 2].quoted ? tokens[arrow + 2].v : "";
      ir.edges.push({ from, to, label });
    } else {
      throw new Error(`line ${ln + 1}: unknown statement '${tokens[0].v}'`);
    }
  }

  // any node referenced by an edge but never declared becomes a plain node
  for (const e of ir.edges) {
    for (const id of [e.from, e.to]) {
      if (!nodeIds.has(id)) { nodeIds.add(id); ir.nodes.push({ id, label: id, group: "", shape: "box" }); }
    }
  }
  // drop group references that were never declared
  for (const nd of ir.nodes) {
    if (nd.group && !groupIds.has(nd.group)) nd.group = "";
  }
  return ir;
}

export function validate(ir) {
  const problems = [];
  const ids = new Set(ir.nodes.map((n) => n.id));
  for (const e of ir.edges) {
    if (!ids.has(e.from)) problems.push(`edge references unknown node '${e.from}'`);
    if (!ids.has(e.to)) problems.push(`edge references unknown node '${e.to}'`);
  }
  return problems;
}
