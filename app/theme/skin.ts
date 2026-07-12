// The skin contract the app renders from. Cooked theme tables
// (app/theme/cooked/*.cooked.ts) implement it; every value in `classes` is
// a full precompiled PocketJS class literal — the whole module is scanned
// by the build, so `cls()` is a pure table lookup at runtime.

export interface ThemeSkin {
  id: string;
  name: string;
  /** "part" or "part/state" -> full class literal. */
  classes: Record<string, string>;
  /** Fixed pixel metrics (post-density). */
  metrics: Record<string, number>;
  /** Baked artwork paths (control glyphs, file icons incl. per-ext) — every
   *  value is a full literal so the build's asset scan bakes it. */
  glyphs: Record<string, string>;
  /** part-key -> baked gradient-strip underlay (multi-stop bridge until
   *  the engine gradient PR): image src + its class literal (absolute
   *  inset-0, radius-matched to the part). */
  strips: Record<string, { src: string; cls: string }>;
  /** Era font atlas pak keys (regular, bold) for the runtime slot swap. */
  fonts: { regular: string; bold: string };
  /** Caption-control layout from sheru chrome. */
  chrome: { side: "left" | "right"; order: string[] };
}

/** Look up a part's literal, preferring the first matching state variant:
 *  cls(skin, "titlebar", { inactive: !focused() }). */
export function cls(
  skin: ThemeSkin,
  part: string,
  states?: Record<string, boolean>,
): string {
  if (states) {
    for (const [state, on] of Object.entries(states)) {
      if (!on) continue;
      const v = skin.classes[`${part}/${state}`];
      if (v !== undefined) return v;
    }
  }
  const base = skin.classes[part];
  if (base === undefined) throw new Error(`skin ${skin.id}: no part "${part}"`);
  return base;
}
