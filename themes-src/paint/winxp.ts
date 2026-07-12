// Windows XP "Luna (blue)" paint spec — hand-translated rule-for-rule from
// sheru packages/themes/src/winxp/css.ts (line refs below are into that
// file). Values are token references into themes-src/sheru/winxp.json.
//
// Luna is the gradient theme: every period gradient token carries %-stop
// positions, so ALL of them lower through the strip bridge (the native
// 2-stop path requires bare hex stops) — titlebar, toolbar, sidebar pane,
// task-pane card head, and the plastic button faces all bake to strips.
//
// Theme-wide deviations (per-part ones are cited inline):
// - Corner radius is uniform-only in the engine. XP rounds only the TOP of
//   the window (css.ts:12) — top-only 8px → radius 0 (square frame). Small
//   uniform 3px radii on buttons survive.
// - The gel window controls (--x-winxp-ctl-glass/-close) are radial+linear
//   layered backgrounds with brightness/saturate filters on hover/active/
//   inactive (css.ts:76-90) — none expressible. The gel artwork ships as
//   baked glyph images; the control parts here are sized boxes only.
// - Luna's orange hover glow ring and blue focus-visible glow on buttons
//   (css.ts:156-170) are inset spread shadows the bevel grammar can't hold
//   ((0,0)-offset blurs are not ring edges) — dropped.
// - --window-shadow (0 16px 44px rgba) is dropped like the exemplars: the
//   desktop board renders windows without drop shadows.

import type { PaintSpec } from "../types.ts";

