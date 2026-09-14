// SPDX-License-Identifier: GPL-3.0-only
import { createTextLayout } from "@pocketjs/framework/text-layout";
import type { PadData, WinCtl } from "./state.ts";
import { padWrapW } from "./programs.tsx";

/** The accepted document and its geometry are one snapshot. While a newer
 * revision is in flight, paint retains this snapshot and hit testing waits. */
export function createPadLayout(win: WinCtl) {
  const data = win.data as PadData;
  let lines: string[] | undefined,
    width = 0,
    slot = -1,
    busy = false;
  const service = createTextLayout((state) => {
    busy = state.status === "pending";
    if (state.status === "ready")
      data.layout.set({
        status: "ready",
        lines: lines!,
        rows: state.rows,
        width,
        slot,
      });
    else
      data.layout.set({
        ...data.layout(),
        status: state.status,
        error: state.status === "error" ? state.error : undefined,
      });
  });
  return {
    step(frame: number, font: number) {
      if (busy) return; // Finish a bounded snapshot so continuous typing cannot starve paint.
      const nextLines = data.doc().lines,
        nextWidth = padWrapW(win, frame);
      if (nextLines === lines && nextWidth === width && font === slot) return;
      lines = nextLines;
      width = nextWidth;
      slot = font;
      service.update(lines.join("\n"), {
        slot,
        width: Number.isFinite(width) ? width : null,
      });
    },
    dispose: service.dispose,
  };
}
