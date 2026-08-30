# Changelog

## 0.2.0

- A second diagram type: sequence. Set `type sequence` and describe participants
  and the messages between them, with calls, dashed returns and asynchronous
  messages, self messages, and notes over a lifeline. Time flows down the page.
  The viewer works here too: click a participant to light every message it takes
  part in and the participants at the other end.
- Share cards. Any diagram can be exported as a 1200 by 630 image sized for a
  README banner or a link preview. The Card button in the browser writes a PNG,
  and `naqsha card` on the command line writes a self contained SVG whose colors
  are baked in, so it renders in any tool.
- The renderers now write literal colors as presentation attributes alongside the
  CSS classes, so a stylesheet free copy such as a card still renders correctly
  anywhere, while the interactive diagram continues to theme itself with CSS.
- 31 tests.

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
