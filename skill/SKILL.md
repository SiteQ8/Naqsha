---
name: naqsha
description: Use this skill when someone wants a diagram of a system and would benefit from an interactive, self contained HTML diagram rather than a static image. Naqsha turns a short text source into a polished diagram of an architecture (a graph of services and dependencies), a sequence of calls between participants over time, or a lifecycle or state machine. It also exports a share image and can show what changed between two revisions of a graph. Trigger this for requests like "diagram this architecture", "draw the sequence for this flow", "show the states of an order", "make a diagram I can share", or "what changed between these two versions of the system".
---

# Naqsha: diagrams as code

Naqsha turns a short text source into a polished, interactive, self contained HTML
diagram. The output is one HTML file with no dependencies and no server: the reader
can pan and zoom, click a node to trace everything it reaches, search, switch
between dark and light themes, animate the flow, and export an SVG or a PNG.

Reach for Naqsha when a diagram would explain a system better than prose and the
person would benefit from one they can open and explore, not a flat picture.

## Choose a type

- **graph** (the default): an architecture, service dependencies, a pipeline,
  anything that is boxes and directed arrows.
- **sequence**: calls between participants over time, such as an API flow, an
  authentication handshake, or a checkout.
- **state**: a lifecycle or state machine, such as an order, a job, or a
  connection moving between states.

## Workflow

1. Write a source file, for example `diagram.naqsha`, using the language below.
2. Render it to a self contained HTML file:

   ```
   npx github:SiteQ8/Naqsha render diagram.naqsha -o diagram.html
   ```

   Open `diagram.html` in any browser. Add `--theme light` for a light diagram.
3. To produce a share image sized for a README or a chat, a 1200 by 630 SVG:

   ```
   npx github:SiteQ8/Naqsha card diagram.naqsha -o diagram.svg
   ```
4. To show what changed between two revisions of a graph:

   ```
   npx github:SiteQ8/Naqsha diff before.naqsha after.naqsha -o change.html
   ```

If Node is already set up you can clone the repository and call
`node bin/naqsha.mjs` instead of `npx`.

## The language

Every line is one statement. Text after a `#` is a comment. Labels are wrapped in
double quotes. An id is a short word with no spaces.

### Shared directives

- `title <text>` names the diagram.
- `type <graph|sequence|state>` picks the diagram type and defaults to graph.
- `direction <LR|TB>` lays the diagram out left to right (the default) or top to
  bottom. Prefer top to bottom when a graph gets too wide.

### Graph

- `group <id> "Label"` draws a labelled box around related nodes.
- `node <id> "Label" [group=<id>] [shape=<box|round|store|queue|actor|diamond>]`
  declares a node. box is the default, store is a data store, queue is a message
  queue, actor is an external user or system, diamond is a decision, round is a
  stadium.
- `edge <a> -> <b> ["label"]` draws a directed connection. The short form
  `a -> b` works too, and a node named only in an edge is created automatically.

```
title Payments platform
direction LR

group edge "Edge"
group core "Core"

node users "Users" shape=actor
node cdn "CDN" group=edge
node api "API gateway" group=edge
node auth "Auth" group=core
node db "PostgreSQL" shape=store group=core
node bus "Event bus" shape=queue

edge users -> cdn "https"
edge cdn -> api
edge api -> auth "verify"
edge api -> db "read and write"
edge api -> bus "emit"
```

### Sequence

- `participant <id> "Label"` declares a participant. Participants appear across
  the top in the order you declare them.
- `<a> -> <b> "message"` is a call, drawn as a solid arrow.
- `<a> --> <b> "message"` is a return or an asynchronous message, drawn dashed.
- `<a> -> <a> "message"` is a message from a participant to itself.
- `note over <id> "text"` places a note on a lifeline.

Messages are drawn in the order you write them; the vertical axis is time.

```
type sequence
title Checkout

participant user "User"
participant web "Web app"
participant pay "Payments"
participant bank "Bank"

user -> web "click pay"
web -> pay "create charge"
pay -> bank "authorize"
bank --> pay "approved"
pay --> web "charge ok"
web -> web "write order"
note over web "idempotent"
web --> user "receipt"
```

### State

- `initial <id>` marks the start state; a small filled dot points into it.
- `state <id> "Label" [final]` declares a state. Add `final` to mark an end
  state, which is drawn with a second inner outline.
- `final <id>` is another way to mark a state as an end state.
- `<a> -> <b> "event"` is a transition, labelled with the event that causes it.

```
type state
title Order lifecycle
direction LR

initial draft
state draft "Draft"
state submitted "Submitted"
state approved "Approved"
final delivered "Delivered"
final cancelled "Cancelled"

draft -> submitted "submit"
submitted -> approved "approve"
submitted -> draft "request changes"
approved -> delivered "ship"
submitted -> cancelled "cancel"
```

## Tips

- Give every node a short id and a readable label; refer to nodes by id in edges.
- Keep labels short. Long labels are truncated in the drawing.
- Because a node named only in an edge is created automatically, a quick sketch is
  just a handful of arrows.
- Group related nodes so the layout keeps them together and the picture reads in
  tiers.
- A state machine is a directed graph, so in the rendered diagram clicking a state
  traces every state reachable from it, which is a good way to answer where a
  process can still go from here.
- The diff is for the graph type. Keep the same node ids across the two revisions
  so Naqsha can match them and show only what really changed.
