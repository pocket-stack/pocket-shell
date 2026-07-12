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

    // css.ts toolbar (IE4 idiom): thin-raised strip; buttons are FLAT until
    // hover (= d-pad focus here), pressed shows the thin-sunken bevel.
    toolbar: {
      layout: "flex-row items-center",
      h: "--toolbar-h",
      bg: "--toolbar-bg",
      bevel: { stack: "--x-win98-bevel-thin-raised" },
      pad: [0, 4, 0, 4],
      extra: "gap-[4]",
    },
    "toolbar-button": {
      layout: "flex-col justify-center items-center",
      h: 22,
      text: { color: "--control-fg", px: "--font-size", bold: true },
      bevel: { focus: "--x-win98-bevel-thin-raised", pressed: "--x-win98-bevel-thin-sunken" },
      pad: [0, 5, 0, 5],
      extra: "min-w-[22]",
    },
    // css.ts breadcrumbs: the Explorer address bar — a sunken white well.
    breadcrumbs: {
      layout: "flex-1 flex-row items-center",
      h: 18,
      bg: "--input-bg",
      bevel: { stack: "--x-win98-bevel-sunken" },
      pad: [2, 4, 2, 4],
    },
    breadcrumb: {
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 3, 0, 3],
    },

    // css.ts split-view: 2px gray gutters between white sunken wells.
    split: {
      layout: "flex-1 flex-row",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] overflow-hidden",
    },

    // css.ts sidebar: the Explorer tree pane, a sunken white well.
    sidebar: {
      layout: "flex-col",
      w: "--sidebar-w",
      bg: "--sidebar-bg",
      bevel: { stack: "--x-win98-bevel-sunken" },
      pad: [2, 2, 2, 2],
      extra: "overflow-hidden",
    },
    "sidebar-heading": {
      layout: "flex-row items-center",
      h: 16,
      bg: "--surface",
      bevel: { stack: "--x-win98-bevel-thin-raised" },
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
      extra: "mb-[2] shrink-0",
    },
    "sidebar-item": {
      layout: "flex-row items-center",
      h: "--row-h",
      bgFocus: "--sidebar-selected-bg",
      pad: [0, 4, 0, 4],
      extra: "shrink-0",
    },

    // css.ts file-list: sunken white well; header cells are raised gray
    // buttons stretched so the bevels meet.
    "file-list": {
      layout: "flex-1 flex-col",
      bg: "--list-bg",
      bevel: { stack: "--x-win98-bevel-sunken" },
      extra: "overflow-hidden",
    },
    "file-list-header": {
      layout: "flex-row items-center",
      h: 17,
      extra: "shrink-0",
    },
    "file-list-col": {
      layout: "flex-row items-center h-full",
      bg: "--list-header-bg",
      bevel: { stack: "--x-win98-bevel-raised" },
      text: { color: "--list-header-fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    // css.ts [data-state=sorted]: pressed bevel + the 1px content nudge.
    "file-list-col/sorted": {
      layout: "flex-row items-center h-full",
      bg: "--list-header-bg",
      bevel: { stack: "--x-win98-bevel-pressed" },
      text: { color: "--list-header-fg", px: "--font-size" },
      pad: [1, 5, 0, 7],
    },
    // css.ts segment (the grid/list view toggle): raised; selected = pressed
    // (the dither wash needs the pattern-fill engine PR — tracked deviation).
    segment: {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      bg: "--control-bg",
      bevel: { stack: "--x-win98-bevel-raised" },
    },
    "segment/selected": {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      bg: "--control-bg",
      bevel: { stack: "--x-win98-bevel-pressed" },
    },
    "file-row": {
      layout: "flex-row items-center",
      h: "--row-h",
      bgFocus: "--selection-bg",
      pad: [0, 2, 0, 2],
      extra: "shrink-0",
    },

    // css.ts status-bar: gray strip of thin-sunken cells; first cell flexes.
    "status-bar": {
      layout: "flex-row items-center",
      h: 20,
      bg: "--surface",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] shrink-0",
    },
    "status-item": {
      layout: "flex-row items-center h-full",
      bevel: { stack: "--x-win98-bevel-thin-sunken" },
      pad: [0, 6, 0, 6],
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
