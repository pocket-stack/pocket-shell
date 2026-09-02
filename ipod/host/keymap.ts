// SPDX-License-Identifier: GPL-3.0-or-later
// ipod/host/keymap.ts — Omarchy's own keyboard map, read from the machine.
//
// A SUPER chord cannot be typed at this desktop. Hyprland does not run its
// key bindings for a virtual keyboard, so `wtype -M logo -k w` reaches the
// focused application and never the compositor — SUPER+W closed nothing.
// `hyprctl binds` lists every binding but hands back an opaque Lua closure
// id, so the binding cannot be invoked either.
//
// What it can do is read the same files Hyprland read. Omarchy's bindings
// are Lua calls of one shape —
//
//   o.bind("SUPER + W", "Close window", hl.dsp.window.close())
//   o.bind("SUPER + L", "Toggle workspace layout", "omarchy-hyprland-…")
//   o.bind("SUPER + RETURN", "Terminal", { omarchy = "terminal" })
//
// — so the third argument is a dispatcher to run, a command to spawn, or one
// of Omarchy's launcher tables, whose rules are its own helpers.lua
// (`command_from`). This module turns those files into a chord -> action
// map; the daemon runs the action the desktop's own keyboard would.
//
// Nothing off the wire reaches a shell or the Lua evaluator: the device
// sends modifiers and a key name, this map is built only from the machine's
// files, and a chord it does not carry does nothing.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type BindingRun = { dispatch: string } | { exec: string };

export interface Binding {
  /** Normalised: modifiers in a fixed order, then the key. `SUPER+SHIFT+F`. */
  chord: string;
  description: string;
  run: BindingRun;
}

/** The order modifiers are written in a normalised chord. */
const MOD_ORDER = ["SUPER", "CTRL", "ALT", "SHIFT"] as const;
const MOD_ALIAS: Record<string, string> = {
  SUPER: "SUPER",
  MOD: "SUPER",
  LOGO: "SUPER",
  WIN: "SUPER",
  CTRL: "CTRL",
  CONTROL: "CTRL",
  ALT: "ALT",
  SHIFT: "SHIFT",
};

/** Key names Omarchy writes that the device spells differently. */
const KEY_ALIAS: Record<string, string> = {
  RETURN: "RETURN",
  ENTER: "RETURN",
  SPACE: "SPACE",
  TAB: "TAB",
  ESCAPE: "ESCAPE",
  ESC: "ESCAPE",
  SLASH: "SLASH",
  PERIOD: "PERIOD",
  COMMA: "COMMA",
  MINUS: "MINUS",
  EQUAL: "EQUAL",
  BACKSPACE: "BACKSPACE",
  DELETE: "DELETE",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  UP: "UP",
  DOWN: "DOWN",
  HOME: "HOME",
  END: "END",
};

/** One chord in the form this module keys its map by. */
export function chordKey(mods: readonly string[], key: string): string {
  const seen = new Set<string>();
  for (const mod of mods) {
    const name = MOD_ALIAS[mod.trim().toUpperCase()];
    if (name) seen.add(name);
  }
  const ordered = MOD_ORDER.filter((mod) => seen.has(mod));
  const plain = key.trim().toUpperCase();
  return [...ordered, KEY_ALIAS[plain] ?? plain].join("+");
}

/** `"SUPER + SHIFT + F"` as Omarchy writes it. Returns null for a chord
 *  this map cannot key — a mouse button, a raw keycode (the workspace
 *  bindings use `code:10`, which the strip's tabs already cover). */
function parseChord(text: string): string | null {
  const parts = text.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts[parts.length - 1]!;
  if (/^(code:|mouse:)/i.test(key)) return null;
  // A chord needs a key: `"SUPER + " .. key` from the workspace loop reads
  // as modifiers alone, and those are not a chord.
  if (MOD_ALIAS[key.toUpperCase()]) return null;
  const mods = parts.slice(0, -1);
  for (const mod of mods) if (!MOD_ALIAS[mod.toUpperCase()]) return null;
  return chordKey(mods, key);
}

/** Whether an argument ended where an argument may end, rather than in the
 *  middle of an expression: `"SUPER + " .. key` is a computed chord this
 *  cannot read, and reading only its first half would invent a binding. */
function endsArgument(source: string, at: number): boolean {
  let j = at;
  while (j < source.length && /\s/.test(source[j]!)) j += 1;
  return j >= source.length || source[j] === "," || source[j] === ")";
}

