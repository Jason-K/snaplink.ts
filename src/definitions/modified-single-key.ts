import { VM } from "../data";
import {
  APPS,
  CMDS,
  COMBOS,
  STATE_GROUPS,
  URLS,
} from "../data";
import {
  actHere,
  bind,
  cmd,
  condApp,
  map,
  from,
  hold,
  app,
  url,
  press,
  release,
  shell,
  to,
  when,
  type Binding,
  state,
} from "../engine";

const modNumBindings: Binding[] = [
  bind(from("keypad_1", VM.COCS), to(release(url(URLS.winBottomLeftEighth, true)))),
  bind(from("keypad_3", VM.COCS), to(release(url(URLS.winBottomRightEighth, true)))),
  bind(from("keypad_5", VM.COCS), to(release(url(URLS.winMaximize, true)))),
  bind(from("keypad_5", VM.COC_), to(release(cmd(CMDS.mimiWinFill)))),
  bind(from("keypad_7", VM.COCS), to(release(url(URLS.winTopLeftEighth, true)))),
  bind(from("keypad_9", VM.COCS), to(release(url(URLS.winTopRightEighth, true)))),
];

const modLetterBindings: Binding[] = [
  bind(from("a", ["shift"]), to(hold(url(URLS.antinoteNewNote)))),
  bind(from("e", VM.COCS), to(release(map(COMBOS.focusWinRight)))),
  bind(from("f", VM.COCS), to(release(map(COMBOS.focusWinBottom)))),
  bind(
    from("h", ["L.cmd"]),
    to(press(map(COMBOS.skimHighlight))),
    when(condApp(APPS.skim)),
  ),
  bind(from("k", ["R.opt"]), to(hold(actHere("kitty")))),
  bind(from("m", ["L.cmd"]), to(hold(map(COMBOS.restoreMinimizedWindow)))),
  bind(
    from("p", ["L.cmd"]),
    to(
      release(cmd(CMDS.wordPrint)).when(state(APPS.word)),
      hold(map(COMBOS.showPopclip)),
    ),
  ),
  bind(from("q", VM.COCS), to(release(map(COMBOS.focusWinLeft)))),
  bind(from("r", VM.COCS), to(release(map(COMBOS.focusWinTop)))),
  bind(from("s", VM.COCS), to(press(shell(CMDS.evalSelection)))),
  bind(
    from("s", ["R.opt"]),
    to(
      release(shell(CMDS.spotifyToggle)),
      hold(url(URLS.raySpotifySearch)),
    ),
  ),
  bind(
    from("t", VM.COCS),
    to(
      release(shell(CMDS.newTypinatorRule)),
      hold(shell(CMDS.lastTypinatorRule)),
    ),
  ),
  bind(
    from("u", ["L.cmd"]),
    to(press(map(COMBOS.skimUnderline))),
    when(state(APPS.skim)),
  ),
];

const modSymbolBindings: Binding[] = [
  bind(from("comma", VM.COCS), to(press(app(APPS.systemSettings)))),
  bind(
    from("slash", ["L.cmd"]),
    to(
      // AUTHENTICATION DIALOG fill password.
      press(cmd(CMDS.fillPw)).when(state(STATE_GROUPS.isPasswordEdit)),
      // AUTHENTICATION DIALOG: fill username and password.
      press(cmd(CMDS.fillUnPw)).when(state(STATE_GROUPS.isUserEdit)),
      press(cmd(CMDS.wordGetPath)).when(state(APPS.word))
    ),
  ),
];

const modNonCharBindings: Binding[] = [
  bind(from("end", ["shift"]), to(press(map(COMBOS.selectEnd)))),
  bind(
    from("escape", ["control"]),
    to(
      release(app(APPS.activityMonitor)),
      hold(app(APPS.processSpy)),
    ),
  ),
  bind(from("escape", VM.COCS), to(press(app(APPS.activityMonitor)))),
  bind(from("home", ["shift"]), to(press(map(COMBOS.selectHome)))),
  bind(
    from("left_arrow", VM.COCS),
    to(
      release(shell(CMDS.winLOrTop)),
      hold(url(URLS.rectAppPrevDisplay, true)),
    ),
  ),
  bind(
    from("left_arrow", VM.C__S),
    to(press(map(COMBOS.zenNextTab))),
    when(condApp(APPS.zen)),
  ),
  bind(
    from("right_arrow", VM.COCS),
    to(
      release(shell(CMDS.winROrBottom)),
      hold(url(URLS.rectAppNextDisplay, true)),
    ),
  ),
  bind(
    from("right_arrow", VM.C__S),
    to(press(map(COMBOS.zenPreviousTab))),
    when(condApp(APPS.zen)),
  ),
  bind(from("spacebar", VM.COCS), to(release(shell(CMDS.winMaxToggle)))),
  bind(from("tab", VM.COCS), to(release(url(URLS.rectAppNextDisplay, true)))),
];

const modFunctionKeyBindings: Binding[] = [
  bind(from("f12", VM.COCS), to(press(shell(CMDS.lastTypinatorRule)))),
];

export const modifiedSingleKeyTapHoldBindings: Binding[] = [
  ...modNumBindings,
  ...modLetterBindings,
  ...modSymbolBindings,
  ...modNonCharBindings,
  ...modFunctionKeyBindings,
];
