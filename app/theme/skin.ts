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
