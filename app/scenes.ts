// Scene scripts shared by test/golden.ts (byte-exact capture) and humans
// (replay the same buttons on desktop/hardware to see the same state).
// Frame indexing matches the frame(buttons, analog) contract: the input for
// frame f is applied on that frame; edge detection needs a release between
// presses.

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
}

/** The window rect inside the 480x272 frame (desktop reveal = 8px). */
export const WINDOW_RECT = [8, 8, 464, 256] as const;

const CHROME_STRIP: [number, number, number, number] = [0, 0, 464, 22];

const FULL_WINDOW: [number, number, number, number] = [0, 0, 464, 256];

// Focus order is document DFS: 3 caption controls → 2 toolbar buttons →
// 10 sidebar items → file rows. Press/release pairs per DOWN.
const downs = (n: number) => (f: number) => (f < n * 2 && f % 2 === 0 ? { buttons: BTN.DOWN } : {});

export const SCENES: SceneSpec[] = [
  {
    // Walk focus to the "code" row (17th focusable): navy selection bg
    // (native focus:) + white row text (focus mirror signal).
    name: "list-selection",
    frames: 44,
    input: downs(17),
    region: FULL_WINDOW,
  },
  {
    // Walk to the "Applications" row (16th) and open it with CIRCLE:
    // listing swaps to the apps, the address crumbs update.
    name: "navigate",
    frames: 48,
    input: (f) => (f < 32 && f % 2 === 0 ? { buttons: BTN.DOWN } : f === 36 ? { buttons: BTN.CIRCLE } : {}),
    region: FULL_WINDOW,
  },
  {
    // Walk to the first sidebar item (Recents, 6th focusable).
    name: "sidebar-selected",
    frames: 20,
    input: downs(6),
    region: FULL_WINDOW,
  },
  {
    // Boot settle: active caption, three raised controls, framed face.
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
    // DOWN@4 focuses minimize, RIGHT@8/12 walks to close; CIRCLE held from
    // 16 through the end — the harness renders the final frame, so the
    // capture shows close pressed in (bevel rings inverted natively).
    name: "control-pressed",
    frames: 24,
    input: (f) =>
      f === 4
        ? { buttons: BTN.DOWN }
        : f === 8 || f === 12
          ? { buttons: BTN.RIGHT }
          : f >= 16
            ? { buttons: BTN.CIRCLE }
            : {},
    region: CHROME_STRIP,
  },
];

// Theme-cycle scenes: R advances win98 -> winxp -> win7 -> aqua -> xfce.
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
