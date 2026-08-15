import { APPS, CMDS, COMBOS, URLS, VM } from "../data";
import { capsVars } from "./caps-lock";
import {
  actHere,
  app,
  bind,
  bindTable,
  from,
  hold,
  key,
  url,
  options,
  press,
  release,
  shell,
  tapAndHold,
  to,
  when,
  type Binding,
  unlessApp,
  condNotVar,
} from "../engine";

//   SINGLE KEY TAP/HOLD RULES — one binding per key; hold fires the action,
//   tap passes the key through (the engine's default-alone behavior).

const numBindings: Binding[] = bindTable("hold", {
  "8": APPS.ringCentral,
  keypad_0: url(URLS.winsUnstashAll, true),
  keypad_2: url(URLS.winStashDown, true),
  keypad_4: url(URLS.winStashLeft, true),
  keypad_5: url(URLS.winsUnstash, true),
  keypad_6: url(URLS.winStashRight, true),
  keypad_8: url(URLS.winStashUp, true),
});

const letterBindings: Binding[] = [
  ...bindTable("hold", {
    a: key("f18", VM.COCS),
    c: app(APPS.claude, "shell"),
    d: key("f1", VM.CO_S),
    f: actHere("qspace"),
    g: COMBOS.showGlyphlow,
    h: URLS.rayHere2There,
    j: URLS.rayRecentDownloads,
    k: APPS.kitty,
    n: shell(CMDS.neruHints),
    o: URLS.csxOcrNoLinebreaks,
    p: COMBOS.showPopclip,
    q: APPS.qspace,
    r: shell(CMDS.recentFiles),
    s: URLS.csxArea,
    t: COMBOS.showKittyQuakeTerm,
    v: URLS.rayClipboard,
    x: actHere("copy"),
    y: actHere("copy"),
    z: URLS.rayZoxideSearchDirs,
  }),
  // Distinct from bare "s" above by its shift modifier; kept out of the
  // table since a table key can only hold one value.
  bind(from("s", ["shift"]), to(hold(url(URLS.csxWindow)))),
];

const symbolBindings: Binding[] = [
  bind(
    from("keypad_equal_sign"),
    to(tapAndHold(key("keypad_equal_sign", { halt: true }), [COMBOS.selectWordLeft, shell(CMDS.quickDate)])),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(
    from("equal_sign"),
    to(tapAndHold(key("keypad_equal_sign", { halt: true }), [COMBOS.selectWordLeft, shell(CMDS.quickDate)])),
    options({
      timing: { aloneMs: 200, holdMs: 200 },
    }),
  ),
  bind(from("slash"), to(hold(COMBOS.raycastHere2This))),
  bind(from("grave_accent_and_tilde"), to(hold(COMBOS.showPopclip))),
];

const nonCharBindings: Binding[] = [
  bind(
    from("keypad_enter"),
    to(
      release(key("keypad_enter", { halt: true })),
      hold(shell(CMDS.evalSelectionPart)).when(unlessApp(APPS.excel)),
      hold(key("f2")).when(APPS.excel),
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
      hold(key("f2")).when(APPS.excel),
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

const functionKeyBindings: Binding[] = bindTable("hold", {
  f1: key("display_brightness_decrement", { repeat: true }),
  f2: key("display_brightness_increment", { repeat: true }),
  f3: key("mission_control"),
  f4: key("launchpad"),
  f5: key("f5", VM.COC_),
  f7: key("rewind", { repeat: true }),
  f8: key("play_or_pause"),
  f9: key("fastforward", { repeat: true }),
  f10: key("mute"),
  f11: key("volume_decrement", { repeat: true }),
  f12: key("volume_increment", { repeat: true }),
});

const modifierKeyBindings: Binding[] = [
  bind(
    from("left_shift"),
    to(
      release(key("left_shift")),
      hold(key("left_shift")),
      release(URLS.rayClipboard).withTapCount(2),
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
      release(URLS.rayClipboard).withTapCount(2),
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
