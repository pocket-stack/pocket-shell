// M2: the Win98 Explorer interior over the mock VFS, every part painted
// from the cooked skin table (values = sheru snapshot, rules = paint spec).
//
//   d-pad        walk focus (toolbar buttons → sidebar items → file rows)
//   CIRCLE       open: enter a folder (rows), jump (sidebar), Up/Back (toolbar)
//   SELECT       toggle window key state (active vs inactive caption)
//
// Selection model: rows/items are engine-focusable — the navy selection bg
// is the native focus: variant (zero JS); the white selected-text swap is a
// per-frame focus mirror signal (writes only on change).
//
// Known deviations (tracked on the parity board): no 1px glyph nudge on
// press, no sidebar connector icons, no scrollbar — listings are cut to
// the visible rows until ScrollView lands.

import { createMemo, createSignal, For, Show } from "solid-js";
import { Image, Text, View, type NodeMirror } from "@pocketjs/framework/components";
import { BTN, getFocused } from "@pocketjs/framework/input";
import { onButtonPress, onFrame } from "@pocketjs/framework/lifecycle";
import { cls } from "./theme/skin.ts";
import { win98Skin } from "./theme/cooked/win98.cooked.ts";
import { list, parentOf, ROOT_PATH, SIDEBAR, type VfsEntry } from "./data/vfs-mock.ts";

const skin = win98Skin;

// The list well shows this many rows until ScrollView lands (M6).
const VISIBLE_ROWS = 9;

// Ext-badged file icons (tools/gen-assets.ts bakes one per known ext from
// sheru's `text` glyph shape). FULL literals — the build's asset scan
// collects string literals, so every path here gets baked into the pak.
const FILE_ICONS: Record<string, string> = {
  md: "glyphs/win98-icon-file-md.png",
  png: "glyphs/win98-icon-file-png.png",
  pbp: "glyphs/win98-icon-file-pbp.png",
  xlsx: "glyphs/win98-icon-file-xlsx.png",
  txt: "glyphs/win98-icon-file-txt.png",
  pdf: "glyphs/win98-icon-file-pdf.png",
  json: "glyphs/win98-icon-file-json.png",
};

function iconFor(entry: VfsEntry): string {
  if (entry.kind === "dir") return "glyphs/win98-icon-folder.png";
  const ext = entry.name.slice(entry.name.lastIndexOf(".") + 1).toLowerCase();
  return FILE_ICONS[ext] ?? "glyphs/win98-icon-file.png";
}

function Control(props: { glyph: string; close?: boolean }) {
  return (
    <View focusable class={cls(skin, "control", { close: props.close ?? false })}>
      <Image class="w-[16] h-[8]" src={props.glyph} />
    </View>
  );
}

export default function Shell() {
  const [winFocused, setWinFocused] = createSignal(true);
  const [cwd, setCwd] = createSignal(ROOT_PATH);
  const [focusedId, setFocusedId] = createSignal(-1);
  const [status, setStatus] = createSignal("");

  onButtonPress(BTN.SELECT, () => setWinFocused((f) => !f));
  onFrame(() => {
    const id = getFocused()?.id ?? -1;
    if (id !== focusedId()) setFocusedId(id);
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

  const isSel = (mirror: () => NodeMirror | undefined) => focusedId() === (mirror()?.id ?? -2);

  // Column grid measured off the reference at this viewport (px):
  // Name 120 (icon + label) | Date 140 | Size 72 (right) | Kind fills.
  function FileRow(props: { entry: VfsEntry }) {
    let ref: NodeMirror | undefined;
    const sel = () => focusedId() === (ref?.id ?? -2);
    const txt = () => (sel() ? "text-xs text-[#ffffff]" : "text-xs text-[#000000]");
    return (
      <View ref={ref} focusable class={cls(skin, "file-row")} onPress={() => open(props.entry)}>
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
        class={cls(skin, "sidebar-item")}
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

  void isSel;
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

          <View debugName="Toolbar" class={cls(skin, "toolbar")}>
            <View focusable class={cls(skin, "toolbar-button")} onPress={goUp}>
              <Text class="text-xs text-black font-bold">{"<"}</Text>
            </View>
            <View focusable class={cls(skin, "toolbar-button")} onPress={goUp}>
              <Text class="text-xs text-black font-bold">{">"}</Text>
            </View>
            {/* grid/list view toggle: list is the active view (its dither
                wash needs the pattern-fill engine PR) */}
            <View class="flex-row">
              <View class={cls(skin, "segment")} />
              <View class={cls(skin, "segment", { selected: true })} />
            </View>
            <View debugName="Address" class={cls(skin, "breadcrumbs")}>
              <For each={cwd().split("/")}>
                {(crumb, i) => (
                  <View class={cls(skin, "breadcrumb")}>
                    <Text class={i() === cwd().split("/").length - 1 ? "text-xs text-black font-bold" : "text-xs text-black"}>
                      {crumb}
                    </Text>
                  </View>
                )}
              </For>
            </View>
            <View debugName="Search" class="w-[150] h-[22] flex-row items-center pt-[2] pr-[4] pb-[2] pl-[4] bg-[#ffffff] bevel-[#808080,#ffffff,#000000,#dfdfdf] shrink-0">
              <Text class="text-xs text-[#808080]">Search</Text>
            </View>
          </View>

          <View debugName="Split" class={cls(skin, "split")}>
            <View debugName="Sidebar" class={cls(skin, "sidebar")}>
              <For each={SIDEBAR}>
                {(section) => (
                  <>
                    <Show when={section.heading}>
                      <View class={cls(skin, "sidebar-heading")}>
                        <Text class="text-xs text-black">{section.heading}</Text>
                      </View>
                    </Show>
                    <For each={section.items}>{(label) => <SidebarItem label={label} />}</For>
                  </>
                )}
              </For>
            </View>

            <View debugName="FileList" class={cls(skin, "file-list")}>
              <View class={cls(skin, "file-list-header")}>
                <View class={cls(skin, "file-list-col", { sorted: true })} style={{ width: 120 }}>
                  <Text class="text-xs text-black">Name</Text>
                  <Image class="w-[8] h-[8] ml-[4]" src="glyphs/sort-asc.png" />
                </View>
                <View class={cls(skin, "file-list-col")} style={{ width: 140 }}>
                  <Text class="text-xs text-black">Date Modified</Text>
                </View>
                <View class={cls(skin, "file-list-col")} style={{ width: 72 }}>
                  <View class="flex-1 flex-row justify-end">
                    <Text class="text-xs text-black">Size</Text>
                  </View>
                </View>
                <View class={cls(skin, "file-list-col")} style={{ grow: 1 }}>
                  <Text class="text-xs text-black">Kind</Text>
                </View>
              </View>
              <For each={visible()}>{(entry) => <FileRow entry={entry} />}</For>
            </View>
          </View>

          {/* sheru's webui omits the status bar in this composition — parity
              keeps it out; the cooked status parts wait for a later view.
              The status signal still surfaces transient messages here. */}
          <Show when={status() !== ""}>
            <View debugName="StatusBar" class={cls(skin, "status-bar")}>
              <View class={cls(skin, "status-item")} style={{ grow: 1 }}>
                <Text class="text-xs text-black">{status()}</Text>
              </View>
            </View>
          </Show>

          <View debugName="FrameEdge" class={cls(skin, "window-frame-edge")} />
        </View>
      </View>
    </View>
  );
}
