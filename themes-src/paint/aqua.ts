// Mac OS X Aqua (10.2–10.4) paint spec — hand-translated rule-for-rule from
// sheru packages/themes/src/aqua/css.ts (line refs below are into that file).
// Values are token references into themes-src/sheru/aqua.json.
//
// Aqua is the DSL's stress test: pinstripes, gel gradients, radial
// highlights, embossed text. Engine deviations (each also cited at its
// rule):
//   [D1] PINSTRIPE — no pattern/tiled fills yet (engine PR pending).
//        --x-aqua-pinstripe repeats 2px bands of #ececec / #e4e4e4; every
//        pinstriped surface (window body, toolbar underlay, status bar)
//        paints the flat per-channel average #e8e8e8 ((0xec + 0xe4) / 2 —
//        which happens to equal --bg exactly).
//   [D2] Gel multi-stop gradients bake to strip images; RADIAL gel
//        highlights (traffic lights, --x-aqua-gel-blue's ellipse) cannot be
//        expressed — only the vertical linear layer survives.
//   [D3] text-shadow emboss/engrave (--x-aqua-emboss / --x-aqua-engrave)
//        dropped everywhere — no engine text-shadow (PR7).
//   [D4] Type ramp: --font-size is 13px and Aqua's small labels are 11px;
//        the engine's only small slot is text-xs = 12px, so every text rule
//        pins px: 12 (can't reference --font-size like win98/xfce do).
//   [D5] Side-specific borders (titlebar/toolbar/header/status hairlines,
//        column separators) can't lower — engine border is one color on all
//        sides. Approximated with an mb-[1] seam or dropped, per rule.
//   [D6] D-pad focus restyles background only — selected rows/items keep
//        their base label color instead of --selection-fg white + engrave.

import type { PaintSpec } from "../types.ts";

