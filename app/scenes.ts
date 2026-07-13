// Scene scripts shared by test/golden.ts (byte-exact capture) and humans
// (replay the same inputs on desktop/hardware to see the same state).
// Frame indexing matches the frame(buttons, analog) contract: the input for
// frame f is applied on that frame; edge detection needs a release between
// presses.
//
// Cursor tapes: the pointer boots parked at (2, 268) on the desktop reveal
// (outside every parity crop) and is steered by ANALOG runs. At the app's
// speed (240 px per virtual second) full deflection moves EXACTLY 4 px per
// frame at 60 Hz, so paths below are integer arithmetic: raw 255 = +1.0,
// raw 1 = -1.0 (raw 0 overshoots the deadzone rescale — never use it).
// Waypoints come from the laid-out world rects (see the PR's probe):
// Applications row (111,75 356x17), code row (111,92), Recents (15,60
// 92x17), toolbar back (15,32 22x22), close control (451,13 16x14).

import { BTN } from "@pocketjs/framework/input";

export interface FrameInput {
  buttons?: number;
  analog?: number;
}

export interface SceneSpec {
  name: string;
  frames: number;
  input?: (frame: number) => FrameInput;
  /** Parity-board RMSE region [x, y, w, h] in WINDOW coords (the board
   *  crops the golden to the window rect first). */
  region: [number, number, number, number];
  /** Theme this scene lands on (default win98) — board ref lookup. */
  theme?: string;
  /** Reference scene name in docs/parity/ref/<theme>/ (default = name). */
  refName?: string;
  /** Where the pointer rests at capture, in WINDOW coords — capture-sheru
   *  paints the same arrow into the reference so both sides carry it. */
  cursor?: [number, number];
}

/** The window rect inside the 480x272 frame (desktop reveal = 8px). */
export const WINDOW_RECT = [8, 8, 464, 256] as const;

const CHROME_STRIP: [number, number, number, number] = [0, 0, 464, 22];

const FULL_WINDOW: [number, number, number, number] = [0, 0, 464, 256];

// Packed analog values ((x << 8) | y; 128 = center): exact ±1.0 deflections.
const A_RIGHT = (255 << 8) | 128;
const A_UP = (128 << 8) | 1;
const A_UPRIGHT = (255 << 8) | 1;
const A_DOWNRIGHT = (255 << 8) | 255;
const A_DOWN = (128 << 8) | 255;

interface Seg {
  n: number;
  analog?: number;
  buttons?: number;
}

/** Play segments back to back; frames after the last segment are idle. */
const seq =
  (...segs: Seg[]) =>
  (f: number): FrameInput => {
    let at = 0;
    for (const s of segs) {
      if (f < at + s.n) return { analog: s.analog, buttons: s.buttons };
      at += s.n;
    }
    return {};
  };

const total = (...segs: Seg[]) => segs.reduce((n, s) => n + s.n, 0);

// Reusable paths from the (2, 268) park position.
const TO_CODE_ROW: Seg[] = [
  { n: 42, analog: A_UPRIGHT }, // (2,268) -> (170,100)
  { n: 7, analog: A_RIGHT }, //    -> (198,100): the "code" row
];
const TO_APPS_ROW: Seg[] = [
  { n: 46, analog: A_UPRIGHT }, // (2,268) -> (186,84): the Applications row
];
const TO_RECENTS: Seg[] = [
  { n: 15, analog: A_UPRIGHT }, // (2,268) -> (62,208)
  { n: 35, analog: A_UP }, //      -> (62,68): sidebar Recents
];
const TO_CLOSE: Seg[] = [
  { n: 62, analog: A_UPRIGHT }, // (2,268) -> (250,20): caption height
  { n: 53, analog: A_RIGHT }, //   -> (462,20): the close control
];

export const SCENES: SceneSpec[] = [
  {
    // Steer onto the "code" row: navy selection bg (hover = the native
    // focus: variant) + white row text (hover mirror signal).
    name: "list-selection",
    frames: total(...TO_CODE_ROW) + 7,
    input: seq(...TO_CODE_ROW),
    region: FULL_WINDOW,
    cursor: [190, 92],
  },
  {
    // Ride to the Applications row and CLICK it: the listing swaps to the
    // apps, the address crumbs update, and the pointer parks below the rows
    // so the fresh listing shows no hover.
    name: "navigate",
    frames: total(...TO_APPS_ROW) + 2 + 2 + 2 + 39 + 7,
    input: seq(
      ...TO_APPS_ROW,
      { n: 2 }, // settle over the row
      { n: 2, buttons: BTN.CIRCLE }, // click (release fires onPress)
      { n: 2 },
      { n: 14, analog: A_DOWNRIGHT }, // (186,84) -> (242,140)
      { n: 25, analog: A_DOWN }, //      -> (242,240): empty well
    ),
    region: FULL_WINDOW,
    cursor: [234, 232],
  },
  {
    // Steer onto the first sidebar item (Recents).
    name: "sidebar-selected",
    frames: total(...TO_RECENTS) + 7,
    input: seq(...TO_RECENTS),
    region: FULL_WINDOW,
    cursor: [54, 60],
  },
  {
    // Boot settle: active caption, three raised controls, framed face; the
    // pointer stays parked on the desktop reveal.
    name: "chrome-focused",
    frames: 8,
    region: CHROME_STRIP,
  },
  {
    // SELECT@4 toggles the window to its inactive (gray-caption) state.
    name: "chrome-unfocused",
    frames: 12,
    input: (f) => (f === 4 ? { buttons: BTN.SELECT } : {}),
    region: CHROME_STRIP,
  },
  {
    // Ride up to the close control and HOLD the press button — the harness
    // renders the final frame, so the capture shows close pressed in (the
    // active: variant under the pointer, bevel rings inverted natively).
    name: "control-pressed",
    frames: total(...TO_CLOSE) + 12,
    input: seq(...TO_CLOSE, { n: 12, buttons: BTN.CIRCLE }),
    region: CHROME_STRIP,
    cursor: [454, 12],
  },
];

// Theme-cycle scenes: R advances win98 -> winxp -> win7 -> aqua -> xfce.
// The pointer stays parked outside the window crop.
const themeScene = (name: string, theme: string, presses: number): SceneSpec => ({
  name,
  theme,
  refName: "chrome-focused",
  frames: presses * 2 + 10,
  input: (f) => (f < presses * 2 && f % 2 === 0 ? { buttons: BTN.RTRIGGER } : {}),
  region: FULL_WINDOW,
});
SCENES.push(
  themeScene("theme-winxp", "winxp", 1),
  themeScene("theme-win7", "win7", 2),
  themeScene("theme-aqua", "aqua", 3),
  themeScene("theme-xfce", "xfce", 4),
);

export const JOURNEY_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["chrome-focused", "chrome-unfocused"],
  ["chrome-focused", "control-pressed"],
  ["chrome-focused", "list-selection"],
  ["list-selection", "navigate"],
  ["chrome-focused", "sidebar-selected"],
  ["chrome-focused", "theme-winxp"],
  ["theme-winxp", "theme-win7"],
  ["theme-win7", "theme-aqua"],
  ["theme-aqua", "theme-xfce"],
];
