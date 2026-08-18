import { PATHS } from "./paths";
import type { CommandSpec } from "../primitives/commands";
import { TIMINGS } from "../constants/timings";
import { URLS } from "./urls";

// ---------------------------------------------------------
// BUILDERS
// ---------------------------------------------------------

// PRIVILEGES
const rmPriv = `'${PATHS.binPrivCLI.path}' -r && sleep ${TIMINGS.privDelaySec}`;
const addPriv = `'${PATHS.binPrivCLI.path}' -a && sleep ${TIMINGS.privDelaySec}`;
const getPriv = `${rmPriv} && ${addPriv}`;
// UTILITIES
const sendKeys = `'${PATHS.binSendKeys.path}' --initial-delay 0 --delay 0.005`;
// 1PASSWORD
const fillPw = `${sendKeys} --characters '<c:/:command,option,control,shift> <c:/:command,option,control,shift>'`;
const fillUnAndPw = `${sendKeys} --characters '<c:a:command>Jason<c:tab><c:/:command,option,control,shift>'`;
// SCRIPTS
const getDocxPath = `osascript '${PATHS.getDocPath.path}'`;
// INTERPRETERS
const runHs = `'${PATHS.binHS.path}' -c`;
const getDisplayInfo = `${runHs} 'local win = hs.window.focusedWindow(); local screen = (win and win:screen()) or hs.screen.mainScreen(); local screenFrame = screen:frame()`;
// RAYCAST
const raycastExt = `open -u raycast-x://extensions`;
// TEXT PROCESSOR
const stringThings = `'${PATHS.binUV.path}' --directory '${PATHS.stringThingsDir.path}' run python '${PATHS.stringThings.path}'`;

// ---------------------------------------------------------
// Factory
// ---------------------------------------------------------

/** Create a registry entry for a shell command.
 *  @param commandStr - the shell command string to execute
 *  @param refDesc    - human label used in descriptions
 */
const cmdEntry = (commandStr: string, refDesc: string): CommandSpec => ({
  type: "command",
  command: commandStr,
  refDesc,
});

// Scoped factory helpers for concise single-line command definitions
const hsEval = (fn: string, desc: string): CommandSpec => cmdEntry(`${runHs} '${fn}'`, desc);

const textClip = (action: string, desc: string): CommandSpec =>
  cmdEntry(`${stringThings} ${action} --source clipboard --dest paste`, desc);

const recentDls = (flag: string, desc: string): CommandSpec => cmdEntry(`${PATHS.recentDls.path} ${flag}`, desc);

const mimi = (action: string, target: string, desc: string): CommandSpec =>
  cmdEntry(`mimi action ${action} ${target}`, desc);

const neru = (action: string, desc: string): CommandSpec => cmdEntry(`${PATHS.binNeru.path} ${action}`, desc);

// ---------------------------------------------------------
// Registries
// ---------------------------------------------------------

const Passwords_Privileges = {
  getPrivileges: cmdEntry(`${getPriv}`, "get privileges"),
  fillPw: cmdEntry(`${getPriv} && ${fillPw}`, "fill password"),
  fillUnPw: cmdEntry(`${getPriv} && ${fillUnAndPw}`, "fill username and password"),
};

const Kill_Apps = {
  killForeground: cmdEntry(`${PATHS.binAppKill.path} --foreground`, "kill front app"),
  killAll: cmdEntry(`${PATHS.binAppKill.path}`, "kill all applications"),
  killAllApps: cmdEntry(`${PATHS.binAppKill.path}`, "kill all applications"),
};

const Hs_Functions = {
  evalSelection: hsEval("FormatSelection()", "Format selection using hsStringEval"),
  evalSelectionPart: hsEval("FormatCutSeed()", "Format substrings within selection"),
};

const Typinator_Scripts = {
  newTypinatorRule: cmdEntry(
    `'${PATHS.binTypinatorVenv.path}' '${PATHS.newTypinatorRule.path}'`,
    "create new Typinator rule",
  ),
  lastTypinatorRule: cmdEntry(`osascript '${PATHS.lastTypinatorRule.path}'`, "edit last Typinator expansion"),
};

const Spotify = {
  spotifyToggle: cmdEntry(
    `if pgrep -x 'Spotify' > /dev/null; then open '${URLS.raySpotifyPlayPause.url}'; else '${PATHS.binAppOpen.path}' -b 'com.spotify.client'; fi; echo 'Spotify toggled'`,
    "open Spotify or toggle play/pause",
  ),
};

const Text_Processor = {
  quickDate: cmdEntry(
    `${stringThings} quick_date --source cut --dest paste`,
    "insert today's date in yyyy-mm-dd format at the cursor",
  ),
  toUpper: textClip("uppercase", "convert clipboard to uppercase"),
  toLower: textClip("lower_case", "convert clipboard to lowercase"),
  toTitle: textClip("title_case", "convert clipboard to title case"),
  wrapQuotes: textClip("wrap_quotes", "wrap clipboard in quotes"),
  wrapSingleQuotes: textClip("wrap_single_quotes", "wrap clipboard in single quotes"),
  wrapParens: textClip("wrap_parentheses", "wrap clipboard in parentheses"),
  wrapBrackets: textClip("wrap_brackets", "wrap clipboard in brackets"),
  wrapBraces: textClip("wrap_braces", "wrap clipboard in braces"),
  wrapAngleBrackets: textClip("wrap_angle_brackets", "wrap clipboard in angle brackets"),
};

