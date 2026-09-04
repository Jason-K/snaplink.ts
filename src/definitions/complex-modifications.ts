import { APPS, CMDS, COMBOS, STATE_GROUPS, URLS, VARS, VM } from "../data";
import { IGNORE_IDS } from "../data/registries/apps";
import {
  actHere,
  app,
  appHistory,
  bind,
  bindTable,
  condApp,
  condNotVar,
  from,
  hold,
  holdLayer,
  key,
  options,
  press,
  release,
  tapAndHold,
  to,
  unlessApp,
  url,
  when,
  type Binding,
} from "../engine";
import { capsVars } from "./caps-lock";

// ─────────────────────────────────────────────────────────────────────────────
// 1. NUMBER & KEYPAD BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const numpadAndNumberBindings: Binding[] = [
  // Bare hold numpad & number actions (tap passes through)
  ...bindTable("hold", {
    "8": APPS.ringCentral,
    keypad_0: url(URLS.winsUnstashAll, true),
    keypad_2: url(URLS.winStashDown, true),
    keypad_4: url(URLS.winStashLeft, true),
    keypad_5: url(URLS.winsUnstash, true),
    keypad_6: url(URLS.winStashRight, true),
    keypad_8: url(URLS.winStashUp, true),
  }),

  // Hyper (⌃⌥⌘⇧) + keypad eighths / maximize window actions
  ...bindTable(
    "release",
    {
      keypad_1: url(URLS.winBottomLeftEighth, true),
      keypad_3: url(URLS.winBottomRightEighth, true),
      keypad_5: url(URLS.winMaximize, true),
      keypad_7: url(URLS.winTopLeftEighth, true),
      keypad_9: url(URLS.winTopRightEighth, true),
    },
    VM.COCS,
  ),

  // Ctrl + Opt + Cmd + keypad 5 toggle fill
  bind(from("keypad_5", VM.COC_), to(release(URLS.hsWinToggleFill))),
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. LETTER BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const letterBindings: Binding[] = [
  // Bare letter hold actions (tap passes through)
  ...bindTable("hold", {
    c: app(APPS.claude, "shell"),
    f: actHere("qspace"),
    h: URLS.rayHere2There,
    j: URLS.rayRecentDownloads,
    k: APPS.kitty,
    m: COMBOS.restoreMinimizedWindow,
    n: CMDS.neruHints,
    o: URLS.csxOcrNoLinebreaks,
    p: COMBOS.showPaletro,
    q: APPS.qspace,
    r: CMDS.recentFiles,
    s: URLS.csxArea,
    t: COMBOS.showKittyQuakeTerm,
    v: COMBOS.showPasteDaemon,
    x: actHere("copy"),
    y: actHere("copy"),
    z: URLS.rayZoxideSearchDirs,
  }),

  // Shift + letter hold actions
  ...bindTable(
    "hold",
    {
      a: URLS.antinoteNewNote,
      m: COMBOS.showMenuItems,
      s: URLS.csxWindow,
    },
    ["shift"],
  ),

  // Hyper (⌃⌥⌘⇧) + letter window focus / selection
  ...bindTable(
    "release",
    {
      e: COMBOS.focusWinRight,
      f: COMBOS.focusWinBottom,
      q: COMBOS.focusWinLeft,
      r: COMBOS.focusWinTop,
      s: press(URLS.hsFormatSelection),
    },
    VM.COCS,
  ),
  bind(from("t", VM.COCS), to(tapAndHold(CMDS.newTypinatorRule, CMDS.lastTypinatorRule))),

  // Left Command + letter bindings
  ...bindTable(
    "press",
    {
      h: COMBOS.skimHighlight,
      u: COMBOS.skimUnderline,
    },
    ["L.cmd"],
    options({ conditions: [condApp(APPS.skim)] }),
  ),
  bind(from("m", ["L.cmd"]), to(hold(COMBOS.restoreMinimizedWindow))),
  bind(from("p", ["L.cmd"]), to(release(CMDS.wordPrint).when(APPS.word), hold(COMBOS.showPopclip))),

  // Right Option + letter bindings
  ...bindTable(
    "hold",
    {
      k: actHere("kitty"),
      s: tapAndHold(CMDS.spotifyToggle, URLS.raySpotifySearch),
    },
    ["R.opt"],
  ),

  // Ctrl + Shift + P in Excel
  bind(from("p", VM.C__S), to(press(COMBOS.excelPalette)), when(APPS.excel)),
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. SYMBOL BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const symbolBindings: Binding[] = [
  // Quick date & select word left on equal sign (keypad and main)
  ...bindTable(
    "release",
    {
      equal_sign: tapAndHold(key("keypad_equal_sign", { halt: true }), [COMBOS.selectWordLeft, CMDS.quickDate]),
      keypad_equal_sign: tapAndHold(key("keypad_equal_sign", { halt: true }), [COMBOS.selectWordLeft, CMDS.quickDate]),
    },
    options({ timing: { aloneMs: 200, holdMs: 200 } }),
  ),

  // Bare symbol hold actions
  ...bindTable("hold", {
    slash: COMBOS.raycastHere2This,
    grave_accent_and_tilde: COMBOS.showPopclip,
  }),

  // Hyper + comma -> System Settings
  bind(from("comma", VM.COCS), to(press(APPS.systemSettings))),

  // Left Command + slash -> Password / Word context actions
  bind(
    from("slash", ["L.cmd"]),
    to(
      press(CMDS.fillPw).when(STATE_GROUPS.isPasswordEdit),
      press(CMDS.fillUnPw).when(STATE_GROUPS.isUserEdit),
      press(CMDS.wordGetPath).when(APPS.word),
    ),
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. NON-CHARACTER, NAVIGATION & CONTROL BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const nonCharBindings: Binding[] = [
  // Enter keys (tap enter, hold format substring or F2 in Excel)
  ...bindTable(
    "release",
    {
      return_or_enter: [
        release(key("return_or_enter", { halt: true })),
        hold(URLS.hsFormatSubstring).when(unlessApp(APPS.excel)),
        hold(key("f2")).when(APPS.excel),
      ],
      keypad_enter: [
        release(key("keypad_enter", { halt: true })),
        hold(URLS.hsFormatSubstring).when(unlessApp(APPS.excel)),
        hold(key("f2")).when(APPS.excel),
      ],
    },
    options({ timing: { aloneMs: 200, holdMs: 200 } }),
  ),

  // Escape variations
  bind(
    from("escape"),
    to(release(key("escape")), hold(CMDS.killForeground), hold(CMDS.killAllApps).withTapCount(2)),
    options({ multiTap: { mods: [] } }),
  ),
  bind(from("escape", ["L.ctrl"]), to(tapAndHold(APPS.activityMonitor, APPS.processSpy))),

  // Home / End line navigation & selection
  ...bindTable("press", {
    home: key("left_arrow", ["L.cmd"]),
    end: key("right_arrow", ["L.cmd"]),
  }),
  ...bindTable(
    "press",
    {
      home: COMBOS.selectHome,
      end: COMBOS.selectEnd,
    },
    ["shift"],
  ),

  // Arrow keys (Hyper window management & Zen browser tab cycling)
  bind(from("left_arrow", VM.COCS), to(tapAndHold(URLS.hsWinLeftTop, url(URLS.rectAppPrevDisplay, true)))),
  bind(from("left_arrow", VM.C__S), to(press(COMBOS.zenNextTab)), when(APPS.zen)),
  bind(from("right_arrow", VM.COCS), to(tapAndHold(URLS.hsWinRightBottom, url(URLS.rectAppNextDisplay, true)))),
  bind(from("right_arrow", VM.C__S), to(press(COMBOS.zenPreviousTab)), when(APPS.zen)),

  // Tab & Spacebar
  bind(from("tab"), to(hold(key("mission_control", { halt: true, repeat: true })))),
  bind(from("tab", VM.COCS), to(release(url(URLS.rectAppNextDisplay, true)))),
  bind(from("spacebar", VM.COCS), to(release(URLS.hsWinToggleFill))),
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. FUNCTION KEY BINDINGS
// ─────────────────────────────────────────────────────────────────────────────

const functionKeyBindings: Binding[] = [
  // Bare media & brightness control keys
  ...bindTable("hold", {
    f1: key("display_brightness_decrement", { repeat: true }),
    f2: key("display_brightness_increment", { repeat: true }),
    f3: key("mission_control"),
    f4: key("launchpad"),
    f7: key("rewind", { repeat: true }),
    f8: key("play_or_pause"),
    f9: key("fastforward", { repeat: true }),
    f10: key("mute"),
    f11: key("volume_decrement", { repeat: true }),
    f12: key("volume_increment", { repeat: true }),
  }),

  // Hyper + F12
  bind(from("f12", VM.COCS), to(press(CMDS.lastTypinatorRule))),
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. MODIFIER KEYS & HOLD LAYERS
// ─────────────────────────────────────────────────────────────────────────────

const modifierKeyBindings: Binding[] = [
  // Right Command quick-launch hold layer (Sxitch on tap alone, quick launch on chords)
  ...holdLayer({
    trigger: "R.cmd",
    variable: VARS.rCmdDown,
    tapAlone: key("R.cmd", { repeat: false }),
    bindings: {
      a: APPS.antinote,
      b: APPS.brave,
      c: APPS.claude,
      o: APPS.outlook,
      p: APPS.protonMail,
      t: APPS.teams,
      v: APPS.code,
    },
  }),

  // Multi-tap modifiers (Left Command -> App history, Shift keys -> Clipboard history)
  bind(
    from("L.cmd"),
    to(release(key("L.cmd")), hold(key("L.cmd")), release(appHistory(1, IGNORE_IDS)).withTapCount(2)),
    when(condNotVar(capsVars.pressed, 1)),
    options({ multiTap: { allowPassThrough: true, mods: [] } }),
  ),
  ...(["L.shift", "R.shift"] as const).map(shiftKey =>
    bind(
      from(shiftKey),
      to(release(key(shiftKey)), hold(key(shiftKey)), release(URLS.rayClipboard).withTapCount(2)),
      when(condNotVar(capsVars.pressed, 1)),
      options({ multiTap: { allowPassThrough: true, mods: [] } }),
    ),
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/** All single-key and modified single-key tap-hold bindings. */
export const singleKeyTapHoldBindings: Binding[] = [
  ...numpadAndNumberBindings,
  ...letterBindings,
  ...symbolBindings,
  ...nonCharBindings,
  ...functionKeyBindings,
  ...modifierKeyBindings,
];
