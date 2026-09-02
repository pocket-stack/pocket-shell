// test/tape.test.ts — the recordings' own rules, checked without an emulator.
//
// A cut is a range of a tape's frame dump, and the two can drift: a range
// that reaches into the next gesture puts two whole-deck swaps into one short
// animation, which reads as flicker rather than as an interaction. That is
// not hypothetical — the first cuts of chords, swap, layout and workspace all
// did it, and the animations went out that way.

import { describe, expect, test } from "bun:test";
import { BTN } from "../vendor/pocketjs/contracts/spec/spec.ts";
import { assertOneGesture, CUTS, SHELL_TAPE, STILLS, TAPES, tapeNamed, type Cut } from "../film/tape.ts";

describe("the film's cuts", () => {
  test("every cut shows exactly one gesture, inside its tape", () => {
    expect(CUTS.length).toBeGreaterThan(0);
    for (const cut of CUTS) {
      const tape = tapeNamed(cut.tape);
      expect(() => assertOneGesture(cut, tape)).not.toThrow();
      expect(cut.from).toBeLessThan(cut.to);
      expect(cut.step).toBeGreaterThanOrEqual(1);
      expect(cut.caption.length).toBeGreaterThan(20);
    }
  });

  test("the guard rejects a range that runs into the next chord", () => {
    const base: Cut = { ...CUTS[0]!, tape: "pocket-shell" };
    // The tape holds L at 52..66 and R at 70..80. 48..70 was the first cut of
    // `chords`: it ends on the frame R goes down, so the animation's last
    // frame is already the next gesture's chord map.
    expect(() => assertOneGesture({ ...base, name: "runs-in", from: 48, to: 70 }, SHELL_TAPE)).toThrow(
      /still held at its last frame \(70\)/,
    );
    // 114..146 spanned both workspace steps with three plain frames between
    // them: the deck went chord map, minimap, chord map inside one animation.
    expect(() => assertOneGesture({ ...base, name: "two-gestures", from: 114, to: 143 }, SHELL_TAPE)).toThrow(
      /shoulders move 4 times/,
    );
    expect(() => assertOneGesture({ ...base, name: "past-the-end", from: 240, to: 400 }, SHELL_TAPE)).toThrow(
      /past the tape's 245/,
    );
  });

  test("a cut's ends are frames the tape leaves the shoulders alone", () => {
    for (const cut of CUTS) {
      const tape = tapeNamed(cut.tape);
      const shoulders = BTN.LTRIGGER | BTN.RTRIGGER;
      expect((tape.input?.(cut.from) ?? 0) & shoulders).toBe(0);
      expect((tape.input?.(cut.to) ?? 0) & shoulders).toBe(0);
    }
  });

  test("stills and goldens name frames their tape actually runs", () => {
    for (const still of STILLS) {
      const tape = tapeNamed(still.tape);
      expect(still.frame).toBeLessThan(tape.frames);
    }
    for (const tape of TAPES) {
      for (const frame of tape.capture) expect(frame).toBeLessThan(tape.frames);
    }
  });
});
