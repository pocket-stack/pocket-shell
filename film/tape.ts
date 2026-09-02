// film/tape.ts — the scripted runs. One tape is a frame-indexed function from
// frame number to buttons and touch contacts; the console's capture build
// bakes it in and dumps one frame per index, so a run is a pure function of
// its tape and every frame is reproducible byte for byte.
//
// The same tapes serve three consumers, which is the point: the animations in
// the README, the byte-exact frames in test/goldens/3ds/, and the headless
// replay in test/sim.test.ts. An animation can therefore never show behaviour
// the tests do not pin.

import type { GoldenSpec } from "../vendor/pocketjs/tests/golden-specs.ts";
import { BTN } from "../vendor/pocketjs/contracts/spec/spec.ts";

/** The shell tape: open three windows, walk the whole chord grammar, then
 *  close a window by touch. 245 frames at 60 Hz. */
export const SHELL_TAPE: GoldenSpec = {
  name: "pocket-shell",
  frames: 245,
  capture: [3, 48, 60, 84, 112, 126, 160, 176, 214, 240],
  // Three dock taps open term, notes and about (about stacks under notes:
  // dwindle splits the taller side). Then the shoulder grammar: L + LEFT
  // focuses term with the deck showing the L chord map (frame 60); R +
  // RIGHT swaps term with notes (84); L + START turns the workspace into
  // the scrolling layout (112); L+R + RIGHT lands on the empty workspace 2
  // with the L+R map up (126) and L+R + LEFT returns; L + SELECT opens the
  // key sheet (160); L + A opens the launcher on the deck (176) and B
  // closes it. Last, a hold on term's minimap tile arms the close bar
  // (214) and a slide onto it closes the window (240).
  input: (frame) => {
    let mask = 0;
    if (frame >= 52 && frame <= 66) mask |= BTN.LTRIGGER;
    if (frame >= 56 && frame <= 57) mask |= BTN.LEFT;
    if (frame >= 70 && frame <= 80) mask |= BTN.RTRIGGER;
    if (frame >= 74 && frame <= 75) mask |= BTN.RIGHT;
    if (frame >= 88 && frame <= 98) mask |= BTN.LTRIGGER;
    if (frame >= 92 && frame <= 93) mask |= BTN.START;
    if (frame >= 116 && frame <= 128) mask |= BTN.LTRIGGER | BTN.RTRIGGER;
    if (frame >= 120 && frame <= 121) mask |= BTN.RIGHT;
    if (frame >= 132 && frame <= 140) mask |= BTN.LTRIGGER | BTN.RTRIGGER;
    if (frame >= 134 && frame <= 135) mask |= BTN.LEFT;
    if (frame >= 144 && frame <= 156) mask |= BTN.LTRIGGER;
    if (frame >= 148 && frame <= 149) mask |= BTN.SELECT;
    if (frame >= 164 && frame <= 172) mask |= BTN.LTRIGGER;
    if (frame >= 166 && frame <= 167) mask |= BTN.CIRCLE;
    if (frame >= 180 && frame <= 181) mask |= BTN.CROSS;
    return mask;
  },
  touch: (frame) => {
    // Dock cells are 48 px from x = 16; the dock is the bottom 40 px.
    if (frame >= 6 && frame <= 7) return [{ id: 0, x: 40, y: 222 }];
    if (frame >= 16 && frame <= 17) return [{ id: 0, x: 136, y: 222 }];
    if (frame >= 26 && frame <= 27) return [{ id: 0, x: 280, y: 222 }];
    // Hold term's tile on the minimap (scrolling layout: the second
    // column), then slide down onto the close bar and release.
    if (frame >= 186 && frame <= 216) return [{ id: 1, x: 214, y: 106 }];
    if (frame >= 217 && frame <= 222) return [{ id: 1, x: 214, y: 106 + (frame - 216) * 12 }];
    return [];
  },
};

/** Every applet, opened from the dock. The first tape only ever opened three
 *  of the six, and mounting one of the others is what overflowed the guest's
 *  JS stack on hardware — see docs/DESIGN.md, "The depth budget". */
