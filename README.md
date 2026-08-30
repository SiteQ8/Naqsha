# Naqsha

**Diagrams as code.** Describe a system in a few lines of text and Naqsha turns it into a polished, interactive diagram you can actually explore: pan and zoom, click a node to trace everything it reaches upstream and downstream, search, switch between dark and light themes, and export a clean SVG or PNG. The command line turns the same source into one self contained HTML file you can open anywhere, with no server and no network. Zero dependencies.

Naqsha is the Arabic and Urdu word for a map or a blueprint.

### Try it in your browser

**[siteq8.github.io/Naqsha](https://siteq8.github.io/Naqsha/)**

Type a source on the left and the diagram updates as you go. Nothing you type leaves your browser.

![Naqsha](docs/screenshot.png)

## The idea

A diagram is the fastest way to explain a system, and the slowest thing to keep current. The picture in the wiki drifts from the code the moment someone ships. Tools like Mermaid fixed half of this by letting you write the diagram as text, so it lives in the repository and changes in a pull request. Naqsha takes the same idea and asks for more from the result.

The output is not a flat image. It is a diagram you can read actively. Click any node and Naqsha traces exactly what it depends on and what depends on it, and dims everything else, so a dense architecture becomes legible one question at a time. Search jumps to a service by name. A theme toggle moves between dark and light. And the whole thing is one self contained HTML file: no build step, no hosting, no runtime. Open it, explore it, mail it to a colleague, drop it in a release.

You write this:

```
title Payments platform
direction LR

group edge "Edge"
group core "Core services"

node users "Users" shape=actor
node cdn "CDN" group=edge
node api "API gateway" group=edge
node auth "Auth service" group=core
node orders "Orders service" group=core
node db "PostgreSQL" shape=store group=core
node cache "Redis" shape=store group=core
node bus "Event bus" shape=queue

edge users -> cdn "https"
edge cdn -> api "cache miss"
edge api -> auth "verify token"
edge api -> orders "place order"
edge orders -> db "read and write"
edge orders -> cache "read through"
edge orders -> bus "emit events"
edge bus -> orders "retry"
```

and you get a laid out, grouped, explorable diagram of it.

## The source language

A source is a plain text file. Every line is one statement, and anything after a hash is a comment.

A **node** is a box in the diagram: `node <id> "Label"`, with an optional `group=<id>` and an optional `shape=`. The shapes are box (the default), round, store, queue, actor, and diamond, so a data store, a queue, an external actor, and a decision each read differently at a glance. An **edge** is a directed connection: `edge <a> -> <b> "optional label"`, and the short form `a -> b` works too. A **group** draws a labelled box around related nodes: `group <id> "Label"`. Two lines at the top set the mood: `title` names the diagram and `direction` is LR for left to right or TB for top to bottom.

Any node you mention in an edge is created automatically, so a quick sketch is just a handful of arrows.

## The interactive viewer

Every diagram, in the browser and in the exported file, comes with the same viewer.

Pan by dragging the background and zoom with the wheel or the plus, minus, and reset controls. Click a node to focus it: Naqsha follows the edges to compute everything it reaches downstream and everything that reaches it upstream, lights that path, and dims the rest. Click the background to clear. Search filters the nodes by name. The theme button switches between dark and light. Export gives you a clean SVG, or a PNG at twice the resolution, always the full diagram rather than the current pan and zoom. In the generated file the keyboard works too: `/` to search, `T` for theme, `+`, `-`, and `0` to zoom, and `Escape` to clear.

![Tracing what a node reaches](docs/trace.png)

Above: focusing one service lights its upstream path and dims the rest, so you can read a dense diagram one question at a time.

## Install and use

Naqsha needs Node 18 or newer and nothing else.

Run it without installing:

```
npx github:SiteQ8/Naqsha render system.naqsha -o system.html
```

Or clone it:

```
git clone https://github.com/SiteQ8/Naqsha.git
cd Naqsha
node bin/naqsha.mjs render examples/payments.naqsha -o payments.html
```

Commands:

```
naqsha render <source> [-o out.html] [--theme dark|light]   build a self contained diagram
naqsha example [-o file.naqsha]                             print a source to start from
naqsha serve [--port 8300] [--open]                         run the browser playground locally
naqsha version
```

`render` writes a single HTML file with the diagram, the styles, and the viewer all inlined. Open it in any browser.

## Honest scope

This first release does one diagram type, the graph, and aims to do it well: architecture maps, service dependencies, pipelines, and anything else that is nodes and directed edges. The layout is a compact layered algorithm in the spirit of the Sugiyama method; it is a good automatic starting point, not a hand tuned drawing, and on a large or unusual graph you may want to split it or nudge the source. The viewer traces reach by following the edges you wrote; it reflects the diagram, and the diagram reflects what you told it, not a running system.

Sequence and lifecycle diagram types, finite motion, and share card export are planned next, and the engine is built around a diagram type so they slot in without disturbing the graph type. The approach here, a typed source compiled deterministically into a self contained, explorable HTML diagram, was inspired by the excellent [Archify](https://github.com/tt-a1i/archify); Naqsha is a smaller, independent take on that idea, in a single shared engine with no dependencies.

## License

MIT. See [LICENSE](LICENSE).