const Windows = {
  winROrBottom: cmdEntry(
    `${getDisplayInfo}; local url = (screenFrame.w >= screenFrame.h) and [[rectangle-pro://execute-action?name=right-half]] or [[rectangle-pro://execute-action?name=bottom-half]]; hs.urlevent.openURL(url)'`,
    "move window to right or bottom half",
  ),
  winLOrTop: cmdEntry(
    `${getDisplayInfo}; local url = (screenFrame.w >= screenFrame.h) and [[rectangle-pro://execute-action?name=left-half]] or [[rectangle-pro://execute-action?name=top-half]]; hs.urlevent.openURL(url)'`,
    "move window to left or top half",
  ),
  winMaxToggle: cmdEntry(
    `${getDisplayInfo}; local winFrame = win and win:frame() or screenFrame; local positionTolerance = 24; local widthCoverage = screenFrame.w > 0 and (winFrame.w / screenFrame.w) or 0; local heightCoverage = screenFrame.h > 0 and (winFrame.h / screenFrame.h) or 0; local leftAligned = math.abs(winFrame.x - screenFrame.x) <= positionTolerance; local topAligned = math.abs(winFrame.y - screenFrame.y) <= positionTolerance; local isMaximized = leftAligned and topAligned and widthCoverage >= 0.97 and heightCoverage >= 0.9; local url = isMaximized and [[rectangle-pro://execute-action?name=restore]] or [[rectangle-pro://execute-action?name=maximize]]; hs.urlevent.openURL(url)'`,
    "maximize or restore window",
  ),
};

const Get_Recents = {
  recentFiles: cmdEntry(`${raycastExt}/jason/recents/recentCustom`, "get recent items from Raycast"),
  recentAdditions: recentDls("-a", "get recent items from script"),
  recentMods: recentDls("-m", "get recent mods from script"),
  recentCreations: recentDls("-c", "get new files from script"),
};

const App_Specific = {
  wordPrint: cmdEntry(`${getDocxPath} && ${sendKeys} -c "<c:p:command>"`, "get file path and print in word"),
  wordGetPath: cmdEntry(`${getDocxPath}`, "get file path in word"),
  showSidenotes: cmdEntry(`osascript -e 'tell application "SideNotes" to show all folders'`, "show Sidenotes"),
  showPopclip: cmdEntry(`osascript -e 'tell application "Popclip" to appear'`, "show Popclip at cursor position"),
};

const Neru_Commands = {
  neruGrid: neru("grid", "activate Neru's grid mode"),
  neruHints: neru("hints", "activate Neru's hints mode"),
  neruRecursiveGrid: neru("recursive_grid", "activate Neru's recursive grid mode"),
  neruScroll: neru("scroll", "activate Neru's scroll mode"),
  neruDisplay: neru("monitor_select", "activate Neru's monitor selection mode"),
  neruLeftClick: neru("-a left_click", "left click"),
  neruDoubleClick: neru("-a left_click,left_click", "double click"),
  neruRightClick: neru("-a right_click", "right click"),
  neruMiddleClick: neru("-a middle_click", "middle click"),
  neruStartDrag: neru("-a left_mouse_down", "start drag"),
  neruStopDrag: neru("-a left_mouse_up", "stop drag"),
  neruSelectText: neru("-a left_mouse_toggle --modifier shift", "toggle text selection"),
};
const Mimi_Commands = {
  mimiSpaceRight: mimi("move_window_to_space", "next", "move window to next space"),
  mimiSpaceLeft: mimi("move_window_to_space", "prev", "move window to previous space"),
  mimiLeftHalf: mimi("resize_window", "left-half", "resize window to left half"),
  mimiRightHalf: mimi("resize_window", "right-half", "resize window to right half"),
  mimiTopHalf: mimi("resize_window", "top-half", "resize window to top half"),
  mimiBottomHalf: mimi("resize_window", "bottom-half", "resize window to bottom half"),
  mimiFill: mimi("resize_window", "fill", "resize window to fill screen"),
};

const Misc_Scripts = {
  ocrToMd: cmdEntry(
    `'${PATHS.binSharedVenv.path}' '${PATHS.scriptsDir.path}/ui/screenshot_to_md/shot_to_md.py'`,
    "take screenshot and convert to markdown",
  ),
};

// ---------------------------------------------------------
// Registry
// ---------------------------------------------------------

export const CMDS = {
  ...Passwords_Privileges,
  ...Kill_Apps,
  ...Hs_Functions,
  ...Typinator_Scripts,
  ...Spotify,
  ...Text_Processor,
  ...Windows,
  ...Get_Recents,
  ...App_Specific,
  ...Neru_Commands,
  ...Mimi_Commands,
  ...Misc_Scripts,
} as const;

export type { CommandSpec };
