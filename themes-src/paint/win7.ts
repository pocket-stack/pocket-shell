// Windows 7 Aero paint spec — hand-translated rule-for-rule from
// sheru packages/themes/src/win7/css.ts (M1 scope: window chrome).
// Values are token references into themes-src/sheru/win7.json.
//
// Aero on a PSP — the deviation ledger (each cited again inline):
//   1. No backdrop blur. sheru itself fakes Aero over a WKWebView with
//      translucent gradients (css.ts L4-7); here the translucent multi-stop
//      layers bake to RGBA STRIPS and the desktop goes a deeper Win7
//      wallpaper blue so the glass alpha visibly reads over it.
//   2. 165deg gradients (--window-bg, --x-win7-frame-inactive) approximate
//      to vertical 180deg — the engine strips/axes are axis-aligned only.
//   3. Layered backgrounds collapse to one layer: the window's radial + linear
//      white sheen (css.ts L16-19) folds into the top stop of a single
//      vertical strip; --window-shadow's 1px inner white highlight (L22) and
//      window-body's white hairline ring (L37) are dropped.
//   4. sheru's 2-stop win7 tokens write positioned stops ("#a 0%, #b 100%")
//      which the native 2-stop lowering rejects; identical-value literals
//      WITHOUT positions are inlined instead (token cited per rule).
//   5. :hover → focus. Aero's glossy 4-stop hovers with the hard 45/46%
//      break (--control-bg-hover) approximate to a native 2-stop
//      first/last (#eaf6fd → #a7d9f5); :active → solid mid-stop via extra.
//      gradientFocus cannot carry strips, so no focus state keeps 4 stops.
//   6. Caption text is Win7's DARK-on-glass --titlebar-fg #1e1e1e; the
//      signature white text glow (--x-win7-title-glow, css.ts L54) needs
//      text-shadow — unavailable, dropped. Title font-size 13px → 12px
//      (the only baked slot).
//   7. Caption buttons are glossy gel pills (css.ts L72-113): here they are
//      just sized boxes — the glyph images carry the gel artwork separately;
//      only an approximated hover tint (bgFocus) and pressed solid remain.
//      Shared 1px borders (margin-left:-1px), the bottom-corner pill radii,
//      the inner highlight rings and the focused-close red gel base are all
//      left to the glyph/artwork layer.
//   8. Per-side borders (toolbar/status-bar/header hairlines, column
//      border-right) have no engine slot: dropped or widened to the single
//      inset border, cited per rule.

import type { PaintSpec } from "../types.ts";

