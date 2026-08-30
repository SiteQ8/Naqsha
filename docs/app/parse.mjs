// Parse the Naqsha source language into a typed intermediate representation.
//
// A source is line based and reads close to plain notes. Two diagram types are
// supported. A graph is nodes, directed edges, and optional groups. A sequence
// is participants and an ordered list of messages between them, with time
// flowing down the page. The type is set with a `type` line and defaults to
// graph. This module is pure, so the same code runs in Node for the command
// line and in the browser for the playground.

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
  const o = {};
  for (const t of tokens) {
    const s = t.v;
    const eq = s.indexOf("=");
    if (eq > 0 && !t.quoted) o[s.slice(0, eq).toLowerCase()] = s.slice(eq + 1);
  }
  return o;
}

function directiveTitle(line) {
  return line.slice(line.toLowerCase().indexOf("title") + 5).trim().replace(/^"|"$/g, "");
}

function isArrow(v) { return v === "->" || v === "-->"; }

export function parse(text) {
  const lines = String(text).split("\n");
  let type = "graph";
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const t = tokenize(line);
    if (t[0].v.toLowerCase() === "type") type = (t[1] ? t[1].v : "graph").toLowerCase();
  }
  if (type === "sequence" || type === "seq") return parseSequence(lines);
  if (type === "state" || type === "lifecycle" || type === "statechart") return parseState(lines);
  return parseGraph(lines);
}

function parseGraph(lines) {
  const ir = { title: "", type: "graph", direction: "LR", nodes: [], edges: [], groups: [] };
  const nodeIds = new Set();
  const groupIds = new Set();

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].split("#")[0].trim();
    if (!line) continue;
    const tokens = tokenize(line);
    const head = tokens[0].v.toLowerCase();

    if (head === "title") ir.title = directiveTitle(line);
    else if (head === "type") { /* already resolved */ }
    else if (head === "direction" || head === "dir") {
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

  for (const e of ir.edges) {
    for (const id of [e.from, e.to]) {
      if (!nodeIds.has(id)) { nodeIds.add(id); ir.nodes.push({ id, label: id, group: "", shape: "box" }); }
    }
  }
  for (const nd of ir.nodes) if (nd.group && !groupIds.has(nd.group)) nd.group = "";
  return ir;
}