export const winxpPaint: PaintSpec = {
  id: "winxp",
  parts: {
    // PocketShell pseudo-part: sheru has no desktop (its webview IS the
    // window); Luna's default backdrop blue (the solid under Bliss).
    desktop: {
      layout: "w-full h-full flex-col justify-center items-center",
      bg: "#004e98",
    },

    // css.ts:9-20 window: the blue plastic frame — bg --window-bg (#0855dd),
    // 1px deep-blue outline (--window-border holds the shorthand
    // "1px solid #0831d9"; the color is inlined here). Deviations:
    // - padding is `0 4px 4px` upstream with the titlebar bleeding edge-to-
    //   edge over the side frame via negative margins (css.ts:39); the
    //   engine has no negative margins, so the frame is a uniform 3px ring
    //   (XP's frame reads ~3px at this density) and the caption sits inside
    //   it, mirroring win98's structure.
    // - top-only 8px radius → 0 (uniform-only engine), see header note.
    // - the inactive-frame recolor (css.ts:15-20) needs a window/inactive
    //   part state the shell vocabulary doesn't have — dropped.
    window: {
      layout: "w-[464] h-[256] flex-col",
      bg: "--window-bg",
      border: { color: "#0831d9" },
      pad: [3, 3, 3, 3],
    },
    // css.ts:32-34 window-body: background var(--bg). The shell has no
    // window-body part, so the frame interior carries the tan face — it
    // also shows through the split gutters, as upstream.
    "window-frame": {
      layout: "flex-1 flex-col",
      bg: "--bg",
    },
    // css.ts:23-30 window-frame-edge: a glassy 1px highlight just inside
    // the outline — inset shadows at (1,0)/(-1,0)/(0,-1), which are not
    // ring edges in the engine bevel grammar (and XP has no bevel frame).
    // Deviation: dropped; the part stays as an empty absolute overlay so
    // the structure matches the exemplars.
    "window-frame-edge": { layout: "absolute inset-0" },

    // css.ts:37-46 titlebar: THE Luna caption — an 8-stop vertical gradient
    // (--titlebar-bg), baked to a strip; height from --titlebar-h
    // (density: 28 → 18). padding `0 5px 0 8px` verbatim. Deviations: the
    // edge-to-edge negative margin (css.ts:39, see window) and the
    // `inset 0 1px 0` top highlight (css.ts:42 — (0,1) is not a ring edge)
    // are dropped.
    titlebar: {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg",
      h: "--titlebar-h",
      pad: [0, 5, 0, 8],
    },
    // css.ts:44-46: the 13-stop steel-blue inactive caption — strip.
    "titlebar/inactive": {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg-inactive",
      h: "--titlebar-h",
      pad: [0, 5, 0, 8],
    },

    // css.ts:48-56 title: bold white, padding-right 8px. Deviations: 13px
    // Trebuchet → the single 12px engine font (--font-size), and the hard
    // 1px --x-winxp-shade text-shadow is dropped (engine PR7, as in xfce).
    title: {
      text: { color: "--titlebar-fg", px: "--font-size", bold: true },
      pad: [0, 8, 0, 0],
    },
    // css.ts:57-60: pale steel text, shadow already off upstream.
    "title/inactive": {
      text: { color: "--titlebar-fg-inactive", px: "--font-size", bold: true },
      pad: [0, 8, 0, 0],
    },

    // css.ts:68-70 controls: gap 2px.
    controls: { layout: "flex-row items-center", extra: "gap-[2]" },

    // css.ts:71-90 control: the 21x21 gel button. Deviation (header note):
    // the gel background, its 1px --x-winxp-ctl-edge border, and the
    // hover/active/inactive brightness filters are all baked into the
    // glyph images — this part is a sized, rounded box only. The 21px gel
    // intentionally spans the 18px caption plus the 3px top frame pad,
    // like the real thing bleeding to the frame edge.
    control: {
      layout: "w-[21] h-[21] flex-col justify-center items-center",
      radius: 3,
    },
    // css.ts:82-84: close swaps in --x-winxp-ctl-close — same box; the
    // red gel lives in the close glyph image.
    "control/close": {
      layout: "w-[21] h-[21] flex-col justify-center items-center",
      radius: 3,
    },

    // css.ts:93-96 toolbar: soft tan 3-stop gradient (--toolbar-bg) →
    // strip; height from --toolbar-h (density: 38 → 26). Deviation: the
    // 1px --toolbar-border border-bottom is dropped — the engine border is
    // all-sides and would ring the strip (xfce precedent).
    toolbar: {
      layout: "flex-row items-center",
      h: "--toolbar-h",
      gradient: "--toolbar-bg",
      pad: [0, 4, 0, 4],
      extra: "gap-[4]",
    },
    // css.ts:97-113 toolbar-button: flat until hover. Deviations: height
    // 26px → 22 so it sits inside the 26px density bar (exemplar norm);
    // :hover paints --x-winxp-glow-hover-pale via bgFocus but the amber
    // hover border (--x-winxp-glow-hover) has no focus-border slot —
    // dropped; :active's --control-bg-active is a 3-stop gradient and
    // active: takes solids only — approximated with its 40% mid stop
    // #e3e0d8 (the inset shade shadow is dropped).
    "toolbar-button": {
      layout: "flex-col justify-center items-center",
      h: 22,
      radius: "--control-radius",
      text: { color: "--control-fg", px: "--font-size" },
      bgFocus: "--x-winxp-glow-hover-pale",
      pad: [0, 8, 0, 8],
      extra: "min-w-[22] active:bg-[#e3e0d8]",
    },

    // winxp css.ts has no breadcrumbs-container rule; the XP address bar is
    // the flat white entry well, painted per the search-field rule
    // (css.ts:129-137): --input-bg, 1px --input-border (#7f9db9),
    // --input-radius (0px → square). Deviation: height 22px → 20 to clear
    // the 26px density toolbar.
    breadcrumbs: {
      layout: "flex-1 flex-row items-center",
      h: 20,
      bg: "--input-bg",
      border: { color: "--input-border" },
      radius: "--input-radius",
      pad: [0, 5, 0, 5],
    },
    // css.ts:115-126 breadcrumb: padding 1px 3px, --fg text. Deviation:
    // the :hover accent + underline is a text-color state the engine
    // can't express — dropped.
    breadcrumb: {
      text: { color: "--fg", px: "--font-size" },
      pad: [1, 3, 1, 3],
    },

    // Structural split (exemplar-identical). Deviation: css.ts:279-282
    // paints a 1px --border line centered in the split-divider hit area;
    // here the 2px gutter simply shows the window-frame tan.
    split: { layout: "flex-1 flex-row", pad: [2, 2, 2, 2], extra: "gap-[2] overflow-hidden" },

    // css.ts:227-231 sidebar: the Explorer task pane — the periwinkle
    // 2-stop vertical gradient (--sidebar-bg). Its stops carry %-positions
    // so it bakes to a strip; no fixed h on the pane, so stripH is the
    // computed interior height: 256 - 2*3 frame - 18 titlebar - 26 toolbar
    // - 20 status-bar - 2*2 split pad = 182. Deviations: width from
    // --sidebar-w (density: 204 → 96); padding 12px 10px + 12px section
    // gap tightened to the exemplars' 2px at this density.
    sidebar: {
      layout: "flex-col",
      w: "--sidebar-w",
      gradient: "--sidebar-bg",
      stripH: 182,
      pad: [2, 2, 2, 2],
      extra: "overflow-hidden",
    },
    // css.ts:240-246 sidebar-heading: the white card head —
    // --x-winxp-card-head (2-stop with %-positions → strip), bold
    // --sidebar-fg link-blue. Deviations: padding 5px 10px 4px /
    // margin-bottom 3px tightened to the exemplars' [0,6,0,6] + mb-[2];
    // the enclosing sidebar-section card (css.ts:233-239 — rounded
    // 5px-top card, --x-winxp-card-bg, soft shadow) has no part in the
    // shell vocabulary and is omitted, so the heading floats directly on
    // the pane gradient.
    "sidebar-heading": {
      layout: "flex-row items-center",
      h: 16,
      gradient: "--x-winxp-card-head",
      text: { color: "--sidebar-fg", px: "--font-size", bold: true },
      pad: [0, 6, 0, 6],
      extra: "mb-[2] shrink-0",
    },
    // css.ts:247-261 sidebar-item: task-pane hyperlink rows. Deviations:
    // padding 0 10px 0 14px → [0,4,0,4] (96px density pane); upstream
    // "selection" is transparent bg + bold dark text (css.ts:257-261) and
    // hover is a link underline — neither is visible d-pad feedback, so
    // focus paints Luna selection blue (--selection-bg) instead; item
    // text color is owned app-side like the exemplars (selected text goes
    // white app-side).
    "sidebar-item": {
      layout: "flex-row items-center",
      h: "--row-h",
      bgFocus: "--selection-bg",
      pad: [0, 4, 0, 4],
      extra: "shrink-0",
    },

    // css.ts:285-287 file-list: Explorer details view, plain white well.
    "file-list": {
      layout: "flex-1 flex-col",
      bg: "--list-bg",
      extra: "overflow-hidden",
    },
    // css.ts:288-290 file-list-header: the pale header band.
    "file-list-header": {
      layout: "flex-row items-center",
      h: 17,
      bg: "--list-header-bg",
      extra: "shrink-0",
    },
    // css.ts:291-296 file-list-col: flat XP header cells. Deviation: the
    // right+bottom 1px --x-winxp-header-edge hairlines and the inset
    // white top highlight are approximated with the cell bg + a single
    // all-side --x-winxp-header-edge border (engine borders are uniform).
    "file-list-col": {
      layout: "flex-row items-center h-full",
      bg: "--list-header-bg",
      border: { color: "--x-winxp-header-edge" },
      text: { color: "--list-header-fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    // css.ts:297-299 [data-state=sorted]: the sorted column shows the
    // button-face tan (--surface); XP headers don't press, so no nudge.
    "file-list-col/sorted": {
      layout: "flex-row items-center h-full",
      bg: "--surface",
      border: { color: "--x-winxp-header-edge" },
      text: { color: "--list-header-fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    // css.ts:142-152 segment: the XP plastic button face — --control-bg
    // (4-stop vertical → strip) inside the deep-blue --control-border.
    // Deviations: the segmented-strip per-corner radius fusing
    // (css.ts:189-196) squares to a uniform 3px; the hover glow ring is
    // dropped (header note; --control-bg-hover equals the base gradient
    // anyway).
    segment: {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      gradient: "--control-bg",
      border: { color: "--control-border" },
      radius: "--control-radius",
    },
    // css.ts:171-178 [data-state=selected]: the pressed face is the
    // 3-stop --control-bg-active gradient — a separate part, so it bakes
    // to its own strip at full fidelity (the inset shade shadow drops).
    "segment/selected": {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      gradient: "--control-bg-active",
      border: { color: "--control-border" },
      radius: "--control-radius",
    },
    // css.ts:306-309 file-row selected: Luna selection blue via bgFocus
    // (d-pad focus IS selection on the PSP; selected text goes white
    // app-side). Deviation: the mouse hover tint --x-winxp-row-hover
    // (css.ts:303-305) is superseded by that mapping, and the unfocused-
    // window gray selection (css.ts:311-314) has no part state.
    "file-row": {
      layout: "flex-row items-center",
      h: "--row-h",
      bgFocus: "--selection-bg",
      pad: [0, 2, 0, 2],
      extra: "shrink-0",
    },

    // css.ts:366-372 status-bar: tan strip. Deviations: height 23px → 20
    // (density, exemplar norm); the 1px --border top hairline + inset
    // white highlight are dropped (all-side border would ring the bar);
    // the ::after resize-grip dots (css.ts:381-390) are glyph territory.
    "status-bar": {
      layout: "flex-row items-center",
      h: 20,
      bg: "--surface",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] shrink-0",
    },
    // css.ts:373-379 status-item: per-side border-color puts --bevel-dark
    // on top/left and --bevel-light on bottom/right — exactly a thin
    // sunken ring, quoted as an inline bevel stack (TL slot = dark,
    // BR slot = light; slots are positional).
    "status-item": {
      layout: "flex-row items-center h-full",
      bevel: { stack: "inset 1px 1px var(--bevel-dark), inset -1px -1px var(--bevel-light)" },
      text: { color: "--fg", px: "--font-size" },
      pad: [0, 8, 0, 8],
    },

    // css.ts:142-152 button: the generic XP plastic button (dialogs in
    // later milestones — cooked now so the vocabulary is pinned).
    // Deviations: min-height 23px → 22 (exemplar norm); hover glow ring
    // dropped (header note); :active's 3-stop --control-bg-active →
    // solid 40% mid stop #e3e0d8 (css.ts:171-178).
    button: {
      layout: "h-[22] flex-col justify-center items-center",
      gradient: "--control-bg",
      stripH: 22,
      border: { color: "--control-border" },
      radius: "--control-radius",
      pad: [0, 10, 0, 10],
      text: { color: "--control-fg", px: "--font-size" },
      extra: "active:bg-[#e3e0d8]",
    },
  },

  metrics: {
    windowFrameW: 3,
    controlW: 21,
    controlH: 21,
  },
};
