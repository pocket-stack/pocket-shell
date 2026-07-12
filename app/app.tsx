// M4: the Explorer over the mock VFS in all five sheru themes, every part
// painted from the cooked skin tables (values = sheru snapshots, rules =
// paint specs).
//
//   d-pad        walk focus (controls → toolbar → sidebar → rows)
//   CIRCLE       open: enter a folder (rows), jump (sidebar), Up (toolbar)
//   SELECT       toggle window key state (active vs inactive caption)
//   L / R        cycle themes (win98 → winxp → win7 → aqua → xfce)
//
// Theme switch swaps the skin table (reactive class lookups), the era font
// atlases (runtime loadFontAtlas — slots re-register), the control glyphs,
// file icons and gradient strips. Multi-stop gradients render as baked
// strip images (<Strip>) until the engine gradient PR.
//
// Known deviations (tracked on the parity board): no 1px glyph nudge on
// press, no sidebar connector icons, no scrollbar until ScrollView; aqua
// pinstripe/gels + per-corner radii + dither per paint-spec notes.

import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { getOps } from "@pocketjs/framework";
import { Image, Text, View, type NodeMirror } from "@pocketjs/framework/components";
import { BTN, getFocused } from "@pocketjs/framework/input";
import { onButtonPress, onFrame } from "@pocketjs/framework/lifecycle";
import { get, hasPack } from "@pocketjs/framework/pak";
import { cls, type ThemeSkin } from "./theme/skin.ts";
import { win98Skin } from "./theme/cooked/win98.cooked.ts";
import { winxpSkin } from "./theme/cooked/winxp.cooked.ts";
import { win7Skin } from "./theme/cooked/win7.cooked.ts";
import { aquaSkin } from "./theme/cooked/aqua.cooked.ts";
import { xfceSkin } from "./theme/cooked/xfce.cooked.ts";
import { list, parentOf, ROOT_PATH, SIDEBAR, type VfsEntry } from "./data/vfs-mock.ts";

const SKINS: ThemeSkin[] = [win98Skin, winxpSkin, win7Skin, aquaSkin, xfceSkin];

// The list well shows this many rows until ScrollView lands (M6).
const VISIBLE_ROWS = 9;