function parseSequence(lines) {
  const ir = { title: "", type: "sequence", participants: [], steps: [] };
  const pIds = new Set();
  const declare = (id, label) => {
    if (!pIds.has(id)) { pIds.add(id); ir.participants.push({ id, label: label || id }); }
    else if (label) { const p = ir.participants.find((x) => x.id === id); if (p) p.label = label; }
  };

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].split("#")[0].trim();
    if (!line) continue;
    const tokens = tokenize(line);
    const head = tokens[0].v.toLowerCase();

    if (head === "title") { ir.title = directiveTitle(line); continue; }
    if (head === "type" || head === "direction" || head === "dir") continue;

    if (head === "participant" || head === "actor") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: participant needs an id`);
      const id = tokens[1].v;
      const label = tokens[2] && tokens[2].quoted ? tokens[2].v : id;
      declare(id, label);
      continue;
    }
    if (head === "note") {
      // note over a "text"   or   note a "text"
      let idx = 1;
      if (tokens[1] && tokens[1].v.toLowerCase() === "over") idx = 2;
      const over = tokens[idx] ? tokens[idx].v : "";
      const label = tokens[idx + 1] && tokens[idx + 1].quoted ? tokens[idx + 1].v : (tokens[idx + 1] ? tokens[idx + 1].v : "");
      if (!over) throw new Error(`line ${ln + 1}: a note needs a participant`);
      declare(over);
      ir.steps.push({ type: "note", over, label });
      continue;
    }
    const arrowPos = tokens.findIndex((t) => isArrow(t.v));
    if (arrowPos >= 1) {
      const from = tokens[arrowPos - 1].v;
      const to = tokens[arrowPos + 1] ? tokens[arrowPos + 1].v : "";
      if (!to) throw new Error(`line ${ln + 1}: a message needs a target after the arrow`);
      const dashed = tokens[arrowPos].v === "-->";
      const label = tokens[arrowPos + 2] && tokens[arrowPos + 2].quoted ? tokens[arrowPos + 2].v : "";
      declare(from); declare(to);
      ir.steps.push({ type: "message", from, to, label, dashed, self: from === to });
      continue;
    }
    throw new Error(`line ${ln + 1}: unknown statement '${tokens[0].v}'`);
  }
  return ir;
}

function parseState(lines) {
  const ir = { title: "", type: "state", direction: "LR", states: [], transitions: [], initial: "" };
  const ids = new Set();
  const declare = (id, label, final) => {
    if (!ids.has(id)) { ids.add(id); ir.states.push({ id, label: label || id, final: !!final }); }
    else {
      const st = ir.states.find((x) => x.id === id);
      if (label) st.label = label;
      if (final) st.final = true;
    }
  };

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln].split("#")[0].trim();
    if (!line) continue;
    const tokens = tokenize(line);
    const head = tokens[0].v.toLowerCase();

    if (head === "title") { ir.title = directiveTitle(line); continue; }
    if (head === "type") continue;
    if (head === "direction" || head === "dir") {
      const d = (tokens[1] ? tokens[1].v : "LR").toUpperCase();
      ir.direction = d === "TB" || d === "TD" ? "TB" : "LR";
      continue;
    }
    if (head === "initial" || head === "start") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: initial needs a state id`);
      ir.initial = tokens[1].v;
      declare(tokens[1].v);
      continue;
    }
    if (head === "final" || head === "end") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: final needs a state id`);
      declare(tokens[1].v, tokens[2] && tokens[2].quoted ? tokens[2].v : "", true);
      continue;
    }
    if (head === "state") {
      if (tokens.length < 2) throw new Error(`line ${ln + 1}: state needs an id`);
      const id = tokens[1].v;
      const label = tokens[2] && tokens[2].quoted ? tokens[2].v : id;
      const isFinal = tokens.slice(2).some((t) => !t.quoted && t.v.toLowerCase() === "final");
      declare(id, label, isFinal);
      continue;
    }
    const arrowPos = tokens.findIndex((t) => isArrow(t.v));
    if (arrowPos >= 1) {
      const from = tokens[arrowPos - 1].v;
      const to = tokens[arrowPos + 1] ? tokens[arrowPos + 1].v : "";
      if (!to) throw new Error(`line ${ln + 1}: a transition needs a target after the arrow`);
      const dashed = tokens[arrowPos].v === "-->";
      const label = tokens[arrowPos + 2] && tokens[arrowPos + 2].quoted ? tokens[arrowPos + 2].v : "";
      declare(from); declare(to);
      ir.transitions.push({ from, to, label, dashed });
      continue;
    }
    throw new Error(`line ${ln + 1}: unknown statement '${tokens[0].v}'`);
  }
  return ir;
}

export function validate(ir) {
  const problems = [];
  if (ir.type === "sequence") {
    const ids = new Set(ir.participants.map((p) => p.id));
    for (const s of ir.steps) {
      if (s.type === "message") {
        if (!ids.has(s.from)) problems.push(`message references unknown participant '${s.from}'`);
        if (!ids.has(s.to)) problems.push(`message references unknown participant '${s.to}'`);
      }
    }
    return problems;
  }
  if (ir.type === "state") {
    const sids = new Set(ir.states.map((s) => s.id));
    for (const t of ir.transitions) {
      if (!sids.has(t.from)) problems.push(`transition references unknown state '${t.from}'`);
      if (!sids.has(t.to)) problems.push(`transition references unknown state '${t.to}'`);
    }
    if (ir.initial && !sids.has(ir.initial)) problems.push(`initial references unknown state '${ir.initial}'`);
    return problems;
  }
  const ids = new Set(ir.nodes.map((n) => n.id));
  for (const e of ir.edges) {
    if (!ids.has(e.from)) problems.push(`edge references unknown node '${e.from}'`);
    if (!ids.has(e.to)) problems.push(`edge references unknown node '${e.to}'`);
  }
  return problems;
}