export const win7Paint: PaintSpec = {
  id: "win7",
  parts: {
    // PocketShell pseudo-part: sheru has no desktop (its webview IS the
    // window). Deep Win7-default-wallpaper blue so the translucent glass
    // strips composite over something and the alpha reads (deviation 1).
    desktop: {
      layout: "w-full h-full flex-col justify-center items-center",
      bg: "#2c5d8f",
    },

    // css.ts L14-23 window: faked Aero glass — radial+linear white sheen
    // layered over --window-bg (165deg, 3 rgba stops). Collapsed to ONE
    // vertical RGBA strip: 165deg → 180deg (deviation 2) and the sheen
    // folded into the top stop — white a0.28 over rgba(189,212,236,.96)
    // composites to ≈ rgba(207,224,241,.97) (deviation 3). --window-shadow's
    // 1px inner highlight dropped (deviation 3). Border color is the color
    // component of --window-border "1px solid rgba(28,48,70,0.78)" → 8-digit
    // hex (the token holds the full shorthand, so the color is inlined).
    // radius 6 = --window-radius (uniform — fine natively). pad 3 is the
    // glass frame: --window-frame-w 6px halved for PSP density (metrics
    // windowFrameW below).
    window: {
      layout: "w-[464] h-[256] flex-col",
      gradient:
        "linear-gradient(180deg, rgba(207, 224, 241, 0.97) 0%, rgba(148, 178, 209, 0.96) 45%, rgba(118, 150, 186, 0.96) 100%)",
      stripH: 256,
      border: { color: "#1c3046c7" },
      radius: "--window-radius",
      pad: [3, 3, 3, 3],
    },
    // css.ts L33-38 window-body → the client area inside the glass frame:
    // 2-stop plain-hex vertical gradient (#f4f6f8 → #ebeef1, lowers
    // natively) ringed by the dark client edge --x-win7-client-edge
    // rgba(49,76,106,0.65) → #314c6aa6. The white hairline just outside it
    // (box-shadow 0 0 0 1px --x-win7-inner-highlight) is dropped
    // (deviation 3); margin 0 6px 6px is replaced by the window part's pad.
    "window-frame": {
      layout: "flex-1 flex-col",
      gradient: "linear-gradient(180deg, #f4f6f8, #ebeef1)",
      border: { color: "#314c6aa6" },
    },
    // win7 has no frame-edge bevel overlay (Aero is all gradients); keep the
    // part for structure (empty absolute overlay), like xfce.
    "window-frame-edge": { layout: "absolute inset-0" },

    // css.ts L41-43 titlebar: --titlebar-bg — 4 rgba stops with the hard
    // 45/52% glass break → an RGBA strip (deviation 1); height from
    // --titlebar-h (density: 28 → 18). No padding in css.ts — title and
    // controls carry their own insets.
    titlebar: {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg",
      h: "--titlebar-h",
    },
    // css.ts L45-47: --titlebar-bg-inactive (3 rgba stops) → RGBA strip.
    "titlebar/inactive": {
      layout: "flex-row items-center justify-between",
      gradient: "--titlebar-bg-inactive",
      h: "--titlebar-h",
    },

    // css.ts L49-55 title: dark-on-glass --titlebar-fg #1e1e1e, padding
    // 0 8px, Segoe UI regular (never bold). font-size 13px → 12px and the
    // white glow text-shadow dropped (deviation 6).
    title: {
      text: { color: "--titlebar-fg", px: "--font-size" },
      pad: [0, 8, 0, 8],
    },
    // css.ts L57-60: inactive caption dims to --titlebar-fg-inactive;
    // --x-win7-title-glow-inactive dropped (deviation 6).
    "title/inactive": {
      text: { color: "--titlebar-fg-inactive", px: "--font-size" },
      pad: [0, 8, 0, 8],
    },

    // css.ts L67-70 controls: one connected glass pill. margin-left:-1px
    // shared borders → gap-0 flush boxes (deviation 7); align-self
    // flex-start (hung from the top edge) has no slot here — the pill rides
    // centered in the 18px bar instead.
    controls: { layout: "flex-row items-center", extra: "gap-0" },

    // css.ts L72-98 control: 30x19 glossy gel (4-stop rgba glass face, dark
    // caption border, inner highlight ring). Sized box only — the gel
    // artwork ships with the glyph images (deviation 7). Focus approximates
    // the hover glass (L148-158) as its 50% stop rgba(150,201,237,0.5) →
    // #96c9ed80; :active (L175-184) as its mid stop rgba(150,180,206,0.55)
    // → #96b4ce8c.
    control: {
      layout: "w-[30] h-[19] flex-col justify-center items-center",
      bgFocus: "#96c9ed80",
      extra: "active:bg-[#96b4ce8c]",
    },
    // css.ts L110-113: close widens to 46px. Focus approximates the close
    // hover red gel (L161-171) as its 51% stop #dd463b; :active (L186-189)
    // as its 50% stop #a52c23. The focused-window solid red gel base
    // (L119-130) is glyph-artwork territory too (deviation 7).
    "control/close": {
      layout: "w-[46] h-[19] flex-col justify-center items-center",
      bgFocus: "#dd463b",
      extra: "active:bg-[#a52c23]",
    },

    // css.ts L192-195 toolbar: --toolbar-bg is 2-stop plain hex but with
    // 0%/100% positions — inlined position-free so it lowers natively
    // (deviation 4). border-bottom --toolbar-border hairline dropped
    // (deviation 8). Height from --toolbar-h (density: 38 → 26).
    toolbar: {
      layout: "flex-row items-center",
      h: "--toolbar-h",
      gradient: "linear-gradient(180deg, #fdfeff, #e6f0fa)",
      pad: [0, 4, 0, 4],
      extra: "gap-[4]",
    },
    // css.ts L197-216 toolbar-button: flat until hover; min-height 26 /
    // padding 3px 10px density-tightened to the shared 22px/[0,5] chrome
    // row. Hover --control-bg-hover 4-stop glossy → native 2-stop
    // first/last #eaf6fd → #a7d9f5 (deviation 5); :active
    // --control-bg-active → solid 31% stop #98d1ef. Hover border-color
    // --x-win7-hover-border + inner highlight ring dropped (deviation 8).
    "toolbar-button": {
      layout: "flex-col justify-center items-center",
      h: 22,
      radius: 3,
      text: { color: "--control-fg", px: "--font-size" },
      gradientFocus: "linear-gradient(180deg, #eaf6fd, #a7d9f5)",
      pad: [0, 5, 0, 5],
      extra: "min-w-[22] active:bg-[#98d1ef]",
    },

    // css.ts L219-226 breadcrumbs: the Win7 address bar — white entry, 1px
    // --input-border, --input-radius 2. Height 26 → 20 (density, fits the
    // 26px toolbar row).
    breadcrumbs: {
      layout: "flex-1 flex-row items-center",
      h: 20,
      bg: "--input-bg",
      border: { color: "--input-border" },
      radius: "--input-radius",
      pad: [0, 2, 0, 2],
    },
    // css.ts L232-248 breadcrumb: padding 0 7px, radius 2, --fg text; hover
    // --control-bg-hover → the same native 2-stop approximation
    // (deviation 5); :active --control-bg-active → solid #98d1ef.
    breadcrumb: {
      text: { color: "--fg", px: "--font-size" },
      radius: 2,
      gradientFocus: "linear-gradient(180deg, #eaf6fd, #a7d9f5)",
      pad: [0, 7, 0, 7],
      extra: "active:bg-[#98d1ef]",
    },

    split: { layout: "flex-1 flex-row", pad: [2, 2, 2, 2], extra: "gap-[2] overflow-hidden" },

    // css.ts L318-321 sidebar: the Explorer navigation pane — flat
    // --sidebar-bg #f7fbff. Its 4px padding-top folds into the shared 2px
    // inset; width from --sidebar-w (density: 200 → 96).
    sidebar: {
      layout: "flex-col",
      w: "--sidebar-w",
      bg: "--sidebar-bg",
      pad: [2, 2, 2, 2],
      extra: "overflow-hidden",
    },
    // css.ts L323-327 sidebar-heading: plain muted label, no fill; padding
    // 8px 10px 3px density-tightened to the shared 16px/[0,6] heading row.
    "sidebar-heading": {
      layout: "flex-row items-center",
      h: 16,
      text: { color: "--fg-muted", px: "--font-size" },
      pad: [0, 6, 0, 6],
      extra: "mb-[2] shrink-0",
    },
    // css.ts L329-350 sidebar-item: radius 2, the signature 12px left
    // indent (padding 0 4px 0 12px). D-pad focus == selection on the PSP,
    // so focus takes [data-state=selected]'s --sidebar-selected-bg (L346-350)
    // — 2-stop plain hex, inlined position-free to lower natively
    // (deviation 4); the softer :hover wash (L341-344) and the inset
    // --x-win7-sel-border-soft ring are dropped (deviations 5/8).
    "sidebar-item": {
      layout: "flex-row items-center",
      h: "--row-h",
      radius: 2,
      gradientFocus: "linear-gradient(180deg, #ebf4fc, #cfe4f7)",
      pad: [0, 4, 0, 12],
      extra: "shrink-0",
    },

    // css.ts L382-384 file-list: plain white --list-bg well (Aero lists have
    // no frame of their own).
    "file-list": {
      layout: "flex-1 flex-col",
      bg: "--list-bg",
      extra: "overflow-hidden",
    },
    // css.ts L386-391 file-list-header: white --list-header-bg strip; the
    // border-bottom --border hairline has no per-side slot (deviation 8).
    "file-list-header": {
      layout: "flex-row items-center",
      h: 17,
      bg: "--list-header-bg",
      extra: "shrink-0",
    },
    // css.ts L393-406 file-list-col: border-right --border widened to the
    // full 1px inset border (deviation 8); hover is the white-to-blue Aero
    // wash (L404-406) — 2-stop plain hex, inlined position-free → native.
    "file-list-col": {
      layout: "flex-row items-center h-full",
      border: { color: "--border" },
      text: { color: "--list-header-fg", px: "--font-size" },
      gradientFocus: "linear-gradient(180deg, #f4f9fd, #dceefb)",
      pad: [0, 6, 0, 6],
    },
    // win7 css.ts defines NO sorted-column rule; Explorer tints the sorted
    // header, so the hover wash (L404-406) is held steady as the sorted
    // state (approximation).
    "file-list-col/sorted": {
      layout: "flex-row items-center h-full",
      gradient: "linear-gradient(180deg, #f4f9fd, #dceefb)",
      border: { color: "--border" },
      text: { color: "--list-header-fg", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },
    // css.ts L271-315 segment (generic Aero button family): --control-bg is
    // the 4-stop gel with the hard 45/46% break → baked strip; border
    // --control-border. Middle segments are square (border-radius:0,
    // L305-308) — the first/last outer corner radii are per-corner and
    // dropped, as are the shared -1px borders (deviations 7/8). Hover →
    // native 2-stop approximation (deviation 5); :active → solid #98d1ef.
    segment: {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      gradient: "--control-bg",
      border: { color: "--control-border" },
      gradientFocus: "linear-gradient(180deg, #eaf6fd, #a7d9f5)",
      extra: "active:bg-[#98d1ef]",
    },
    // css.ts L295-302 [data-state=selected]: --control-bg-active 4-stop
    // pressed gel → baked strip; border-color --x-win7-pressed-border. The
    // inset press shadow is dropped (deviation 8).
    "segment/selected": {
      layout: "flex-col justify-center items-center",
      w: 33,
      h: 22,
      gradient: "--control-bg-active",
      border: { color: "--x-win7-pressed-border" },
    },
    // css.ts L408-426 file-row: radius 2; selection --x-win7-sel-bg
    // (L422-426) — 2-stop plain hex, inlined position-free → native
    // gradientFocus (deviation 4). The softer :hover wash (L417-420), the
    // inset --x-win7-sel-border ring and the zebra tint (L413-415) are
    // dropped (deviations 5/8; no zebra state in this part vocabulary).
    "file-row": {
      layout: "flex-row items-center",
      h: "--row-h",
      radius: 2,
      gradientFocus: "linear-gradient(180deg, #dcebfc, #c1dbfc)",
      pad: [0, 2, 0, 2],
      extra: "shrink-0",
    },

    // css.ts L487-493 status-bar: the details-pane blue wash — 2-stop plain
    // hex literal in css.ts, inlined position-free → native. Height 26 → 20
    // (density); border-top --toolbar-border dropped (deviation 8).
    "status-bar": {
      layout: "flex-row items-center",
      h: 20,
      gradient: "linear-gradient(180deg, #f2f7fc, #e0ebf6)",
      pad: [2, 2, 2, 2],
      extra: "gap-[2] shrink-0",
    },
    // win7 css.ts has no status-item rule; cells inherit the status-bar's
    // muted fg (L492).
    "status-item": {
      layout: "flex-row items-center h-full",
      text: { color: "--fg-muted", px: "--font-size" },
      pad: [0, 6, 0, 6],
    },

    // css.ts L271-302 button (generic Aero controls; dialogs later — cooked
    // now so the vocabulary is pinned): --control-bg 4-stop gel → baked
    // strip (stripH pins the extent — h lives in the layout literal);
    // --control-border + --control-radius 3. --control-shadow's inner white
    // ring dropped (deviation 8). Hover → native 2-stop approximation
    // (deviation 5); :active → solid 31% stop #98d1ef.
    button: {
      layout: "h-[22] flex-col justify-center items-center",
      gradient: "--control-bg",
      stripH: 22,
      border: { color: "--control-border" },
      radius: "--control-radius",
      gradientFocus: "linear-gradient(180deg, #eaf6fd, #a7d9f5)",
      pad: [0, 10, 0, 10],
      text: { color: "--control-fg", px: "--font-size" },
      extra: "active:bg-[#98d1ef]",
    },
  },

  metrics: {
    // --window-frame-w 6px halved for PSP density (the window part's pad).
    windowFrameW: 3,
    // css.ts L72-74: 30x19 caption gel (close widens to 46, L111).
    controlW: 30,
    controlH: 19,
  },
};
