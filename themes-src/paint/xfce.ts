// XFCE (Xfwm4/GTK2) paint spec — hand-translated from
// sheru packages/themes/src/xfce/css.ts. Flat gray with soft 2-stop
// vertical gradients everywhere — every gradient lowers natively.
// Deviations: no text-shadow on the title (engine PR7), GTK2 linked-segment
// per-corner radii squared off, dotted focus outlines dropped.

import type { PaintSpec } from "../types.ts";

export const xfcePaint: PaintSpec = {
  id: "xfce",
  parts: {
    desktop: {
      layout: "w-full h-full flex-col justify-center items-center",
      bg: "#5a7d9a", // stock Xfce blue-gray backdrop
    },

    // css.ts window: 1px dark outline, 4px radius, gradient body.
    window: {
      layout: "w-[464] h-[256] flex-col",
      gradient: "--window-bg",
      stripH: 256,
      border: { color: "#555c63" },
      radius: "--window-radius",
    },
    "window-frame": { layout: "flex-1 flex-col" },
    // xfce has no frame-edge overlay; keep the part for structure (empty).
    "window-frame-edge": { layout: "absolute inset-0" },

    // css.ts titlebar: dark slate gradient, 1px bottom border ("hairline"
    // via mb like win98's, colored by --x-xfce-header-border ≈ #2f353b).
    titlebar: {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg",
      h: "--titlebar-h",
      pad: [0, 4, 0, 4],
    },
    "titlebar/inactive": {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg-inactive",
      h: "--titlebar-h",
      pad: [0, 4, 0, 4],
    },
    title: {
      text: { color: "--titlebar-fg", px: "--font-size", bold: true },
      pad: [0, 4, 0, 4],
    },
    "title/inactive": {
      text: { color: "--titlebar-fg-inactive", px: "--font-size", bold: true },
      pad: [0, 4, 0, 4],
    },

    // css.ts controls: flat 25x20 rounded buttons, backdrop on hover only.
    controls: { layout: "flex-row items-center", pad: [0, 2, 0, 2], extra: "gap-[2]" },
    control: {
      layout: "w-[25] h-[18] flex-col justify-center items-center",
      radius: 3,
      bgFocus: "--x-xfce-control-hover",
      extra: "active:bg-[#00000038]",
    },
    "control/close": {
      layout: "w-[25] h-[18] flex-col justify-center items-center",
      radius: 3,
      bgFocus: "--x-xfce-close-hover",
      extra: "active:bg-[#cc575d]",
    },

    // css.ts toolbar: gradient strip with 1px bottom border.
    toolbar: {
      layout: "flex-row items-center",
      h: "--toolbar-h",
      gradient: "--toolbar-bg",
      pad: [0, 4, 0, 4],
      extra: "gap-[4]",
    },
    "toolbar-button": {
      layout: "flex-col justify-center items-center",
      h: 22,
      radius: 3,
      text: { color: "--fg", px: "--font-size", bold: true },
      gradientFocus: "--control-bg-hover",
      pad: [0, 5, 0, 5],
      extra: "min-w-[22] active:bg-[#d4d4d4]",
    },

    // css.ts breadcrumbs: white sunken-ish entry (1px border, radius).
    breadcrumbs: {
      layout: "flex-1 flex-row items-center",
      h: 20,
      bg: "--input-bg",
      border: { color: "--border" },
      radius: 3,
      pad: [2, 4, 2, 4],
    },
    breadcrumb: {
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 3, 0, 3],
    },

    split: { layout: "flex-1 flex-row", pad: [2, 2, 2, 2], extra: "gap-[2] overflow-hidden" },

    // css.ts sidebar: flat light pane with 1px border.
    sidebar: {
      layout: "flex-col",
      w: "--sidebar-w",
      bg: "--sidebar-bg",
      border: { color: "--border" },
      pad: [2, 2, 2, 2],
      extra: "overflow-hidden",
    },
    "sidebar-heading": {
      layout: "flex-row items-center",
      h: 16,
      text: { color: "#666666", px: "--font-size" },
      pad: [0, 6, 0, 6],
      extra: "mb-[2] shrink-0",
    },
    "sidebar-item": {
      layout: "flex-row items-center",
      h: "--row-h",
      radius: 3,
      gradientFocus: "--sidebar-selected-bg",
      pad: [0, 4, 0, 4],
      extra: "shrink-0",
    },

    // css.ts file-list: white well, 1px border; GTK header buttons.
    "file-list": {
      layout: "flex-1 flex-col",
      bg: "--list-bg",
      border: { color: "--border" },
      extra: "overflow-hidden",
    },
    "file-list-header": { layout: "flex-row items-center", h: 17, extra: "shrink-0" },
    "file-list-col": {
      layout: "flex-row items-center h-full",
      gradient: "--list-header-bg",
      stripH: 17,
      border: { color: "--border" },
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    "file-list-col/sorted": {
      layout: "flex-row items-center h-full",
      bg: "#d4d4d4",
      border: { color: "--border" },
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    "file-row": {
      layout: "flex-row items-center",
      h: "--row-h",
      gradientFocus: "--selection-bg",
      pad: [0, 2, 0, 2],
      extra: "shrink-0",
    },

    "status-bar": {
      layout: "flex-row items-center",
      h: 20,
      bg: "--surface",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] shrink-0",
    },
    "status-item": {
      layout: "flex-row items-center h-full",
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },

    // css.ts GTK button face (dialogs later).
    button: {
      layout: "h-[22] flex-col justify-center items-center",
      gradient: "--control-bg",
      stripH: 22,
      border: { color: "--control-border" },
      radius: 3,
      pad: [0, 10, 0, 10],
      text: { color: "--fg", px: "--font-size" },
    },
    segment: {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      gradient: "--control-bg",
      stripH: 22,
      border: { color: "--control-border" },
    },
    "segment/selected": {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      bg: "--control-bg-active",
      border: { color: "--control-border" },
    },
  },

  metrics: { windowFrameW: 0, controlW: 25, controlH: 18 },
};
