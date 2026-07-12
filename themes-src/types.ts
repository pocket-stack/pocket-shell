// The hand-written half of a theme port.
//
// sheru stays the source of truth for VALUES (tokens, bevel stacks, glyph
// geometry — snapshotted verbatim into themes-src/sheru/<id>.json); these
// types describe the RULES: one PartRule per css.ts rule block, values
// referenced by token name so upstream palette changes flow through a
// re-sync + re-cook without touching the spec.
//
// tools/cook-themes.ts resolves every reference against the snapshot
// (var() chains included), lowers gradients/bevel stacks to PocketJS
// utilities, and validates each emitted literal through the vendored
// tailwind compiler — a bake failure is a build error, never a silent drop.

/** `--token-name` reference into the theme's token table, or a literal. */
export type TokenRef = `--${string}`;
export type ColorValue = TokenRef | `#${string}`;
/** px number, or a token whose value is `<n>px`. */
export type SizeValue = TokenRef | number;

/** Box-shadow bevel stacks to lower into the engine's bevel ring props:
 *  each is a `--x-<id>-bevel-*` token or an inline stack string (some rules,
 *  e.g. win98's window-frame-edge, inline the stack in css.ts). `stack` lands
 *  in the base variant, `focus` in `focus:` (sheru :hover — d-pad focus is
 *  the PSP's hover), `pressed` in `active:`. */
export interface BevelRef {
  stack?: TokenRef | string;
  focus?: TokenRef | string;
  pressed?: TokenRef | string;
}

export interface TextRule {
  color: ColorValue;
  px: SizeValue;
  bold?: boolean;
  tracking?: boolean;
}

/** One part (or part/state) worth of paint + layout. */
export interface PartRule {
  /** Static layout utilities, verbatim (flex direction, alignment, size). */
  layout?: string;
  bg?: ColorValue;
  /** A token holding a CSS linear-gradient(); 2-stop axis-aligned lowers to
   *  native gradient utilities, anything else fails the bake loudly. */
  gradient?: TokenRef;
  bevel?: BevelRef;
  text?: TextRule;
  /** Fixed height in px, or a px-valued token (density-overridable). */
  h?: SizeValue;
  /** Fixed width in px, or a px-valued token (density-overridable). */
  w?: SizeValue;
  /** Background under d-pad focus (sheru :hover / [data-state=selected]). */
  bgFocus?: ColorValue;
  /** Padding [t, r, b, l] in px (post-density). */
  pad?: [number, number, number, number];
  /** Extra utilities appended verbatim (margins, gaps — the escape hatch). */
  extra?: string;
}

export interface PaintSpec {
  id: string;
  /** Key: "part" or "part/state" — mirrors the css.ts selector it was
   *  translated from (cite the source rule in a comment per entry). */
  parts: Record<string, PartRule>;
  /** Fixed pixel metrics the app reads (post-density values). */
  metrics: Record<string, number>;
}
