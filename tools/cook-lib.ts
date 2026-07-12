// Cook library: rule -> literal lowering + per-theme cook. See
// tools/cook-themes.ts (the runner) for the pipeline overview.

import { mkdirSync } from "node:fs";
import { parseClassLiteral } from "../vendor/pocketjs/compiler/tailwind.ts";
import { DENSITY } from "../themes-src/density.ts";
import type { PaintSpec, PartRule } from "../themes-src/types.ts";

const repo = new URL("..", import.meta.url).pathname;

interface Snapshot {
  provenance: { commit: string; dirty: boolean };
  theme: { id: string; name: string; tokens: Record<string, string> };
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

export function makeResolver(tokens: Record<string, string>) {
  function resolve(value: string, depth = 0): string {
    if (depth > 16) throw new Error(`token cycle at ${value}`);
    const direct = tokens[value];
    if (direct !== undefined) return resolve(direct, depth + 1);
    // substitute embedded var(--x) references
    return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
      const v = tokens[name];
      if (v === undefined) throw new Error(`unknown token ${name}`);
      return resolve(v, depth + 1);
    });
  }
  return resolve;
}

function hexColor(value: string, what: string): string {
  const v = value.trim();
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (rgba) {
    const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map((n) => Number(n).toString(16).padStart(2, "0"));
    const a = Math.round(Number(rgba[4] ?? 1) * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a === "ff" ? "" : a}`;
  }
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(v);
  if (!m) throw new Error(`${what}: expected hex/rgba color, got "${value}"`);
  return v.toLowerCase();
}

function px(value: string | number, what: string): number {
  if (typeof value === "number") return value;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!m) throw new Error(`${what}: expected <n>px, got "${value}"`);
  return parseFloat(m[1]);
}

// ---------------------------------------------------------------------------
// CSS lowerings
// ---------------------------------------------------------------------------

/** 2-stop axis-aligned linear-gradient with plain hex stops → native
 *  gradient utilities; returns null when it needs the strip bridge. */
function lowerGradientNative(css: string): string | null {
  const m = /^linear-gradient\(\s*(\d+)deg\s*,([^]*)\)$/.exec(css.trim());
  if (!m) return null;
  const dir = { 0: "t", 90: "r", 180: "b", 270: "l" }[Number(m[1])] as string | undefined;
  if (!dir) return null;
  const stops = m[2].split(/,(?![^(]*\))/).map((s) => s.trim());
  if (stops.length !== 2) return null;
  if (!stops.every((s) => /^#[0-9a-fA-F]+$/.test(s))) return null;
  const [from, to] = stops;
  return `bg-gradient-to-${dir} from-[${from.toLowerCase()}] to-[${to.toLowerCase()}]`;
}

/** Bevel box-shadow stack → bevel-[...] utility.
 *  Grammar: `inset ±Npx ±Npx <color>` parts; (+1,+1)=outer TL, (-1,-1)=outer
 *  BR, (+2,+2)=inner TL, (-2,-2)=inner BR. TL feeds the "light" slot, BR the
 *  "dark" slot (position, not brightness — sunken stacks put dark on TL). */
function lowerBevelStack(stack: string, what: string): string {
  const slots: Record<string, string> = {};
  for (const part of stack.split(/,(?![^(]*\))/)) {
    const m = /^\s*inset\s+(-?\d+)px\s+(-?\d+)px\s+(#[0-9a-fA-F]+)\s*$/.exec(part);
    if (!m) throw new Error(`${what}: unsupported bevel segment "${part.trim()}"`);
    const [dx, dy] = [Number(m[1]), Number(m[2])];
    const key =
      dx === 1 && dy === 1 ? "outerLight"
      : dx === -1 && dy === -1 ? "outerDark"
      : dx === 2 && dy === 2 ? "innerLight"
      : dx === -2 && dy === -2 ? "innerDark"
      : null;
    if (!key) throw new Error(`${what}: bevel offset (${dx},${dy}) is not a ring edge`);
    slots[key] = hexColor(m[3], what);
  }
  const outer = [slots.outerLight, slots.outerDark];
  if (outer.some((c) => !c)) throw new Error(`${what}: bevel stack missing the outer ring`);
  const inner = [slots.innerLight, slots.innerDark];
  const colors = inner.every((c) => c) ? [...outer, ...inner] : outer;
  if (inner.some((c) => !c) && inner.some((c) => c)) {
    throw new Error(`${what}: half an inner ring`);
  }
  return `bevel-[${colors.join(",")}]`;
}

// ---------------------------------------------------------------------------
// Rule → literal
// ---------------------------------------------------------------------------

const FONT_PX = [12, 14, 16, 18, 20, 24, 36];
const TEXT_CLASS: Record<number, string> = { 12: "text-xs", 14: "text-sm", 16: "text-base", 18: "text-lg", 20: "text-xl", 24: "text-2xl", 36: "text-4xl" };

export interface StripRequest {
  /** app-relative image path (also the skin.strips value). */
  file: string;
  /** Resolved CSS linear-gradient(). */
  css: string;
  /** Part pixel height (vertical strips) or width (horizontal). */
  extent: number;
}

export function cookRule(
  key: string,
  rule: PartRule,
  resolve: (v: string) => string,
  themeId: string,
  strips: StripRequest[],
  stripMap: Record<string, string>,
): string {
  const what = `${key}`;
  const parts: string[] = [];
  let partH: number | undefined;
  if (rule.layout) parts.push(rule.layout);
  if (rule.h !== undefined) {
    const h = typeof rule.h === "number" ? rule.h : px(resolve(rule.h), `${what}.h`);
    parts.push(`h-[${h}]`);
    partH = h;
  }
  if (rule.w !== undefined) {
    const w = typeof rule.w === "number" ? rule.w : px(resolve(rule.w), `${what}.w`);
    parts.push(`w-[${w}]`);
  }
  if (rule.pad) {
    const [t, r, b, l] = rule.pad;
    if (t === r && r === b && b === l) parts.push(`p-[${t}]`);
    else parts.push(`pt-[${t}]`, `pr-[${r}]`, `pb-[${b}]`, `pl-[${l}]`);
  }
  if (rule.radius !== undefined) {
    const r = typeof rule.radius === "number" ? rule.radius : px(resolve(rule.radius), `${what}.radius`);
    if (r > 0) parts.push(`rounded-[${r}]`);
  }
  if (rule.border) {
    parts.push(`border-[${hexColor(resolve(rule.border.color), `${what}.border`)}]`);
    if (rule.border.width && rule.border.width !== 1) parts.push(`border-[${rule.border.width}]`);
  }
  if (rule.shadow) parts.push(rule.shadow === 1 ? "shadow" : rule.shadow === 2 ? "shadow-md" : "shadow-lg");
  if (rule.bg) parts.push(`bg-[${hexColor(resolve(rule.bg), `${what}.bg`)}]`);
  if (rule.bgFocus) parts.push(`focus:bg-[${hexColor(resolve(rule.bgFocus), `${what}.bgFocus`)}]`);
  if (rule.gradientFocus) {
    const native = lowerGradientNative(resolve(rule.gradientFocus));
    if (!native) throw new Error(`${what}.gradientFocus: must be a native 2-stop axis gradient`);
    parts.push(native.split(" ").map((tok) => `focus:${tok}`).join(" "));
  }
  if (rule.gradient) {
    const css = resolve(rule.gradient);
    const native = lowerGradientNative(css);
    if (native) {
      parts.push(native);
    } else {
      // Multi-stop / alpha / non-axis: the strip bridge — a baked image
      // rendered under the part by <GradientStrip> until the engine PR.
      const extent = rule.stripH ?? partH;
      if (!extent) throw new Error(`${what}: strip gradient needs h or stripH`);
      const file = `strips/${themeId}-${key.replace(/[^a-z0-9-]+/gi, "_")}.png`;
      strips.push({ file, css, extent });
      const r = rule.radius === undefined ? 0 : typeof rule.radius === "number" ? rule.radius : px(resolve(rule.radius), `${what}.radius`);
      stripMap[key] = r > 0 ? `${file}|${r}` : file;
    }
  }
  if (rule.bevel) {
    if (rule.bevel.stack) {
      parts.push(lowerBevelStack(resolve(rule.bevel.stack), `${what}.bevel`));
    }
    if (rule.bevel.focus) {
      parts.push(`focus:${lowerBevelStack(resolve(rule.bevel.focus), `${what}.bevel.focus`)}`);
    }
    if (rule.bevel.pressed) {
      parts.push(`active:${lowerBevelStack(resolve(rule.bevel.pressed), `${what}.bevel.pressed`)}`);
    }
  }
  if (rule.text) {
    const size = typeof rule.text.px === "number" ? rule.text.px : px(resolve(rule.text.px), `${what}.text.px`);
    const cls = TEXT_CLASS[size];
    if (!cls) throw new Error(`${what}: no font slot for ${size}px (have ${FONT_PX.join("/")})`);
    parts.push(cls);
    if (rule.text.bold) parts.push("font-bold");
    if (rule.text.tracking) parts.push("tracking-wide");
    parts.push(`text-[${hexColor(resolve(rule.text.color), `${what}.text.color`)}]`);
  }
  if (rule.extra) parts.push(rule.extra);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------


export interface CookedTheme {
  classes: Record<string, string>;
  stripMap: Record<string, string>;
  strips: StripRequest[];
}

/** Cook one theme spec against its snapshot; throws on any bad literal. */
export async function cookTheme(spec: PaintSpec): Promise<CookedTheme> {
  const snap = (await Bun.file(`${repo}themes-src/sheru/${spec.id}.json`).json()) as Snapshot;
  const tokens = { ...snap.theme.tokens, ...(DENSITY[spec.id] ?? {}) };
  const resolve = makeResolver(tokens);
  const classes: Record<string, string> = {};
  const stripMap: Record<string, string> = {};
  const strips: StripRequest[] = [];
  for (const [key, rule] of Object.entries(spec.parts)) {
    const literal = cookRule(key, rule, resolve, spec.id, strips, stripMap);
    let rec;
    try {
      rec = parseClassLiteral(literal);
    } catch (e) {
      throw new Error(`cook ${spec.id}/${key}: literal failed hard: ${e}
  "${literal}"`);
    }
    if (rec === null) {
      throw new Error(`cook ${spec.id}/${key}: literal did not fully parse:
  "${literal}"`);
    }
    classes[key] = literal;
  }
  return { classes, stripMap, strips };
}