/** Read a balanced `(`/`{` group starting at `from`, or a quoted string. */
function readArgument(source: string, from: number): { text: string; end: number } | null {
  let at = from;
  while (at < source.length && /\s/.test(source[at]!)) at += 1;
  if (at >= source.length) return null;
  const first = source[at]!;
  if (first === '"' || first === "'") {
    let j = at + 1;
    while (j < source.length && source[j] !== first) {
      if (source[j] === "\\") j += 1;
      j += 1;
    }
    return { text: source.slice(at, j + 1), end: j + 1 };
  }
  let depth = 0;
  let j = at;
  let quote = "";
  for (; j < source.length; j += 1) {
    const ch = source[j]!;
    if (quote) {
      if (ch === "\\") j += 1;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (depth === 0) break; // the o.bind( call's own closer
      depth -= 1;
    } else if (ch === "," && depth === 0) break;
  }
  return { text: source.slice(at, j).trim(), end: j };
}

function unquote(text: string): string | null {
  if (text.length < 2) return null;
  const quote = text[0];
  if ((quote !== '"' && quote !== "'") || text[text.length - 1] !== quote) return null;
  return text.slice(1, -1).replace(/\\(.)/g, "$1");
}

/** A Lua table field's string value: `{ omarchy = "terminal" }` -> the value. */
function field(table: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*(".*?"|'.*?')`, "s").exec(table);
  return match ? unquote(match[1]!) : null;
}

function hasField(table: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*=`).test(table);
}

/** Shell-quote the way Omarchy's own helper does. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Omarchy's `command_from`: a launcher table becomes the command line its
 * helpers.lua builds. Unsupported shapes return null and the chord is
 * simply not in the map.
 */
function commandFromTable(table: string, description: string): string | null {
  const omarchy = field(table, "omarchy");
  if (omarchy) return `omarchy-launch-${omarchy}`;
  const webapp = field(table, "webapp");
  if (webapp) {
    return hasField(table, "focus")
      ? `omarchy-launch-or-focus-webapp ${shellQuote(description)} ${shellQuote(webapp)}`
      : `omarchy-launch-webapp ${shellQuote(webapp)}`;
  }
  const tui = field(table, "tui");
  if (tui) {
    return hasField(table, "focus") ? `omarchy-launch-or-focus-tui ${shellQuote(tui)}` : `omarchy-launch-tui ${shellQuote(tui)}`;
  }
  const launch = field(table, "launch");
  if (launch) {
    const focus = field(table, "focus");
    return focus
      ? `omarchy-launch-or-focus ${shellQuote(focus)} ${shellQuote(`uwsm-app -- ${launch}`)}`
      : `uwsm-app -- ${launch}`;
  }
  return null;
}

/** Every `o.bind(...)` in one Lua source, as chord -> action. */
export function parseBindings(source: string): Binding[] {
  const out: Binding[] = [];
  const call = /\bo\.bind\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(source))) {
    const keys = readArgument(source, match.index + match[0].length);
    if (!keys || !endsArgument(source, keys.end)) continue;
    const chordText = unquote(keys.text);
    if (!chordText) continue; // a computed chord (the workspace loop)
    const chord = parseChord(chordText);
    if (!chord) continue;
    const rest = source[keys.end] === "," ? keys.end + 1 : keys.end;
    const describe = readArgument(source, rest);
    if (!describe || !endsArgument(source, describe.end)) continue;
    const description = unquote(describe.text) ?? "";
    const third = readArgument(source, source[describe.end] === "," ? describe.end + 1 : describe.end);
    if (!third || third.text === "") continue;
    const text = third.text;
    let run: BindingRun | null = null;
    if (/^hl\.dsp\.[A-Za-z_.]+\s*\(/.test(text)) run = { dispatch: text };
    else if (text.startsWith("{")) {
      const command = commandFromTable(text, description);
      if (command) run = { exec: command };
    } else {
      const command = unquote(text);
      if (command) run = { exec: command };
    }
    if (run) out.push({ chord, description, run });
  }
  return out;
}

/** Where the machine keeps its bindings: Omarchy's own, then the user's. */
export function bindingFiles(env: NodeJS.ProcessEnv = process.env): string[] {
  const share = env.OMARCHY_PATH ?? "/usr/share/omarchy";
  const files: string[] = [];
  const bindings = join(share, "default/hypr/bindings");
  try {
    for (const entry of readdirSync(bindings).sort()) {
      if (entry.endsWith(".lua")) files.push(join(bindings, entry));
    }
  } catch {
    // no bindings directory: an Omarchy this daemon does not know
  }
  for (const path of [join(share, "default/hypr/bindings.lua"), join(homedir(), ".config/hypr/bindings.lua")]) {
    if (existsSync(path)) files.push(path);
  }
  return files;
}

/** The machine's chord map. Later files win, so the user's bindings do. */
export function readKeymap(env: NodeJS.ProcessEnv = process.env): Map<string, Binding> {
  const map = new Map<string, Binding>();
  for (const file of bindingFiles(env)) {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const binding of parseBindings(source)) map.set(binding.chord, binding);
  }
  return map;
}
