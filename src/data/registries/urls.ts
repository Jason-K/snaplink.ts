import type { UrlSpec } from "../primitives/urls";

// ---------------------------------------------------------
// Factory
// ---------------------------------------------------------

/** Create a registry entry for a URL action.
 *  @param urlStr   - the URL string to open (e.g. "raycast-x://extensions/...")
 *  @param refDesc  - human label used in descriptions
 *  @param category - optional integration category
 */
const url = (urlStr: string, refDesc: string, category?: string): UrlSpec => ({
  type: "url",
  url: urlStr,
  refDesc,
  ...(category ? { category } : {}),
});

// Scoped factory helpers for concise single-line registry definitions
const sidenotes = (action: string, refDesc: string): UrlSpec => url(`sidenotes://${action}`, refDesc, "sidenotes");

const ray = (path: string, refDesc: string): UrlSpec => url(`raycast-x://extensions/${path}`, refDesc, "raycast");

const rect = (action: string, refDesc: string): UrlSpec =>
  url(`rectangle-pro://execute-action?name=${action}`, refDesc, "rectangle");

const csx = (action: string, refDesc: string): UrlSpec => url(`cleanshot://${action}`, refDesc, "cleanshot");

const antinote = (action: string, refDesc: string): UrlSpec => url(`antinote://${action}`, refDesc, "antinote");

const hs = (action: string, refDesc: string): UrlSpec => url(`hammerspoon://${action}`, refDesc, "hammerspoon");

// ---------------------------------------------------------
// Registry
// ---------------------------------------------------------

const SidenotesUrls = {
  newClientNote: sidenotes(
    "add-note-with-text/DATE%3A%20%0ACLIENT%3A%20%0ATOPIC%3A%20%0A%0A",
    "new client note template",
  ),
};

const RaycastUrls = {
  rayClipboard: ray("raycast/clipboard-history/clipboard-history", "open Raycast clipboard manager"),
  rayHere2There: ray("Jason/here-to-there/activeToTarget", "call Raycast Here2There"),
  rayRecentApps: ray("jason/recents/recentApplications", "show recent applications"),
  rayRecentCustom: ray("jason/recents/recentCustom", "show recent files"),
  rayRecentDownloads: ray("jason/recents/recentDownloads", "show recent downloads"),
  rayRecentFiles: ray("jason/recents/recents", "show recent files"),
  rayRecentFolders: ray("jason/recents/recentFolders", "show recent folders"),
  raySpotifyPlayPause: ray("mattisssa/spotify-player/togglePlayPause", "toggle Spotify"),
  raySpotifySearch: ray("mattisssa/spotify-player/search", "search Spotify"),
  rayZoxideSearchDirs: ray("mrpunkin/raycast-zoxide/search-directories", "search directories using zoxide"),
};

const HsUrls = {
  hsWinToggleFill: hs("window?action=toggle_maximize", "toggle maximize and restore window"),
  hsWinLeftTop: hs("window?action=primary_half", "window to top-left 1/2"),
  hsWinRightBottom: hs("window?action=secondary_half", "window to bottom-right 1/2"),
  hsFormatSelection: hs("hslauncher?id=format_selection", "format selected text"),
  hsFormatSubstring: hs("hslauncher?id=format_cut_seed", "format substring of selected text"),
};

