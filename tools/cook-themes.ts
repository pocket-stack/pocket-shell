// Cook themes: sheru snapshot (values) + paint spec (rules) + density →
// app/theme/cooked/<id>.cooked.ts, a table of full PocketJS class literals
// keyed by "part" / "part/state".
//
// Lowerings:
//   - token refs / var() chains  → resolved hex or px against the snapshot
//     tokens (with themes-src/density.ts overrides applied first)
//   - linear-gradient(<axis>deg, A, B) → bg-gradient-to-* from-[A] to-[B]
//   - box-shadow bevel stacks (inset ±1/±2 rings) → bevel-[...] utilities
//     (outer/inner ring colors positional: TL = "light" slot, BR = "dark");
//     a pressed stack lands in active:bevel-[...]
//
// Every emitted literal round-trips through the VENDORED tailwind compiler
// (compileClasses); any unparseable literal fails the cook. The cooked file
// is committed and scanned by the app build (all string literals compile),
// so the runtime does zero style work — `skin.cls(part)` is a table lookup.
//
//   bun tools/cook-themes.ts

import { mkdirSync } from "node:fs";
import { parseClassLiteral } from "../vendor/pocketjs/compiler/tailwind.ts";
import { DENSITY } from "../themes-src/density.ts";
import type { PaintSpec, PartRule } from "../themes-src/types.ts";
import { win98Paint } from "../themes-src/paint/win98.ts";

const repo = new URL("..", import.meta.url).pathname;
const SPECS: PaintSpec[] = [win98Paint];

interface Snapshot {
  provenance: { commit: string; dirty: boolean };
  theme: { id: string; name: string; tokens: Record<string, string> };
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

function makeResolver(tokens: Record<string, string>) {
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
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim());
  if (!m) throw new Error(`${what}: expected hex color, got "${value}"`);
  return value.trim().toLowerCase();
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

/** 2-stop axis-aligned linear-gradient → gradient utilities. */
function lowerGradient(css: string, what: string): string {
  const m = /^linear-gradient\(\s*(\d+)deg\s*,([^]*)\)$/.exec(css.trim());
  if (!m) throw new Error(`${what}: unsupported gradient "${css}"`);
  const dir = { 0: "t", 90: "r", 180: "b", 270: "l" }[Number(m[1])];
  if (!dir) throw new Error(`${what}: non-axis gradient angle ${m[1]}deg`);
  const stops = m[2].split(",").map((s) => s.trim());
  if (stops.length !== 2) {
    throw new Error(`${what}: ${stops.length}-stop gradient needs the multi-stop engine PR`);
  }
  const [from, to] = stops.map((s) => hexColor(s, what));
  return `bg-gradient-to-${dir} from-[${from}] to-[${to}]`;
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

function cookRule(
  key: string,
  rule: PartRule,
  resolve: (v: string) => string,
): string {
  const what = `${key}`;
  const parts: string[] = [];
  if (rule.layout) parts.push(rule.layout);
  if (rule.h !== undefined) {
    const h = typeof rule.h === "number" ? rule.h : px(resolve(rule.h), `${what}.h`);
    parts.push(`h-[${h}]`);
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
  if (rule.bg) parts.push(`bg-[${hexColor(resolve(rule.bg), `${what}.bg`)}]`);
  if (rule.bgFocus) parts.push(`focus:bg-[${hexColor(resolve(rule.bgFocus), `${what}.bgFocus`)}]`);
  if (rule.gradient) parts.push(lowerGradient(resolve(rule.gradient), `${what}.gradient`));
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

mkdirSync(`${repo}app/theme/cooked`, { recursive: true });

for (const spec of SPECS) {
  const snapPath = `${repo}themes-src/sheru/${spec.id}.json`;
  const snap = (await Bun.file(snapPath).json()) as Snapshot;
  const tokens = { ...snap.theme.tokens, ...(DENSITY[spec.id] ?? {}) };
  const resolve = makeResolver(tokens);

  const classes: Record<string, string> = {};
  for (const [key, rule] of Object.entries(spec.parts)) {
    const literal = cookRule(key, rule, resolve);
    let rec;
    try {
      rec = parseClassLiteral(literal);
    } catch (e) {
      throw new Error(`cook ${spec.id}/${key}: literal failed hard: ${e}\n  "${literal}"`);
    }
    if (rec === null) {
      throw new Error(`cook ${spec.id}/${key}: literal did not fully parse:\n  "${literal}"`);
    }
    classes[key] = literal;
  }

  const out =
    `// GENERATED by tools/cook-themes.ts — do not edit.\n` +
    `// Values: themes-src/sheru/${spec.id}.json (sheru ${snap.provenance.commit.slice(0, 12)}` +
    `${snap.provenance.dirty ? " +dirty" : ""}) + themes-src/density.ts\n` +
    `// Rules:  themes-src/paint/${spec.id}.ts\n` +
    `import type { ThemeSkin } from "../skin.ts";\n\n` +
    `export const ${spec.id}Skin: ThemeSkin = {\n` +
    `  id: ${JSON.stringify(spec.id)},\n` +
    `  name: ${JSON.stringify(snap.theme.name)},\n` +
    `  classes: ${JSON.stringify(classes, null, 4).replace(/\n/g, "\n  ")},\n` +
    `  metrics: ${JSON.stringify(spec.metrics)},\n` +
    `};\n`;
  const outPath = `${repo}app/theme/cooked/${spec.id}.cooked.ts`;
  await Bun.write(outPath, out);
  console.log(`cooked ${spec.id}: ${Object.keys(classes).length} part literals -> app/theme/cooked/${spec.id}.cooked.ts`);
}
