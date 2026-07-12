// M1: the Win98 window chrome, rendered entirely from the cooked skin table
// (app/theme/cooked/win98.cooked.ts — sheru values, hand-translated rules).
//
//   SELECT      toggle window key state (active vs inactive caption)
//   d-pad       move focus across the caption controls
//   CIRCLE hold pressed control: the bevel rings invert natively (active:)
//
// Known M1 parity deviations (tracked in docs/parity/): no 1px glyph nudge
// on press (needs child-visible active state), controls show no focus
// marquee (matches sheru — caption buttons suppress it).

import { createSignal } from "solid-js";
import { Image, Text, View } from "@pocketjs/framework/components";
import { BTN } from "@pocketjs/framework/input";
import { onButtonPress } from "@pocketjs/framework/lifecycle";
import { cls } from "./theme/skin.ts";
import { win98Skin } from "./theme/cooked/win98.cooked.ts";

const skin = win98Skin;

function Control(props: { glyph: string; close?: boolean }) {
  return (
    <View focusable class={cls(skin, "control", { close: props.close ?? false })}>
      <Image class="w-[16] h-[8]" src={props.glyph} />
    </View>
  );
}

export default function Shell() {
  const [winFocused, setWinFocused] = createSignal(true);
  onButtonPress(BTN.SELECT, () => setWinFocused((f) => !f));
  return (
    <View debugName="Desktop" class={cls(skin, "desktop")}>
      <View debugName="Win98Window" class={cls(skin, "window")}>
        <View debugName="WindowFrame" class={cls(skin, "window-frame")}>
          <View debugName="Titlebar" class={cls(skin, "titlebar", { inactive: !winFocused() })}>
            <Text class={cls(skin, "title", { inactive: !winFocused() })}>This Mac</Text>
            <View debugName="Controls" class={cls(skin, "controls")}>
              <Control glyph="glyphs/win98-minimize.png" />
              <Control glyph="glyphs/win98-zoom.png" />
              <Control glyph="glyphs/win98-close.png" close />
            </View>
          </View>
          <View debugName="Body" class="flex-1" />
          <View debugName="FrameEdge" class={cls(skin, "window-frame-edge")} />
        </View>
      </View>
    </View>
  );
}