export default function Shell() {
  const [skinIdx, setSkinIdx] = createSignal(0);
  const skin = () => SKINS[skinIdx()];
  const [winFocused, setWinFocused] = createSignal(true);
  const [cwd, setCwd] = createSignal(ROOT_PATH);
  const [focusedId, setFocusedId] = createSignal(-1);
  const [status, setStatus] = createSignal("");

  onButtonPress(BTN.SELECT, () => setWinFocused((f) => !f));
  onButtonPress(BTN.RTRIGGER, () => setSkinIdx((i) => (i + 1) % SKINS.length));
  onButtonPress(BTN.LTRIGGER, () => setSkinIdx((i) => (i + SKINS.length - 1) % SKINS.length));
  onFrame(() => {
    const id = getFocused()?.id ?? -1;
    if (id !== focusedId()) setFocusedId(id);
  });

  // Era fonts follow the skin: re-register slots 0/7 from the skin's atlas
  // pair (custom shell:font.* pak keys). Runs on mount and on every theme
  // switch, before that frame paints.
  createEffect(() => {
    const fonts = skin().fonts;
    if (!hasPack()) return;
    try {
      const ops = getOps();
      ops.loadFontAtlas?.(get(fonts.regular));
      ops.loadFontAtlas?.(get(fonts.bold));
    } catch (e) {
      console.log(`era font swap failed: ${e}`);
    }
  });

  const entries = createMemo(() => list(cwd()) ?? []);
  const visible = createMemo(() => entries().slice(0, VISIBLE_ROWS));

  const goUp = () => {
    const parent = parentOf(cwd());
    if (parent) setCwd(parent);
  };
  const open = (entry: VfsEntry) => {
    if (entry.kind === "dir") {
      const next = `${cwd()}/${entry.name}`;
      if (list(next)) setCwd(next);
      else setStatus(`${entry.name}: empty folder`);
    } else {
      setStatus(entry.kind === "app" ? `${entry.name}: needs the Mac bridge (M7)` : `${entry.name}: no viewer yet`);
    }
  };

  function iconFor(entry: VfsEntry): string {
    const g = skin().glyphs;
    if (entry.kind === "dir") return g.folder;
    const ext = entry.name.slice(entry.name.lastIndexOf(".") + 1).toLowerCase();
    return g[`file-${ext}`] ?? g.file;
  }

  /** Baked gradient-strip underlay (multi-stop bridge until the engine PR). */
  function Strip(props: { part: string }) {
    return (
      <Show when={skin().strips[props.part]}>
        <Image class="absolute inset-0" src={skin().strips[props.part]!} />
      </Show>
    );
  }

  function Control(props: { name: string }) {
    return (
      <View focusable class={cls(skin(), "control", { close: props.name === "close" })}>
        <Image class="w-[16] h-[16]" src={skin().glyphs[props.name] ?? skin().glyphs.close} />
      </View>
    );
  }

  function Controls() {
    return (
      <View debugName="Controls" class={cls(skin(), "controls")}>
        <For each={skin().chrome.order}>{(name) => <Control name={name} />}</For>
      </View>
    );
  }

  // Column grid measured off the reference at this viewport (px):
  // Name 120 (icon + label) | Date 140 | Size 72 (right) | Kind fills.
  function FileRow(props: { entry: VfsEntry }) {
    let ref: NodeMirror | undefined;
    const sel = () => focusedId() === (ref?.id ?? -2);
    const txt = () => (sel() ? "text-xs text-[#ffffff]" : "text-xs text-[#000000]");
    return (
      <View ref={ref} focusable class={cls(skin(), "file-row")} onPress={() => open(props.entry)}>
        <View class="w-[116] flex-row items-center overflow-hidden shrink-0 pl-[2]">
          <Image class="w-[16] h-[16] mr-[4] shrink-0" src={iconFor(props.entry)} />
          <Text class={txt()}>{props.entry.name}</Text>
        </View>
        <View class="w-[140] flex-row items-center overflow-hidden shrink-0 pl-[4]">
          <Text class={txt()}>{props.entry.date}</Text>
        </View>
        <View class="w-[72] flex-row items-center justify-end overflow-hidden shrink-0 pr-[6]">
          <Text class={txt()}>{props.entry.size}</Text>
        </View>
        <View class="flex-1 flex-row items-center overflow-hidden pl-[4]">
          <Text class={txt()}>{props.entry.kindLabel}</Text>
        </View>
      </View>
    );
  }

  function SidebarItem(props: { label: string }) {
    let ref: NodeMirror | undefined;
    const sel = () => focusedId() === (ref?.id ?? -2);
    return (
      <View
        ref={ref}
        focusable
        class={cls(skin(), "sidebar-item")}
        onPress={() => {
          setCwd(ROOT_PATH);
          setStatus(`${props.label}: mock view`);
        }}
      >
        {/* connector icon slot (artwork lands with a later milestone) —
            labels align with the reference's icon indent */}
        <View class="w-[20] shrink-0" />
        <Text class={sel() ? "text-xs text-[#ffffff]" : "text-xs text-[#000000]"}>{props.label}</Text>
      </View>
    );
  }

  return (
    <View debugName="Desktop" class={cls(skin(), "desktop")}>
      <View debugName="Window" class={cls(skin(), "window")}>
        <Strip part="window" />
        <View debugName="WindowFrame" class={cls(skin(), "window-frame")}>
          <View debugName="Titlebar" class={cls(skin(), "titlebar", { inactive: !winFocused() })}>
            <Strip part={winFocused() ? "titlebar" : "titlebar/inactive"} />
            <Show when={skin().chrome.side === "left"}>
              <Controls />
            </Show>
            {/* left-side chrome (aqua) centers the title in the remaining
                caption space, matching the reference */}
            <View class={skin().chrome.side === "left" ? "flex-1 flex-row justify-center items-center" : "flex-row items-center"}>
              <Text class={cls(skin(), "title", { inactive: !winFocused() })}>This Mac</Text>
            </View>
            <Show when={skin().chrome.side !== "left"}>
              <Controls />
            </Show>
          </View>

          <View debugName="Toolbar" class={cls(skin(), "toolbar")}>
            <Strip part="toolbar" />
            <View focusable class={cls(skin(), "toolbar-button")} onPress={goUp}>
              <Text class="text-xs text-black font-bold">{"<"}</Text>
            </View>
            <View focusable class={cls(skin(), "toolbar-button")} onPress={goUp}>
              <Text class="text-xs text-black font-bold">{">"}</Text>
            </View>
            {/* grid/list view toggle: list is the active view */}
            <View class="flex-row">
              <View class={cls(skin(), "segment")}>
                <Strip part="segment" />
              </View>
              <View class={cls(skin(), "segment", { selected: true })}>
                <Strip part="segment/selected" />
              </View>
            </View>
            <View debugName="Address" class={cls(skin(), "breadcrumbs")}>
              <For each={cwd().split("/")}>
                {(crumb, i) => (
                  <View class={cls(skin(), "breadcrumb")}>
                    <Text class={i() === cwd().split("/").length - 1 ? "text-xs text-black font-bold" : "text-xs text-black"}>
                      {crumb}
                    </Text>
                  </View>
                )}
              </For>
            </View>
            <View debugName="Search" class="w-[150] h-[22] flex-row items-center pt-[2] pr-[4] pb-[2] pl-[4] bg-[#ffffff] border-[#9c9c9c] shrink-0">
              <Text class="text-xs text-[#808080]">Search</Text>
            </View>
          </View>

          <View debugName="Split" class={cls(skin(), "split")}>
            <View debugName="Sidebar" class={cls(skin(), "sidebar")}>
              <For each={SIDEBAR}>
                {(section) => (
                  <>
                    <Show when={section.heading}>
                      <View class={cls(skin(), "sidebar-heading")}>
                        <Text class="text-xs text-black">{section.heading}</Text>
                      </View>
                    </Show>
                    <For each={section.items}>{(label) => <SidebarItem label={label} />}</For>
                  </>
                )}
              </For>
            </View>

            <View debugName="FileList" class={cls(skin(), "file-list")}>
              <View class={cls(skin(), "file-list-header")}>
                <View class={cls(skin(), "file-list-col", { sorted: true })} style={{ width: 120 }}>
                  <Strip part="file-list-col/sorted" />
                  <Text class="text-xs text-black">Name</Text>
                  <Image class="w-[8] h-[8] ml-[4]" src="glyphs/sort-asc.png" />
                </View>
                <View class={cls(skin(), "file-list-col")} style={{ width: 140 }}>
                  <Strip part="file-list-col" />
                  <Text class="text-xs text-black">Date Modified</Text>
                </View>
                <View class={cls(skin(), "file-list-col")} style={{ width: 72 }}>
                  <Strip part="file-list-col" />
                  <View class="flex-1 flex-row justify-end">
                    <Text class="text-xs text-black">Size</Text>
                  </View>
                </View>
                <View class={cls(skin(), "file-list-col")} style={{ grow: 1 }}>
                  <Strip part="file-list-col" />
                  <Text class="text-xs text-black">Kind</Text>
                </View>
              </View>
              <For each={visible()}>{(entry) => <FileRow entry={entry} />}</For>
            </View>
          </View>

          {/* sheru's webui omits the status bar in this composition — shown
              only for transient messages. */}
          <Show when={status() !== ""}>
            <View debugName="StatusBar" class={cls(skin(), "status-bar")}>
              <View class={cls(skin(), "status-item")} style={{ grow: 1 }}>
                <Text class="text-xs text-black">{status()}</Text>
              </View>
            </View>
          </Show>

          <View debugName="FrameEdge" class={cls(skin(), "window-frame-edge")} />
        </View>
      </View>
    </View>
  );
}
