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

  function init(root, adj, opts) {
    opts = opts || {};
    const svg = root.querySelector(".nq-svg");
    const vp = root.querySelector(".nq-viewport");
    if (!svg || !vp) return null;

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
    }
    function focus(id) {
      clearSearch();
      if (focused === id) { clearFocus(); return; }
      clearFocus();
      focused = id;
      const up = reach(adj, id, "in");
      const down = reach(adj, id, "out");
      const hot = new Set([id]);
      up.forEach((n) => hot.add(n));
      down.forEach((n) => hot.add(n));
      svg.classList.add("nq-focusing");
      svg.querySelectorAll(".nq-node").forEach(function (el) {
        const nid = el.getAttribute("data-node");
        if (nid === id) el.classList.add("nq-hot", "nq-seed");
        else if (hot.has(nid)) el.classList.add("nq-hot");
      });
      svg.querySelectorAll(".nq-edge").forEach(function (el) {
        const f = el.getAttribute("data-from"), t = el.getAttribute("data-to");
        if (hot.has(f) && hot.has(t)) {
          el.classList.add("nq-hot");
          const p = el.querySelector(".nq-edge-path");
          if (p) p.setAttribute("marker-end", "url(#nq-arrow-hot)");
        } else {
          const p = el.querySelector(".nq-edge-path");
          if (p) p.setAttribute("marker-end", "url(#nq-arrow)");
        }
      });
    }
    svg.querySelectorAll(".nq-node").forEach(function (el) {
      el.addEventListener("click", function (e) { e.stopPropagation(); focus(el.getAttribute("data-node")); });
    });
    svg.addEventListener("click", function (e) { if (!e.target.closest(".nq-node")) clearFocus(); });

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
      svg.querySelectorAll(".nq-node").forEach(function (el) {
        const label = (el.querySelector(".nq-node-label") || {}).textContent || "";
        const id = el.getAttribute("data-node") || "";
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
      let s = clone.outerHTML.replace(/^<svg([^>]*)>/, '<svg$1 xmlns="http://www.w3.org/2000/svg">');
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

    const api = { zoomBy, resetView, focus, clearFocus, search, clearSearch, toggleTheme, setTheme, exportSVG, exportPNG, state };

    // keyboard shortcuts when this viewer owns the page (standalone file)
    let onKey = null;
    if (opts.keys) {
      onKey = function (e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
          if (e.key === "Escape") { e.target.blur(); clearSearch(); }
          return;
        }
        if (e.key === "t" || e.key === "T") toggleTheme();
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

  global.NaqshaViewer = { init: init };
})(typeof window !== "undefined" ? window : this);