export const APPLETS_TAPE: GoldenSpec = {
  name: "pocket-shell-applets",
  app: "pocket-shell",
  frames: 95,
  // Frame 7 lands inside the first dock tap, so it captures the pressed
  // look a painted button needs on a panel with no hover.
  capture: [7, 40, 90],
  touch: (frame) => {
    const taps = [6, 16, 26, 36, 46, 56];
    const index = taps.indexOf(frame);
    if (index >= 0) return [{ id: 0, x: 40 + index * 48, y: 222 }];
    const held = taps.indexOf(frame - 1);
    if (held >= 0) return [{ id: 0, x: 40 + held * 48, y: 222 }];
    return [];
  },
};

export const TAPES: readonly GoldenSpec[] = [SHELL_TAPE, APPLETS_TAPE];

export function tapeNamed(name: string): GoldenSpec {
  const tape = TAPES.find((candidate) => candidate.name === name);
  if (!tape) throw new Error(`no tape named ${JSON.stringify(name)} (have ${TAPES.map((t) => t.name).join(", ")})`);
  return tape;
}

/** One animation cut out of a tape's frame dump. */
export interface Cut {
  /** media/<name>.gif */
  name: string;
  tape: string;
  /** Inclusive frame range of the dump. */
  from: number;
  to: number;
  /** Keep every nth frame (2 = 30 fps out of the tape's 60). */
  step: number;
  /** Playback rate of the encoded animation. */
  fps: number;
  /** What it shows. Becomes the README's alt text. */
  caption: string;
}

/** The animations the README shows. Each range is read off the tape's own
 *  comments above, so a cut cannot drift from what the tape does. */
export const CUTS: readonly Cut[] = [
  {
    name: "open",
    tape: "pocket-shell",
    from: 0,
    to: 46,
    step: 2,
    fps: 30,
    caption:
      "three dock taps open term, notes and about; each window splits the focused leaf along its longer side, and the deck's minimap follows",
  },
  {
    name: "chords",
    tape: "pocket-shell",
    from: 48,
    to: 70,
    step: 2,
    fps: 30,
    caption:
      "holding L turns the deck's minimap into the chord map for the window layer, and the d-pad moves focus while it is up",
  },
  {
    name: "swap",
    tape: "pocket-shell",
    from: 68,
    to: 90,
    step: 2,
    fps: 30,
    caption: "R and the d-pad swap two tiled windows; the geometry eases rather than cutting",
  },
  {
    name: "layout",
    tape: "pocket-shell",
    from: 86,
    to: 118,
    step: 2,
    fps: 30,
    caption:
      "L + START turns the workspace from the dwindle tree into the scrolling strip, keeping window order and focus",
  },
  {
    name: "workspace",
    tape: "pocket-shell",
    from: 114,
    to: 146,
    step: 2,
    fps: 30,
    caption: "L + R makes the d-pad step workspaces; the stage slides and the strip's tab follows",
  },
  {
    name: "keys",
    tape: "pocket-shell",
    from: 142,
    to: 186,
    step: 2,
    fps: 30,
    caption: "L + SELECT puts the whole chord table on the stage; L + A opens the launcher on the deck",
  },
  {
    name: "close",
    tape: "pocket-shell",
    from: 184,
    to: 244,
    step: 2,
    fps: 30,
    caption:
      "closing is a hold, a slide and a release: holding a tile on the minimap arms the close bar, sliding onto it and letting go closes the window",
  },
];

/** Stills the README shows, cut from the same dumps. */
export interface Still {
  name: string;
  tape: string;
  frame: number;
  caption: string;
}

export const STILLS: readonly Still[] = [
  { name: "stage-dwindle", tape: "pocket-shell", frame: 48, caption: "three windows in the dwindle layout" },
  { name: "stage-scrolling", tape: "pocket-shell", frame: 112, caption: "the same windows in the scrolling layout" },
  { name: "deck-chords", tape: "pocket-shell", frame: 60, caption: "the L chord map on the deck" },
  { name: "stage-keysheet", tape: "pocket-shell", frame: 160, caption: "the key sheet on the stage" },
  { name: "deck-launcher", tape: "pocket-shell", frame: 176, caption: "the launcher on the deck" },
  { name: "applets", tape: "pocket-shell-applets", frame: 90, caption: "every applet open at once" },
];
