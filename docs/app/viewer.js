/* The Naqsha viewer. Plain browser script, no modules and no dependencies, so it
   drops straight into a generated standalone file and also runs the playground.
   It turns a rendered SVG plus an adjacency map into something you can explore:
   pan and zoom, click a node to trace what it reaches upstream and downstream,
   search, switch theme, and export a clean SVG or PNG. */
(function (global) {
  "use strict";

  function reach(adj, seed, dir) {
    // breadth first over the adjacency in one direction
    const seen = new Set();
    const stack = [seed];
    const table = dir === "in" ? adj.in : adj.out;
    while (stack.length) {
      const cur = stack.pop();
      for (const next of table[cur] || []) {
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    return seen;
  }

  // A standalone SVG needs exactly one xmlns on its root. The rendered element already
  // carries one when serialized, so add it only when it is missing: a duplicate makes
  // the file invalid XML, and browsers then refuse to load it as an image, which broke
  // both the SVG and the PNG export.
  function ensureSvgNamespace(s) {
    return /^<svg[^>]*\sxmlns=/.test(s) ? s : s.replace(/^<svg([^>]*)>/, '<svg$1 xmlns="http://www.w3.org/2000/svg">');
  }

  function init(root, adj, opts) {
    opts = opts || {};
    adj = adj || { out: {}, in: {} };
    const svg = root.querySelector(".nq-svg");
    const vp = root.querySelector(".nq-viewport");
    if (!svg || !vp) return null;
    const kind = svg.getAttribute("data-kind") || "graph";

    const state = { x: 0, y: 0, k: 1 };
    function apply() {
      vp.setAttribute("transform", "translate(" + state.x + "," + state.y + ") scale(" + state.k + ")");
    }

    // pan by dragging the background
    let dragging = false, sx = 0, sy = 0;
    svg.addEventListener("mousedown", function (e) {
      if (e.target.closest(".nq-node")) return; // clicks on nodes focus instead
      dragging = true; sx = e.clientX - state.x; sy = e.clientY - state.y;
      svg.style.cursor = "grabbing";
    });
    const onMove = function (e) {
      if (!dragging) return;
      state.x = e.clientX - sx; state.y = e.clientY - sy; apply();
    };
    const onUp = function () { dragging = false; svg.style.cursor = ""; };
    global.addEventListener("mousemove", onMove);
    global.addEventListener("mouseup", onUp);

    // zoom around the cursor
    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nk = Math.max(0.2, Math.min(4, state.k * factor));
      // keep the point under the cursor fixed
      state.x = mx - (mx - state.x) * (nk / state.k);
      state.y = my - (my - state.y) * (nk / state.k);
      state.k = nk; apply();
    }, { passive: false });

    function zoomBy(f) {
      const rect = svg.getBoundingClientRect();
      const mx = rect.width / 2, my = rect.height / 2;
      const nk = Math.max(0.2, Math.min(4, state.k * f));
      state.x = mx - (mx - state.x) * (nk / state.k);
      state.y = my - (my - state.y) * (nk / state.k);
      state.k = nk; apply();
    }
    function resetView() { state.x = 0; state.y = 0; state.k = 1; apply(); }

    // focus a node and light up its reach
    let focused = null;
    function clearFocus() {
      focused = null;
      svg.classList.remove("nq-focusing");
      svg.querySelectorAll(".nq-hot, .nq-seed").forEach(function (el) { el.classList.remove("nq-hot", "nq-seed"); });
      svg.querySelectorAll(".nq-edge-path, .nq-msg-path").forEach(function (p) { p.setAttribute("marker-end", "url(#nq-arrow)"); });
    }
    function focusSequence(id) {
      const hot = new Set([id]);
      svg.querySelectorAll(".nq-msg").forEach(function (el) {
        const f = el.getAttribute("data-from"), t = el.getAttribute("data-to");
        if (f === id || t === id) { hot.add(f); hot.add(t); }
      });
      svg.querySelectorAll(".nq-msg").forEach(function (el) {
        const f = el.getAttribute("data-from"), t = el.getAttribute("data-to");
        if (f === id || t === id) el.classList.add("nq-hot");
      });
      svg.querySelectorAll(".nq-participant").forEach(function (el) {
        const pid = el.getAttribute("data-participant");
        if (pid === id) el.classList.add("nq-hot", "nq-seed");
        else if (hot.has(pid)) el.classList.add("nq-hot");
      });
      svg.querySelectorAll(".nq-lifeline").forEach(function (el) {
        if (hot.has(el.getAttribute("data-participant"))) el.classList.add("nq-hot");
      });
    }
    function focusGraph(id) {
      const up = reach(adj, id, "in");
      const down = reach(adj, id, "out");
      const hot = new Set([id]);
      up.forEach((n) => hot.add(n));
      down.forEach((n) => hot.add(n));
      svg.querySelectorAll(".nq-node").forEach(function (el) {
        const nid = el.getAttribute("data-node");
        if (nid === id) el.classList.add("nq-hot", "nq-seed");
        else if (hot.has(nid)) el.classList.add("nq-hot");
      });
      svg.querySelectorAll(".nq-edge").forEach(function (el) {
        const f = el.getAttribute("data-from"), t = el.getAttribute("data-to");
        const p = el.querySelector(".nq-edge-path");
        if (hot.has(f) && hot.has(t)) {
          el.classList.add("nq-hot");
          if (p) p.setAttribute("marker-end", "url(#nq-arrow-hot)");
        } else if (p) p.setAttribute("marker-end", "url(#nq-arrow)");
      });
    }
    function focus(id) {
      clearSearch();
      if (focused === id) { clearFocus(); return; }
      clearFocus();
      focused = id;
      svg.classList.add("nq-focusing");
      if (kind === "sequence") focusSequence(id);
      else focusGraph(id);
    }
    svg.querySelectorAll("[data-node],[data-participant]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        focus(el.getAttribute("data-node") || el.getAttribute("data-participant"));
      });
    });
    svg.addEventListener("click", function (e) { if (!e.target.closest("[data-node],[data-participant]")) clearFocus(); });

    // search by label
    function clearSearch() {
      svg.classList.remove("nq-searching");
      svg.querySelectorAll(".nq-match").forEach(function (el) { el.classList.remove("nq-match"); });
    }
    function search(term) {
      clearFocus();
      term = (term || "").trim().toLowerCase();
      if (!term) { clearSearch(); return 0; }
      let count = 0;
      svg.querySelectorAll(".nq-node, .nq-participant").forEach(function (el) {
        const labelEl = el.querySelector(".nq-node-label, .nq-plabel");
        const label = (labelEl && labelEl.textContent) || "";
        const id = el.getAttribute("data-node") || el.getAttribute("data-participant") || "";
        const hit = label.toLowerCase().indexOf(term) >= 0 || id.toLowerCase().indexOf(term) >= 0;
        if (hit) { el.classList.add("nq-match"); count++; } else el.classList.remove("nq-match");
      });
      svg.classList.add("nq-searching");
      return count;
    }

    // theme
    function toggleTheme() {
      root.classList.toggle("nq-light");
    }
    function setTheme(t) {
      if (t === "light") root.classList.add("nq-light");
      else root.classList.remove("nq-light");
    }
    function setMode(mode) {
      svg.classList.remove("nq-mode-before", "nq-mode-after", "nq-mode-delta");
      svg.classList.add("nq-mode-" + (mode || "delta"));
    }
    let flowing = false;
    function setFlow(on) { flowing = !!on; if (flowing) svg.classList.add("nq-flow"); else svg.classList.remove("nq-flow"); }
    function toggleFlow() { setFlow(!flowing); return flowing; }

    // export: inline computed styles onto a clone so the SVG stands alone
    function standaloneSVG() {
      const clone = svg.cloneNode(true);
      const cvp = clone.querySelector(".nq-viewport");
      if (cvp) cvp.removeAttribute("transform"); // export the whole diagram
      clone.querySelectorAll(".nq-hot, .nq-seed, .nq-match").forEach(function (el) {
        el.classList.remove("nq-hot", "nq-seed", "nq-match");
      });
      clone.classList.remove("nq-focusing", "nq-searching");
      // copy geometry
      const vb = svg.getAttribute("viewBox").split(/\s+/);
      const w = Math.round(parseFloat(vb[2])), h = Math.round(parseFloat(vb[3]));
      clone.setAttribute("width", w);
      clone.setAttribute("height", h);
      // walk both trees and copy a small set of presentation styles
      const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity",
        "font-size", "font-weight", "font-family", "letter-spacing", "text-transform"];
      const srcEls = svg.querySelectorAll("*");
      const dstEls = clone.querySelectorAll("*");
      for (let i = 0; i < srcEls.length; i++) {
        const cs = global.getComputedStyle(srcEls[i]);
        const d = dstEls[i];
        if (!d || !cs) continue;
        for (const p of props) {
          const val = cs.getPropertyValue(p);
          if (val && val !== "none" && val !== "normal") d.setAttribute(p, val);
        }
      }
      const bg = global.getComputedStyle(svg).getPropertyValue("background-color") ||
        global.getComputedStyle(root).getPropertyValue("--nq-bg");
      const rect = '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + (bg || "#0f1420").trim() + '"/>';
      let s = ensureSvgNamespace(clone.outerHTML);
      s = s.replace(/(<g class="nq-viewport)/, rect + "$1");
      return { svg: s, w: w, h: h };
    }
    function download(name, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    function exportSVG() {
      const { svg: s } = standaloneSVG();
      download((opts.name || "naqsha") + ".svg", new Blob([s], { type: "image/svg+xml" }));
    }
    function exportPNG() {
      const { svg: s, w, h } = standaloneSVG();
      const scale = 2;
      const img = new Image();
      const blobUrl = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = w * scale; canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) { download((opts.name || "naqsha") + ".png", blob); });
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    }
    function exportCard() {
      // compose the diagram onto a 1200 by 630 card, the size link previews expect
      const { svg: s, w, h } = standaloneSVG();
      const light = root.classList.contains("nq-light");
      const c = light
        ? { bg: "#f6f8fc", text: "#1a2333", dim: "#5a6b86", accent: "#12a594", line: "#dbe3ef" }
        : { bg: "#0f1420", text: "#e8edf6", dim: "#93a1ba", accent: "#3fd6c8", line: "#26314a" };
      const W = 1200, H = 630, PAD = 56;
      const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
      const title = opts.title || "Diagram";
      const kind = (svg.getAttribute("data-kind") === "sequence" ? "sequence diagram" : "architecture diagram").toUpperCase();
      const areaX = PAD, areaY = 120, areaW = W - 2 * PAD, areaH = H - areaY - 64;
      const img = new Image();
      const blobUrl = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" }));
      img.onload = function () {
        const canvas = document.createElement("canvas");
        canvas.width = W * 2; canvas.height = H * 2;
        const ctx = canvas.getContext("2d");
        ctx.scale(2, 2);
        ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
        ctx.fillStyle = c.dim; ctx.font = "600 15px " + FONT; ctx.fillText(kind, PAD, 56);
        ctx.fillStyle = c.text; ctx.font = "700 34px " + FONT; ctx.fillText(title, PAD, 96);
        ctx.strokeStyle = c.line; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD, 112); ctx.lineTo(W - PAD, 112); ctx.stroke();
        const scale = Math.min(areaW / w, areaH / h);
        const dw = w * scale, dh = h * scale;
        ctx.drawImage(img, areaX + (areaW - dw) / 2, areaY + (areaH - dh) / 2, dw, dh);
        ctx.fillStyle = c.accent; ctx.font = "600 19px " + FONT; ctx.textAlign = "right";
        ctx.fillText("Naqsha", W - PAD, H - 32);
        canvas.toBlob(function (blob) { download((opts.name || "naqsha") + "-card.png", blob); });
        URL.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    }

    const api = { zoomBy, resetView, focus, clearFocus, search, clearSearch, toggleTheme, setTheme, setMode, setFlow, toggleFlow, exportSVG, exportPNG, exportCard, state };

    // keyboard shortcuts when this viewer owns the page (standalone file)
    let onKey = null;
    if (opts.keys) {
      onKey = function (e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
          if (e.key === "Escape") { e.target.blur(); clearSearch(); }
          return;
        }
        if (e.key === "t" || e.key === "T") toggleTheme();
        else if (e.key === "f" || e.key === "F") toggleFlow();
        else if (e.key === "+" || e.key === "=") zoomBy(1.15);
        else if (e.key === "-") zoomBy(1 / 1.15);
        else if (e.key === "0") resetView();
        else if (e.key === "Escape") { clearFocus(); clearSearch(); }
        else if (e.key === "/") {
          const box = document.querySelector(".nq-search");
          if (box) { e.preventDefault(); box.focus(); }
        }
      };
      global.addEventListener("keydown", onKey);
    }
    api.destroy = function () {
      global.removeEventListener("mousemove", onMove);
      global.removeEventListener("mouseup", onUp);
      if (onKey) global.removeEventListener("keydown", onKey);
    };
    return api;
  }

  global.NaqshaViewer = { init: init, ensureSvgNamespace: ensureSvgNamespace };
})(typeof window !== "undefined" ? window : this);
