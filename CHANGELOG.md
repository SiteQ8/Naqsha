# Changelog

## 0.1.0

First release.

- A line based source language for describing a system as nodes, directed edges,
  and optional groups, with node shapes (box, round, store, queue, actor, diamond)
  and a left to right or top to bottom direction.
- A deterministic layered layout: cycles are broken, each node is placed on a
  layer by its longest path, nodes are ordered within a layer to reduce crossings
  and to keep groups together, and edges are routed as clean curves.
- An SVG renderer that carries the graph in data attributes so the viewer needs
  no second copy of the model.
- A self contained interactive viewer: pan and zoom, click a node to trace what it
  reaches upstream and downstream, search by label, switch between dark and light
  themes, and export a clean SVG or a PNG. Keyboard shortcuts in the generated file.
- A command line: render a source into one self contained HTML file, print an
  example to start from, and serve the playground locally.
- A browser playground that renders live from the same engine as the command line,
  so there is one implementation and nothing to keep in sync. Nothing you type is
  uploaded.
- Zero dependencies. 19 tests.

The graph diagram type is the focus of this release. Sequence and lifecycle types,
finite motion, and share cards are planned next.
