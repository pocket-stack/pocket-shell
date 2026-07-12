// M0 boot scene: the era desktop + an inert window shell. This is the
// scaffold-health check only — theming (bevel rings, caption gradients,
// cooked sheru skins) lands with M1; until then the window is flat gray
// with a navy caption so the golden has structure to pin.

import { Text, View } from "@pocketjs/framework/components";

export default function Shell() {
  return (
    <View class="w-full h-full flex-col justify-center items-center bg-[#008080]">
      <View
        debugName="ShellWindow"
        class="w-[464] h-[256] flex-col bg-[#c0c0c0] p-[3] border-[#000000]"
      >
        <View
          debugName="Titlebar"
          class="h-[18] flex-row items-center pl-[4] bg-gradient-to-r from-[#000080] to-[#1084d0]"
        >
          <Text class="text-xs text-white font-bold tracking-wide">POCKETSHELL</Text>
        </View>
        <View class="flex-1 flex-col justify-center items-center gap-[6]">
          <Text class="text-xs text-black">M0 — engine online.</Text>
          <Text class="text-xs text-[#808080]">sheru themes arrive with M1.</Text>
        </View>
      </View>
    </View>
  );
}
