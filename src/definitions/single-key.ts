import { APPS, CMDS, COMBOS, URLS, VM } from "../data";
import { capsVars } from "./caps-lock";
import {
  actHere,
  bind,
  map,
  from,
  hold,
  key,
  app,
  url,
  options,
  press,
  release,
  shell,
  to,
  when,
  type Binding,
  unlessApp,
  ifApp,
  condNotVar,
} from "../engine";

//   SINGLE KEY TAP/HOLD RULES — one binding per key; hold fires the action,
//   tap passes the key through (the engine's default-alone behavior).

const numBindings: Binding[] = [
  bind(from("8"), to(hold(app(APPS.ringCentral)))),
  bind(from("keypad_0"), to(hold(url(URLS.winsUnstashAll, true)))),
  bind(from("keypad_2"), to(hold(url(URLS.winStashDown, true)))),
  bind(from("keypad_4"), to(hold(url(URLS.winStashLeft, true)))),
  bind(from("keypad_5"), to(hold(url(URLS.winsUnstash, true)))),
  bind(from("keypad_6"), to(hold(url(URLS.winStashRight, true)))),
  bind(from("keypad_8"), to(hold(url(URLS.winStashUp, true)))),
];

const letterBindings: Binding[] = [
  bind(from("a"), to(hold(key("f18", VM.COCS)))),
  bind(from("c"), to(hold(app(APPS.claude, "shell")))),
  bind(from("d"), to(hold(key("f1", VM.CO_S)))),
  bind(from("f"), to(hold(actHere("qspace")))),
  bind(from("g"), to(hold(map(COMBOS.showGlyphlow)))),
  bind(from("h"), to(hold(url(URLS.rayHere2There)))),
  bind(from("j"), to(hold(url(URLS.rayRecentDownloads)))),
  bind(from("k"), to(hold(app(APPS.kitty)))),
  bind(from("n"), to(hold(shell(CMDS.neruHints)))),
  bind(from("o"), to(hold(url(URLS.csxOcrNoLinebreaks)))),
  bind(from("p"), to(hold(map(COMBOS.showPopclip)))),
  bind(from("q"), to(hold(app(APPS.qspace)))),
  bind(from("r"), to(hold(shell(CMDS.recentFiles)))),
  bind(from("s"), to(hold(url(URLS.csxArea)))),
  bind(from("s", ["shift"]), to(hold(url(URLS.csxWindow)))),
  bind(from("t"), to(hold(map(COMBOS.showKittyQuakeTerm)))),
  bind(from("v"), to(hold(url(URLS.rayClipboard)))),
  bind(from("x"), to(hold(actHere("copy")))),
  bind(from("y"), to(hold(actHere("copy")))),
  bind(from("z"), to(hold(url(URLS.rayZoxideSearchDirs)))),
];

const symbolBindings: Binding[] = [
  bind(
    from("keypad_equal_sign"),
    to(
      release(key("keypad_equal_sign", { halt: true })),
      hold([
        map(COMBOS.selectWordLeft),
        shell(CMDS.quickDate),
      ]),
    ),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(
    from("equal_sign"),
    to(
      release(key("keypad_equal_sign", { halt: true })),
      hold([
        map(COMBOS.selectWordLeft),
        shell(CMDS.quickDate),
      ]),
    ),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(from("slash"), to(hold(map(COMBOS.raycastHere2This)))),
  bind(from("grave_accent_and_tilde"), to(hold(map(COMBOS.showPopclip)))),
];

const nonCharBindings: Binding[] = [
  bind(
    from("keypad_enter"),
    to(
      release(key("keypad_enter", { halt: true })),
      hold(shell(CMDS.evalSelectionPart)).when(unlessApp(APPS.excel)),
      hold(key("f2")).when(ifApp(APPS.excel)),
    ),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(
    from("return_or_enter"),
    to(
      release(key("return_or_enter", { halt: true })),
      hold(shell(CMDS.evalSelectionPart)).when(unlessApp(APPS.excel)),
      hold(key("f2")).when(ifApp(APPS.excel)),
    ),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(from("tab"), to(hold(key("mission_control", { halt: true, repeat: true })))),
  bind(
    from("escape"),
    to(
      release(key("escape")),
      hold(shell(CMDS.killForeground)),
      hold(shell(CMDS.killAllApps)).withTapCount(2),
    ),
    options({
      multiTap: { mods: [] },
    }),
  ),
  bind(from("home"), to(press(key("left_arrow", ["left_command"])))),
  bind(from("end"), to(press(key("right_arrow", ["left_command"])))),
];

const functionKeyBindings: Binding[] = [
  bind(from("f1"), to(hold(key("display_brightness_decrement", { repeat: true })))),
  bind(from("f2"), to(hold(key("display_brightness_increment", { repeat: true })))),
  bind(from("f3"), to(hold(key("mission_control")))),
  bind(from("f4"), to(hold(key("launchpad")))),
  bind(from("f5"), to(hold(key("f5", VM.COC_)))),
  bind(from("f7"), to(hold(key("rewind", { repeat: true })))),
  bind(from("f8"), to(hold(key("play_or_pause")))),
  bind(from("f9"), to(hold(key("fastforward", { repeat: true })))),
  bind(from("f10"), to(hold(key("mute")))),
  bind(from("f11"), to(hold(key("volume_decrement", { repeat: true })))),
  bind(from("f12"), to(hold(key("volume_increment", { repeat: true })))),
];

const modifierKeyBindings: Binding[] = [
  bind(
    from("left_shift"),
    to(
      release(key("left_shift")),
      hold(key("left_shift")),
      release(url(URLS.rayClipboard)).withTapCount(2),
    ),
    // Do not intercept left_command while caps lock is held: caps emits
    // left_command as its hyper-modifier key_code, and this rule's lazy
    // transform would otherwise drop cmd from the caps modifier set.
    when(condNotVar(capsVars.pressed, 1)),
    options({
      multiTap: { allowPassThrough: true, mods: [] },
    }),
  ),
  bind(
    from("right_shift"),
    to(
      release(key("right_shift")),
      hold(key("right_shift")),
      release(url(URLS.rayClipboard)).withTapCount(2),
    ),
    when(condNotVar(capsVars.pressed, 1)),
    options({
      multiTap: { allowPassThrough: true, mods: [] },
    }),
  ),
];

export const singleKeyTapHoldBindings: Binding[] = [
  ...numBindings,
  ...letterBindings,
  ...symbolBindings,
  ...nonCharBindings,
  ...functionKeyBindings,
  ...modifierKeyBindings,
];