export const aquaPaint: PaintSpec = {
  id: "aqua",
  parts: {
    // PocketShell pseudo-part: sheru has no desktop (its webview IS the
    // window); flat mid-tone stand-in for the 10.3 "Aqua Blue" swirl
    // wallpaper so the rounded frame + shadow read on the board.
    desktop: {
      layout: "w-full h-full flex-col justify-center items-center",
      bg: "#3f6fbe",
    },

    // css.ts window (lines 8–13): pinstripe body, top-corner radius, 1px
    // translucent outline, deep soft shadow. --window-frame-w is 0px so the
    // window carries no frame padding (cf. win98's 3px face ring).
    //   [D1] --window-bg → --x-aqua-pinstripe → flat #e8e8e8 average.
    //   DEVIATION (radius): css rounds the TOP corners only
    //   ("var(--window-radius) var(--window-radius) 0 0", lines 11–13);
    //   engine radius is uniform — all four corners get 8.
    //   DEVIATION (border): --window-border is the full shorthand
    //   "1px solid rgba(0, 0, 0, 0.3)" — color inlined as #0000004d.
    //   DEVIATION (shadow): --window-shadow "0 22px 55px rgba(0,0,0,0.45)"
    //   → nearest baked shadow index 3 (shadow-lg).
    window: {
      layout: "w-[464] h-[256] flex-col",
      bg: "#e8e8e8",
      radius: "--window-radius",
      border: { color: "#0000004d" },
      shadow: 3,
    },
    "window-frame": { layout: "flex-1 flex-col" },
    // Aqua has no bevel frame ring; keep the part for structure (empty
    // absolute overlay, cf. win98's window-frame-edge).
    "window-frame-edge": { layout: "absolute inset-0" },

    // css.ts titlebar (lines 16–20): the glossy gel cap — 5-stop white→gray
    // gradient with the hard seam at 50/51% → strip [D2] (h = 18 after
    // density, 22 → 18). border-bottom 1px --border-strong:
    //   [D5] approximated as an mb-[1] seam that exposes the window bg
    //   (#e8e8e8 pinstripe average) instead of the #888888 hairline.
    titlebar: {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg",
      h: "--titlebar-h",
      extra: "mb-[1]",
    },
    // css.ts lines 33–37: unfocused windows lose the gloss and go matte —
    // 3-stop near-flat gradient → strip [D2].
    "titlebar/inactive": {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg-inactive",
      h: "--titlebar-h",
      extra: "mb-[1]",
    },

    // css.ts title (lines 22–26): bold, 0 8px padding, embossed [D3], 13px
    // [D4].
    title: {
      text: { color: "--titlebar-fg", px: 12, bold: true },
      pad: [0, 8, 0, 8],
    },
    // css.ts lines 38–40: inactive title goes gray, emboss off ([D3] moot).
    "title/inactive": {
      text: { color: "--titlebar-fg-inactive", px: 12, bold: true },
      pad: [0, 8, 0, 8],
    },

    // css.ts controls (lines 43–46): gap 8px, padding 0 8px. The skin
    // places the cluster on the LEFT in close/minimize/zoom order
    // (chrome.controlsSide/controlsOrder in the snapshot).
    controls: {
      layout: "flex-row items-center",
      pad: [0, 8, 0, 8],
      extra: "gap-[8]",
    },

    // css.ts control (lines 48–67): 13x13 rounded-full gel spheres, 1px
    // border colored per action (#9a2b22 / #97700f / #1d7322), backgrounds
    // from --x-aqua-gel-* (two radial highlight layers over a linear base).
    //   DEVIATION (gels): the radial gel artwork is inexpressible [D2] and
    //   per-action border colors can't live on one generic part — the
    //   control glyph images carry the entire traffic-light artwork, so
    //   these parts are plain sized boxes with NO background/border.
    //   DEVIATION (size): 13px css → 14px so rounded-full is an integer
    //   uniform radius 7 (w+h pinned in the same literal).
    //   DEVIATION (:active, lines 69–71): filter brightness(0.85) has no
    //   engine equivalent — dropped.
    //   DEVIATION (inactive, lines 89–106): the matte-gray gel state has no
    //   control/inactive part key — dropped.
    control: {
      layout: "w-[14] h-[14] flex-col justify-center items-center",
      radius: 7,
    },
    // Same box; close/minimize/zoom differ only in glyph artwork.
    "control/close": {
      layout: "w-[14] h-[14] flex-col justify-center items-center",
      radius: 7,
    },

    // css.ts toolbar (lines 109–112): --toolbar-bg layers a 55%-white wash
    // (fading out at 60%) over the pinstripe.
    //   DEVIATION: layered background + pinstripe [D1] → hand-composited
    //   native 2-stop: 0.55·white over #e8e8e8 = #f5f5f5 at the top fading
    //   to bare #e8e8e8 (source wash ends at 60%; native fade spans the
    //   full height). border-bottom 1px #9f9f9f dropped [D5] (an mb seam
    //   would expose the identical #e8e8e8 below it — invisible).
    toolbar: {
      layout: "flex-row items-center",
      h: "--toolbar-h",
      gradient: "linear-gradient(180deg, #f5f5f5, #e8e8e8)",
      pad: [0, 4, 0, 4],
      extra: "gap-[4]",
    },
    // css.ts gel pill buttons (lines 114–151): h 22, 0 10px pad, 1px
    // --control-border, radius --control-radius (11px = pill), 4-stop white
    // gel face → strip [D2]. --control-shadow (inset top-white + soft drop)
    // dropped — no compound shadows.
    //   :hover (lines 132–136) → gradientFocus; --control-bg-hover is
    //   4-stop → DEVIATION: 2-stop native approximation white → #e4eefb
    //   (its darkest stop, the gel seam).
    //   :active (lines 138–143) → solid; --control-bg-active is 4-stop →
    //   DEVIATION: flattened to its 45% stop #c6c6c6.
    //   [data-state=active] blue gel (lines 145–151) has no part key —
    //   dropped.
    "toolbar-button": {
      layout: "flex-col justify-center items-center",
      h: 22,
      radius: "--control-radius",
      border: { color: "--control-border" },
      gradient: "--control-bg",
      text: { color: "--control-fg", px: 12 },
      pad: [0, 10, 0, 10],
      gradientFocus: "linear-gradient(180deg, #ffffff, #e4eefb)",
      extra: "min-w-[22] active:bg-[#c6c6c6]",
    },

    // css.ts breadcrumbs (lines 180–183): no well (unlike win98's sunken
    // strip) — just the muted default label color on the row.
    breadcrumbs: {
      layout: "flex-1 flex-row items-center",
      text: { color: "--fg-muted", px: 12 },
    },
    // css.ts breadcrumb (lines 185–196): 18px pill, 0 6px pad, radius 9;
    // :hover paints --x-aqua-hover-wash (rgba(0,0,0,0.08)) → bgFocus.
    // [data-state=current] bold has no part key — dropped.
    breadcrumb: {
      h: 18,
      radius: 9,
      text: { color: "--fg", px: 12 },
      bgFocus: "--x-aqua-hover-wash",
      pad: [0, 6, 0, 6],
    },

    // Structural parity with win98/xfce (2px gutters, 2px gap).
    //   DEVIATION: aqua's split-divider (css.ts lines 267–276) paints a
    //   single #888888 hairline centered in a 5px hit area — no divider
    //   part exists, so the shared 2px gutter shows the window bg instead.
    split: { layout: "flex-1 flex-row", pad: [2, 2, 2, 2], extra: "gap-[2] overflow-hidden" },

    // css.ts sidebar (lines 217–222): flat blue-gray pane (#dee3e9),
    // padding 6px 0. No border — the divider hairline was the separator
    // (see split deviation).
    sidebar: {
      layout: "flex-col",
      w: "--sidebar-w",
      bg: "--sidebar-bg",
      pad: [6, 0, 6, 0],
      extra: "overflow-hidden",
    },
    // css.ts sidebar-heading (lines 224–230): bold 11px [D4] muted label,
    // embossed [D3], padding 8px 12px 2px.
    //   DEVIATION: vertical padding (8/2) folded into the fixed 16px row —
    //   items-center + pad t/b would fight inside h-[16].
    "sidebar-heading": {
      layout: "flex-row items-center",
      h: 16,
      text: { color: "--fg-muted", px: 12, bold: true },
      pad: [0, 12, 0, 12],
      extra: "mb-[2] shrink-0",
    },
    // css.ts sidebar-item (lines 232–251): 0 12px pad; [data-state=selected]
    // paints --sidebar-selected-bg = --x-aqua-selection-grad.
    //   DEVIATION (syntax only): the token spells the gradient
    //   "to bottom, #6c9ef0 0%, #3875d7 100%" which the native lowerer
    //   rejects (deg + bare-hex form required) — rewritten inline with the
    //   SAME two stops; no visual deviation. Selected white fg + engrave
    //   dropped [D6][D3]; the focused-window-only gray selection
    //   (lines 248–251) has no part state — dropped.
    "sidebar-item": {
      layout: "flex-row items-center",
      h: "--row-h",
      text: { color: "--sidebar-fg", px: 12 },
      gradientFocus: "linear-gradient(180deg, #6c9ef0, #3875d7)",
      pad: [0, 12, 0, 12],
      extra: "shrink-0",
    },

    // css.ts file-list (lines 278–281): plain white well — no border, no
    // bevel (Aqua lets the content sit flush).
    "file-list": {
      layout: "flex-1 flex-col",
      bg: "--list-bg",
      extra: "overflow-hidden",
    },
    // css.ts file-list-header (lines 283–288): unlike win98/xfce the header
    // BAR carries the paint — 3-stop white→#dcdcdc gradient → strip [D2].
    // border-bottom 1px --border dropped [D5]; 11px header type → 12 [D4].
    "file-list-header": {
      layout: "flex-row items-center",
      h: 17,
      gradient: "--list-header-bg",
      extra: "shrink-0",
    },
    // css.ts file-list-col (lines 289–295): transparent over the header
    // strip; embossed [D3] muted label.
    //   DEVIATION: border-right column separators dropped [D5] (a full
    //   4-side border per column would read as boxes).
    "file-list-col": {
      layout: "flex-row items-center h-full",
      text: { color: "--list-header-fg", px: 12 },
      pad: [0, 6, 0, 6],
    },
    // css.ts lines 296–298: [data-state=sorted] tints the column with the
    // 3-stop blue --x-aqua-header-sorted → strip [D2]; h-full has no fixed
    // height so stripH pins the 17px extent.
    "file-list-col/sorted": {
      layout: "flex-row items-center h-full",
      gradient: "--x-aqua-header-sorted",
      stripH: 17,
      text: { color: "--list-header-fg", px: 12 },
      pad: [0, 6, 0, 6],
    },
    // css.ts segment (lines 153–178): the lozenge. Sheru wraps segments in
    // a [data-part=segmented] container that owns the border/radius/gel and
    // seams segments with border-left.
    //   DEVIATION: no container part in the vocabulary — each segment is an
    //   independent 33x22 gel pill (radius 11, own border), like the
    //   separate 10.0-era toolbar toggles. css h 20 → 22 for structural
    //   parity with win98/xfce. Gel face --control-bg → strip [D2];
    //   :active → flattened #c6c6c6 (see toolbar-button).
    segment: {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      radius: 11,
      border: { color: "--control-border" },
      gradient: "--control-bg",
      extra: "active:bg-[#c6c6c6]",
    },
    // css.ts lines 174–178: selected segment gets --x-aqua-gel-blue.
    //   DEVIATION: its radial ellipse highlight is dropped [D2] — this is
    //   the token's vertical linear layer quoted verbatim, baked to a
    //   strip. White fg + engrave dropped [D6][D3].
    "segment/selected": {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      radius: 11,
      border: { color: "--control-border" },
      gradient: "linear-gradient(180deg, #a7cdf6 0%, #5a9bee 45%, #2f6fde 50%, #71b3f4 100%)",
    },
    // css.ts file-row (lines 300–321): selection is the same aqua-blue gel
    // as the sidebar — inline native rewrite of --x-aqua-selection-grad
    // (see sidebar-item). Selected white fg + engrave dropped [D6][D3].
    //   DEVIATION: Finder zebra stripes ([data-zebra=even] → --list-zebra,
    //   lines 303–306) have no part state — rows stay flat white.
    "file-row": {
      layout: "flex-row items-center",
      h: "--row-h",
      gradientFocus: "linear-gradient(180deg, #6c9ef0, #3875d7)",
      pad: [0, 2, 0, 2],
      extra: "shrink-0",
    },

    // css.ts status-bar (lines 379–388): centered muted 11px [D4] label on
    // pinstripe [D1] → flat #e8e8e8; border-top 1px --border dropped [D5];
    // emboss dropped [D3].
    "status-bar": {
      layout: "flex-row items-center justify-center",
      h: 20,
      bg: "#e8e8e8",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] shrink-0",
    },
    // No status-item rule in aqua css.ts — cells inherit the bar's muted fg.
    "status-item": {
      layout: "flex-row items-center h-full",
      text: { color: "--fg-muted", px: 12 },
      pad: [0, 6, 0, 6],
    },

    // css.ts button (lines 114–151, shared selector with toolbar-button):
    // the same white gel pill — strip face, pill radius, 2-stop hover
    // approximation, flattened active (all deviations cited at
    // toolbar-button). stripH pins the 22px extent (h lives in the layout
    // string, xfce precedent).
    button: {
      layout: "h-[22] flex-col justify-center items-center",
      radius: "--control-radius",
      border: { color: "--control-border" },
      gradient: "--control-bg",
      stripH: 22,
      pad: [0, 10, 0, 10],
      text: { color: "--control-fg", px: 12 },
      gradientFocus: "linear-gradient(180deg, #ffffff, #e4eefb)",
      extra: "active:bg-[#c6c6c6]",
    },
  },

  // --window-frame-w is 0px; controls are the 14px rounded gel boxes.
  metrics: { windowFrameW: 0, controlW: 14, controlH: 14 },
};
