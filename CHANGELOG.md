# Changelog

## 0.7.0

- `direction RL` for graphs, state machines, and sequence diagrams. Graphs and states mirror the finished left to right layout across the width, so nothing else changes. Sequences place the first participant on the right, messages flow leftwards, and self loops open to the left. Tests cover all three.

## 0.6.1

Fixed the SVG and PNG exports. The standalone SVG carried the xmlns attribute twice on
its root, which is invalid XML. Browsers rendered it inline but refused to load it as an
image, so exported SVGs could not be embedded and the PNG export never completed. The
namespace is now added only when missing, and a regression test covers it.

## 0.6.0

- An agent skill at skill/SKILL.md. It teaches an assistant the source language
  for all three diagram types and the render, card, and diff commands, so an
  assistant can turn a plain request into a Naqsha source and a self contained
  diagram. Every diagram source in the skill is checked against the real engine.

## 0.5.0

- Finite motion. A Flow button, or the F key in a generated file, animates every
  connection so its dashes travel toward the arrowhead, a quick way to show
  direction during a walkthrough. It works across all diagram types, on graph
  edges, sequence messages, and state transitions, is off by default, and honors
  a reduced motion preference so it never animates for someone who asked their
  system to keep motion still.

## 0.4.0

- Before and after diff. `naqsha diff before.naqsha after.naqsha` compares two
  snapshots of the same graph and shows what changed: added nodes and edges in
  green, removed ones in red and dashed, ones whose label changed in amber, and
  the rest unchanged. The union of both snapshots is laid out once so the picture
  holds still, and the generated file has three view modes, Before, After, and
  Delta. Meant for reviewing how an architecture changed in a pull request.
- The palette gained added, removed, and changed colors, and the viewer gained a
  view mode switch, both used by the diff.
- 48 tests.

## 0.3.0

- A third diagram type: the state machine, written as `type state` or
  `type lifecycle`. States are boxes, transitions are labelled arrows, a filled
  dot marks the initial state, and a final state gets a second inner outline.
  It reuses the layered layout, and because a state machine is a directed graph
  the viewer traces it like one: click a state to see every state reachable from
  it and every state that leads to it. Share cards and export work here too.
- Back edge labels now sit on the curve that bows away from the nodes rather than
  on the straight centre line, so a pair of states with a transition each way no
  longer overlaps its two labels.
- 42 tests.

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