const rectangleUrls = {
  rectAppLeftHalf: rect("app-left-half", "App to ◧"),
  rectAppNextDisplay: rect("app-next-display", "App to display →"),
  rectAppPrevDisplay: rect("app-prev-display", "App to display ←"),
  rectAppRightHalf: rect("app-right-half", "App to ◨"),
  rectCascadeAll: rect("cascade-all", "Cascade all windows"),
  rectCascadeApp: rect("cascade-app", "Cascade app windows"),
  rectCenterHalf: rect("center-half", "Window center 1/2"),
  rectCycleStashed: rect("cycle-stashed", "Cycle stashed windows"),
  rectDisplayNext: rect("next-display", "Display →"),
  rectDisplayPrev: rect("previous-display", "Display ←"),
  winFullscreen: rect("fullscreen", "Fullscreen"),
  rectHideApp: rect("hide-app", "Hide app"),
  rectSpaceNext: rect("next-space", "Space →"),
  rectSpacePrev: rect("prev-space", "Last space"),
  winBottomHalf: rect("bottom-half", "Window to ⬓"),
  winBottomLeft: rect("bottom-left", "Window ◱"),
  winBottomLeftSixth: rect("bottom-left-sixth", "Window ↓← 1/6"),
  winBottomLeftThird: rect("bottom-left-third", "Window ↓← 1/3"),
  winBottomRight: rect("bottom-right", "Window ◲"),
  winBottomRightSixth: rect("bottom-right-sixth", "Window ↓→ 1/6"),
  winBottomRightThird: rect("bottom-right-third", "Window ↓→ 1/3"),
  winCenter: rect("center", "Center window"),
  winCenterThird: rect("center-third", "Window center 1/3"),
  winCenterTwoThirds: rect("center-two-thirds", "Window center 2/3"),
  winClose: rect("close", "Close window"),
  winFillBottomLeft: rect("fill-bottom-left", "Window fill ◲"),
  winFillBottomRight: rect("fill-bottom-right", "Window fill ◲"),
  winFillLeft: rect("fill-left", "Window fill ←"),
  winFillRight: rect("fill-right", "Window fill →"),
  winFillTopLeft: rect("fill-top-left", "Window fill ◰"),
  winFillTopRight: rect("fill-top-right", "Window fill ◱"),
  winFirstFourth: rect("first-fourth", "Window to ◰"),
  winFirstSixth: rect("first-sixth", "Window first 1/6"),
  winFirstThird: rect("first-third", "Window first 1/3"),
  winFirstThreeFourths: rect("first-three-fourths", "Window first 3/4"),
  winFirstTwoThirds: rect("first-two-thirds", "Window first 2/3"),
  winLarger: rect("larger", "Make window larger"),
  winLast: rect("last", "Go to last window"),
  winLastFourth: rect("last-fourth", "Window ◲"),
  winLastSixth: rect("last-sixth", "Window last 1/6"),
  winLastThird: rect("last-third", "Window last 1/3"),
  winLastThreeFourths: rect("last-three-fourths", "Window last 3/4"),
  winLastTwoThirds: rect("last-two-thirds", "Window last 2/3"),
  winLeftHalf: rect("left-half", "Window ◨"),
  winMaximize: rect("maximize", "Window ✥"),
  winMaximizeHeight: rect("maximize-height", "Max window height"),
  winMinimize: rect("minimize", "Window ⇣"),
  winMoveDown: rect("move-down", "Move window ↓"),
  winMoveLeft: rect("move-left", "Move window ←"),
  winMoveRight: rect("move-right", "Move window →"),
  winMoveUp: rect("move-up", "Move window ↑"),
  winNudgeDown: rect("nudge-down", "Nudge window ↓"),
  winNudgeLeft: rect("nudge-left", "Nudge window ←"),
  winNudgeRight: rect("nudge-right", "Nudge window →"),
  winNudgeUp: rect("nudge-up", "Nudge window ↑"),
  winPin: rect("pin", "Pin window"),
  winRestore: rect("restore", "Restore window"),
  winRightHalf: rect("right-half", "Window ◧"),
  winSecondFourth: rect("second-fourth", "Window ◳"),
  winSmaller: rect("smaller", "Make window smaller"),
  winSnapBottomLeft: rect("snap-bottom-left", "Snap window ◱"),
  winSnapBottomRight: rect("snap-bottom-right", "Snap window to ◲"),
  winSnapTopLeft: rect("snap-top-left", "Snap window to ◰"),
  winSnapTopRight: rect("snap-top-right", "Snap window to ◳"),
  winsReflowPin: rect("reflow-pin", "Reflow pin"),
  winsStashAllButFront: rect("stash-all-but-front", "Stash all but front"),
  winStashAll: rect("stash-all", "Stash all"),
  winStashDown: rect("stash-down", "Stash ↓"),
  winStashLeft: rect("stash-left", "Stash ←"),
  winStashRight: rect("stash-right", "Stash →"),
  winStashUp: rect("stash-up", "Stash ↑"),
  winsTile2x2: rect("tile2x2", "Tile ⊞"),
  winsTile2x3: rect("tile2x3", "Tile 2x3"),
  winsToggleStashed: rect("toggle-stashed", "Toggle stashed"),
  winsUnstash: rect("unstash", "Unstash"),
  winsUnstashAll: rect("unstash-all", "Unstash all"),
  winThirdFourth: rect("third-fourth", "Window to ◳"),
  winTopCenterSixth: rect("top-center-sixth", "Window to top center 1/6"),
  winTopHalf: rect("top-half", "Window ⬒"),
  winTopLeft: rect("top-left", "Window to ◰"),
  winTopLeftSixth: rect("top-left-sixth", "Window to ↑← 1/6"),
  winTopLeftThird: rect("top-left-third", "Window to ↑← 1/3"),
  winTopRight: rect("top-right", "Window to ◳"),
  winTopRightSixth: rect("top-right-sixth", "Window to ↑→ 1/6"),
  winTopRightThird: rect("top-right-third", "Window to ↑→ 1/3"),
  winUpperCenter: rect("upper-center", "Window to upper center"),
  winBottomRightEighth: rect("bottom-right-eighth", "Window to bottom right 1/8"),
  winBottomLeftEighth: rect("bottom-left-eighth", "Window to bottom left 1/8"),
  winTopRightEighth: rect("top-right-eighth", "Window to top right 1/8"),
  winTopLeftEighth: rect("top-left-eighth", "Window to top left 1/8"),
};

const CsxUrls = {
  csxArea: csx("capture-area", "Capture area"),
  csxScreen: csx("capture-fullscreen", "Capture fullscreen"),
  csxOcr: csx("capture-text", "OCR text"),
  csxOcrNoLinebreaks: csx("capture-text?linebreaks=false", "OCR text (no line breaks)"),
  csxWindow: csx("capture-window", "Capture window"),
  csxRecord: csx("record-screen", "Record screen"),
};

const AntiNoteUrls = {
  antinote: antinote("", "Open AntiNote"),
  antinoteNewNote: antinote("new-note", "Create new note"),
};

// EXPORTS

export const URLS = {
  ...SidenotesUrls,
  ...RaycastUrls,
  ...HsUrls,
  ...rectangleUrls,
  ...CsxUrls,
  ...AntiNoteUrls,
};

export type { UrlSpec };
