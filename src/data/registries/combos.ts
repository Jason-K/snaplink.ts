import { APPS } from "./apps";
import { VM } from "../constants/keys";
import type { MapSpec, Map } from "../primitives/maps";
import { mapSpec, type ComboOpts, type HkInput } from "./map-builder";

// ---------------------------------------------------------
// Registry
// ---------------------------------------------------------

const HK_REGISTRY = {
  focusWinBottom: mapSpec("down_arrow", VM.COC_, "focus window to the bottom", { app: APPS.onePiece, options: { repeat: false } }),
  focusWinLeft: mapSpec("left_arrow", VM.COC_, "focus window to the left", { app: APPS.onePiece, options: { repeat: false } }),
  focusWinRight: mapSpec("right_arrow", VM.COC_, "focus window to the right", { app: APPS.onePiece, options: { repeat: false } }),
  focusWinTop: mapSpec("up_arrow", VM.COC_, "focus window to the top", { app: APPS.onePiece, options: { repeat: false } }),
  raycastHere2This: mapSpec("h", VM.COCS, "raycast here2this", { app: APPS.raycast, options: { repeat: false } }),
  restoreMinimizedWindow: mapSpec("m", VM._OC_, "restore minimized windows", { app: APPS.onePiece, options: { repeat: false } }),
  selectHome: mapSpec("left_arrow", VM.C__S, "select text to the left of cursor"),
  selectEnd: mapSpec("right_arrow", VM.C__S, "select text to the right of cursor"),
  selectWordBackward: mapSpec("left_arrow", VM._O_S, "select word backward"),
  selectWordForward: mapSpec("right_arrow", VM._O_S, "select word forward"),
  selectWordLeft: mapSpec("left_arrow", VM._O_S, "select word backward"),
  selectWordRight: mapSpec("right_arrow", VM._O_S, "select word forward"),
  selectLine: mapSpec([["left_arrow", ["L.cmd"]], ["right_arrow", VM.C__S]], "select text to the end of line"),
  showBusyCal: mapSpec("7", VM.CO_S, "show busycal popup", { app: "com.busymac.busycal-setapp", options: { repeat: false } }),
  showGlyphlow: mapSpec("g", VM.COCS, "show glyphlow", { app: "glyphlow", options: { repeat: false } }),
  showKittyQuakeTerm: mapSpec("f11", VM._OCS, "show kitty quake terminal", { app: APPS.kitty, options: { repeat: false } }),
  showMissionControl: mapSpec(["vk_mission_control", "vk_none"], "show mission control"),
  showPopclip: mapSpec("f9", VM.COCS, "show showPopclip", { app: "com.pilotmoon.showPopclip", options: { repeat: false } }),
  showSidenotes: mapSpec("f10", VM.CO_S, "show sidenotes", { app: APPS.sidenotes }),
  skimHighlight: mapSpec("h", VM.C_C_, "highlight in skim", { app: APPS.skim, activeAppOnly: true, options: { repeat: false } }),
  skimUnderline: mapSpec("u", VM.C_C_, "underline in skim", { app: APPS.skim, activeAppOnly: true, options: { repeat: false } }),
  wordPrint: mapSpec("p", ["left_command"], "print in word", { app: APPS.word, activeAppOnly: true, options: { repeat: false } }),
  zenNextTab: mapSpec("open_bracket", VM.C__S, "activate next tab in Zen", { app: APPS.zen, activeAppOnly: true, options: { repeat: true } }),
  zenPreviousTab: mapSpec("close_bracket", VM.C__S, "activate previous tab in Zen", { app: APPS.zen, activeAppOnly: true, options: { repeat: false } }),
};

/**
 * Named hotkey combinations, referenced from definitions as `COMBOS.<name>`.
 *
 * `satisfies` rather than a `Record<string, MapSpec>` annotation: the annotation
 * erased the key literals, so `COMBOS.typoName` type-checked and every lookup
 * was `MapSpec | undefined`. With `satisfies` the entries are still checked
 * against `MapSpec`, but the keys stay literal — a misspelled combo name is now
 * a compile error, and a correct one needs no non-null assertion.
 */
export const COMBOS = {
  ...HK_REGISTRY,
} satisfies Record<string, MapSpec>;

// Deliberately NOT re-exported as `map`: the engine barrel already exports a
// `map()` action wrapper, and definitions import from both barrels. One `map`
// in scope, not two.
export { mapSpec };
export type { MapSpec, Map, ComboOpts, HkInput };
