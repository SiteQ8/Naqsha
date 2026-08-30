// Sequence diagrams. Participants sit across the top, each with a lifeline
// running down the page, and messages are horizontal arrows ordered top to
// bottom in the order you wrote them, so the vertical axis is time. A message
// to and from the same participant draws as a small self loop, a dashed arrow
// reads as asynchronous or a return, and a note is a small box over a lifeline.
// Pure module, deterministic, shared by the command line and the browser.

import { palette } from "./theme.mjs";

const CHAR_W = 7.3;
const TOP = 24;
const MARGIN = 30;
const HEAD_H = 46;
const P_GAP = 54;
const MIN_PW = 96;
const MAX_PW = 240;
const FIRST = 42;
const STEP = 46;
const SELF_EXTRA = 22;
const NOTE_H = 30;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(label, w, per) {
  const max = Math.floor((w - 16) / (per || CHAR_W));
  return label.length <= max ? label : label.slice(0, Math.max(1, max - 1)) + "\u2026";
}
function pwidth(label) {
  return Math.max(MIN_PW, Math.min(MAX_PW, Math.round(label.length * CHAR_W + 30)));
}

export function layoutSequence(ir) {
  const participants = ir.participants.map((p) => ({ ...p, w: pwidth(p.label), h: HEAD_H }));
  const byId = {};
  let x = MARGIN;
  for (const p of participants) {
    p.x = x;
    p.y = TOP;
    p.cx = p.x + p.w / 2;
    p.lifeTop = TOP + HEAD_H;
    x += p.w + P_GAP;
    byId[p.id] = p;
  }
  const width = Math.round(x - P_GAP + MARGIN);

  const steps = [];
  let y = TOP + HEAD_H + FIRST;
  ir.steps.forEach((s, i) => {
    if (s.type === "note") {
      const p = byId[s.over] || participants[0];
      const w = Math.max(80, Math.min(220, Math.round(s.label.length * 6.6 + 26)));
      steps.push({ id: "s" + i, type: "note", over: s.over, label: s.label, x: p.cx - w / 2, y: y - 14, w, h: NOTE_H });
      y += NOTE_H + 16;
    } else if (s.self) {
      const p = byId[s.from] || participants[0];
      steps.push({ id: "s" + i, type: "message", from: s.from, to: s.to, label: s.label, dashed: !!s.dashed, self: true, cx: p.cx, y });
      y += STEP + SELF_EXTRA;
    } else {
      const a = byId[s.from], b = byId[s.to];
      steps.push({ id: "s" + i, type: "message", from: s.from, to: s.to, label: s.label, dashed: !!s.dashed, self: false, x1: a.cx, x2: b.cx, y });
      y += STEP;
    }
  });

  const lifeBottom = y - STEP + 34;
  for (const p of participants) p.lifeBottom = Math.max(lifeBottom, p.lifeTop + STEP);
  const height = Math.round(Math.max(lifeBottom, TOP + HEAD_H + STEP) + MARGIN);

  return { kind: "sequence", title: ir.title, width, height, participants, steps };
}

export function renderSequence(model, P) {
  P = P || palette("dark");
  const parts = [];
  parts.push(
    `<svg class="nq-svg" data-kind="sequence" viewBox="0 0 ${model.width} ${model.height}" ` +
    `xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">`
  );
  parts.push(
    `<defs>` +
    `<marker id="nq-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead" fill="${P.msg}"/></marker>` +
    `<marker id="nq-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,3 L0,6 Z" class="nq-arrowhead-hot" fill="${P.hot}"/></marker>` +
    `</defs>`
  );
  parts.push(`<g class="nq-viewport">`);

  for (const p of model.participants) {
    parts.push(`<line class="nq-lifeline" data-participant="${esc(p.id)}" stroke="${P.lifeline}" stroke-width="1.4" stroke-dasharray="4 5" x1="${p.cx}" y1="${p.lifeTop}" x2="${p.cx}" y2="${p.lifeBottom}"/>`);
  }

  for (const s of model.steps) {
    if (s.type === "note") {
      parts.push(
        `<g class="nq-note" data-note="${esc(s.over)}">` +
        `<rect class="nq-note-box" fill="${P.noteFill}" stroke="${P.groupStroke}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="4"/>` +
        `<text fill="${P.noteText}" font-size="11" x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 4}" text-anchor="middle">${esc(truncate(s.label, s.w, 6.6))}</text>` +
        `</g>`
      );
      continue;
    }
    if (s.self) {
      const r = 36;
      const d = `M ${s.cx} ${s.y} C ${s.cx + r} ${s.y - 2}, ${s.cx + r} ${s.y + 24}, ${s.cx} ${s.y + 22}`;
      parts.push(
        `<g class="nq-msg" data-msg="${s.id}" data-from="${esc(s.from)}" data-to="${esc(s.to)}">` +
        `<path class="nq-msg-path${s.dashed ? " nq-async" : ""}" stroke="${P.msg}" stroke-width="1.7"${s.dashed ? ' stroke-dasharray="6 4"' : ""} d="${d}" fill="none" marker-end="url(#nq-arrow)"/>` +
        (s.label ? `<text class="nq-self-label" fill="${P.edgeText}" font-size="11" x="${s.cx + r + 6}" y="${s.y + 14}">${esc(s.label)}</text>` : "") +
        `</g>`
      );
      continue;
    }
    const mid = (s.x1 + s.x2) / 2;
    const lw = s.label ? s.label.length * 6.6 + 10 : 0;
    parts.push(
      `<g class="nq-msg" data-msg="${s.id}" data-from="${esc(s.from)}" data-to="${esc(s.to)}">` +
      `<path class="nq-msg-path${s.dashed ? " nq-async" : ""}" stroke="${P.msg}" stroke-width="1.7"${s.dashed ? ' stroke-dasharray="6 4"' : ""} d="M ${s.x1} ${s.y} L ${s.x2} ${s.y}" fill="none" marker-end="url(#nq-arrow)"/>` +
      (s.label
        ? `<rect class="nq-msg-bg" fill="${P.edgeBg}" opacity="0.82" x="${mid - lw / 2}" y="${s.y - 20}" width="${lw}" height="16" rx="4"/>` +
          `<text fill="${P.edgeText}" font-size="11" x="${mid}" y="${s.y - 8}" text-anchor="middle">${esc(s.label)}</text>`
        : "") +
      `</g>`
    );
  }

  for (const p of model.participants) {
    parts.push(
      `<g class="nq-participant" data-participant="${esc(p.id)}">` +
      `<rect class="nq-pbox" fill="${P.nodeFill}" stroke="${P.nodeStroke}" stroke-width="1.5" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8"/>` +
      `<text class="nq-plabel" fill="${P.nodeText}" font-size="13" font-weight="500" x="${p.cx}" y="${p.y + p.h / 2 + 4}" text-anchor="middle">${esc(truncate(p.label, p.w))}</text>` +
      `</g>`
    );
  }

  parts.push(`</g></svg>`);
  return parts.join("");
}
