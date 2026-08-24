import { VM } from "../data";
import { APPS, CMDS, COMBOS, STATE_GROUPS, URLS } from "../data";
import {
  actHere,
  bind,
  bindTable,
  from,
  hold,
  press,
  release,
  tapAndHold,
  to,
  url,
  when,
  type Binding,
} from "../engine";

const modNumBindings: Binding[] = [
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
  bind(from("keypad_5", VM.COC_), to(release(URLS.hsWinToggleFill))),
];

const modLetterBindings: Binding[] = [
  bind(from("a", ["shift"]), to(hold(URLS.antinoteNewNote))),
  // The four focusWin* keys share modifier and phase, so they're a table.
  // "s" (evalSelection) shares the same VM.COCS modifier but a different
  // phase (press, not release) — folded in via a pre-built Case, bindTable's
  // escape hatch for the one entry that doesn't fit the table's shape.
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
  ...bindTable(
    "press",
    {
      a: APPS.antinote,
      o: APPS.outlook,
    },
    ["R.cmd"],
  ),
  bind(from("h", ["L.cmd"]), to(press(COMBOS.skimHighlight)), when(APPS.skim)),
  bind(from("k", ["R.opt"]), to(hold(actHere("kitty")))),
  bind(from("m", ["L.cmd"]), to(hold(COMBOS.restoreMinimizedWindow))),
  // Condition applies only to the tap (print) side, not the hold (popclip)
  // side, so this stays as two explicit cases rather than tapAndHold() —
  // tapAndHold() would apply state(APPS.word) to both.
  bind(from("p", ["L.cmd"]), to(release(CMDS.wordPrint).when(APPS.word), hold(COMBOS.showPopclip))),
  bind(from("p", VM.C__S), to(press(COMBOS.excelPalette)), when(APPS.excel)),
  bind(from("s", ["R.opt"]), to(tapAndHold(CMDS.spotifyToggle, URLS.raySpotifySearch))),
  bind(from("t", VM.COCS), to(tapAndHold(CMDS.newTypinatorRule, CMDS.lastTypinatorRule))),
  bind(from("u", ["L.cmd"]), to(press(COMBOS.skimUnderline)), when(APPS.skim)),
];

const modSymbolBindings: Binding[] = [
  bind(from("comma", VM.COCS), to(press(APPS.systemSettings))),
  bind(
    from("slash", ["L.cmd"]),
    to(
      // AUTHENTICATION DIALOG fill password.
      press(CMDS.fillPw).when(STATE_GROUPS.isPasswordEdit),
      // AUTHENTICATION DIALOG: fill username and password.
      press(CMDS.fillUnPw).when(STATE_GROUPS.isUserEdit),
      press(CMDS.wordGetPath).when(APPS.word),
    ),
  ),
];

const modNonCharBindings: Binding[] = [
  bind(from("end", ["shift"]), to(press(COMBOS.selectEnd))),
  bind(from("escape", ["control"]), to(tapAndHold(APPS.activityMonitor, APPS.processSpy))),
  bind(from("escape", VM.COCS), to(press(APPS.activityMonitor))),
  bind(from("home", ["shift"]), to(press(COMBOS.selectHome))),
  bind(from("left_arrow", VM.COCS), to(tapAndHold(URLS.hsWinLeftTop, url(URLS.rectAppPrevDisplay, true)))),
  bind(from("left_arrow", VM.C__S), to(press(COMBOS.zenNextTab)), when(APPS.zen)),
  bind(from("right_arrow", VM.COCS), to(tapAndHold(URLS.hsWinRightBottom, url(URLS.rectAppNextDisplay, true)))),
  bind(from("right_arrow", VM.C__S), to(press(COMBOS.zenPreviousTab)), when(APPS.zen)),
  bind(from("spacebar", VM.COCS), to(release(URLS.hsWinToggleFill))),
  bind(from("tab", VM.COCS), to(release(url(URLS.rectAppNextDisplay, true)))),
];

const modFunctionKeyBindings: Binding[] = [bind(from("f12", VM.COCS), to(press(CMDS.lastTypinatorRule)))];

export const modifiedSingleKeyTapHoldBindings: Binding[] = [
  ...modNumBindings,
  ...modLetterBindings,
  ...modSymbolBindings,
  ...modNonCharBindings,
  ...modFunctionKeyBindings,
];
