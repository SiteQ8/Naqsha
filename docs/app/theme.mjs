// Literal colors for each theme. The interactive diagram themes itself with CSS
// variables, but a share card has to render in any tool, including ones that do
// not resolve CSS variables, so the renderers also write these literal colors as
// presentation attributes. Author CSS outranks presentation attributes, so when
// the stylesheet is present it still themes the diagram and these are only a
// fallback; when it is absent, as in a card, these are what render.

const DARK = {
  bg: "#0f1420", line: "#26314a", text: "#e8edf6", dim: "#93a1ba", accent: "#3fd6c8", hot: "#5a86ff",
  nodeFill: "#182234", nodeStroke: "#3a5580", nodeText: "#eaf0f9",
  edge: "#5c6f95", edgeText: "#9aa8c4", edgeBg: "#131b2b",
  groupFill: "rgba(96,132,220,0.06)", groupStroke: "rgba(120,150,220,0.28)", groupText: "#8ea0c4",
  shape: { store: "#a78bff", queue: "#3fd6c8", actor: "#5a86ff", diamond: "#ffcb61" },
  lifeline: "#2c3854", msg: "#6b7ea6", noteFill: "#1a2540", noteText: "#c7d2e6",
  added: "#46c07a", removed: "#e5647d", changed: "#e0b13a",
};

const LIGHT = {
  bg: "#f6f8fc", line: "#dbe3ef", text: "#1a2333", dim: "#5a6b86", accent: "#12a594", hot: "#2f6bff",
  nodeFill: "#ffffff", nodeStroke: "#b7c4dc", nodeText: "#1a2333",
  edge: "#9fb0cc", edgeText: "#5a6b86", edgeBg: "#ffffff",
  groupFill: "rgba(90,134,255,0.05)", groupStroke: "rgba(90,134,255,0.26)", groupText: "#566a8e",
  shape: { store: "#7c5cff", queue: "#12a594", actor: "#2f6bff", diamond: "#c98a1a" },
  lifeline: "#c2cfe0", msg: "#7f90ad", noteFill: "#eef2fb", noteText: "#33415e",
  added: "#1a9e5f", removed: "#d6455f", changed: "#b1841a",
};

export function palette(theme) {
  return theme === "light" ? LIGHT : DARK;
}
