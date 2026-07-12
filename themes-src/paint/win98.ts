// Win98 paint spec — hand-translated rule-for-rule from
// sheru packages/themes/src/win98/css.ts (M1 scope: window chrome).
// Values are token references into themes-src/sheru/win98.json.

import type { PaintSpec } from "../types.ts";

export const win98Paint: PaintSpec = {
  id: "win98",
  parts: {
    // PocketShell pseudo-part: sheru has no desktop (its webview IS the
    // window); classic teal so the frame silhouette reads on the board.
    desktop: {
      layout: "w-full h-full flex-col justify-center items-center",
      bg: "#008080",
    },

    // css.ts "window frame": 3px face-gray padding OUTSIDE the bevel (the
    // rendered geometry, verified against the reference capture: gray rows
    // 0-2, bevel rings at rows 3-4, content from row 5). The window part
    // carries the padding; window-frame carries the bevel + a 2px content
    // inset so children never paint over the rings. The frame-edge stack is
    // inlined in css.ts (not a token) — quoted verbatim.
    window: {
      layout: "w-[464] h-[256] flex-col",
      bg: "--window-bg",
      pad: [3, 3, 3, 3],
    },
    "window-frame": {
      layout: "flex-1 flex-col",
    },
    // css.ts window-frame-edge: an INERT OVERLAY painting the bevel rings ON
    // TOP of the content's outer 2px (the caption visibly loses its first
    // two rows under it — verified against the reference). Rendered as the
    // frame's last child, absolute inset-0, so it draws after the chrome.
    "window-frame-edge": {
      layout: "absolute inset-0",
      bevel: {
        stack:
          "inset -1px -1px var(--bevel-darker), inset 1px 1px var(--bevel-light), " +
          "inset -2px -2px var(--bevel-dark), inset 2px 2px var(--bevel-lighter)",
      },
    },

    // css.ts titlebar: caption gradient, 2/2/2/3 padding, 1px face hairline
    // below; height from --titlebar-h (density: 22 → 18).
    titlebar: {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg",
      h: "--titlebar-h",
      pad: [2, 2, 2, 3],
      extra: "mb-[1]",
    },
    "titlebar/inactive": {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg-inactive",
      h: "--titlebar-h",
      pad: [2, 2, 2, 3],
      extra: "mb-[1]",
    },

    // css.ts title: bold, 0 4px 0 2px padding, caption fg.
    title: {
      text: { color: "--titlebar-fg", px: "--font-size", bold: true },
      pad: [0, 4, 0, 2],
    },
    "title/inactive": {
      text: { color: "--titlebar-fg-inactive", px: "--font-size", bold: true },
      pad: [0, 4, 0, 2],
    },

    // css.ts controls: gap 0; close gets 2px left margin.
    controls: { layout: "flex-row items-center", extra: "gap-0" },

    // css.ts control: 16x14 raised face; :active inverts the bevel.
    control: {
      layout: "w-[16] h-[14] flex-col justify-center items-center",
      bg: "--control-bg",
      bevel: { stack: "--x-win98-bevel-raised", pressed: "--x-win98-bevel-pressed" },
    },
    "control/close": {
      layout: "w-[16] h-[14] flex-col justify-center items-center",
      bg: "--control-bg",
      bevel: { stack: "--x-win98-bevel-raised", pressed: "--x-win98-bevel-pressed" },
      extra: "ml-[2]",
    },

    // css.ts button (generic controls; used by later milestones' dialogs —
    // cooked now so the vocabulary is pinned).
    button: {
      layout: "h-[22] flex-col justify-center items-center",
      bg: "--control-bg",
      bevel: { stack: "--x-win98-bevel-raised", pressed: "--x-win98-bevel-pressed" },
      pad: [0, 10, 0, 10],
      text: { color: "--control-fg", px: "--font-size" },
    },
  },

  metrics: {
    windowFrameW: 3,
    controlW: 16,
    controlH: 14,
  },
};
