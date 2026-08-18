import type { UrlSpec } from "../primitives/urls";

// ---------------------------------------------------------
// Factory
// ---------------------------------------------------------

/** Create a registry entry for a URL action.
 *  @param urlStr    - the URL string to open (e.g. "raycast-x://extensions/...")
 *  @param refDesc   - human label used in descriptions
 *  @param category  - optional integration category
 *  @param background - `open -g` (true) vs `open -u` (false) when this entry
 *                       is used bare; left unset (undefined) falls through to
 *                       `url()`'s own default. See `UrlSpec.background`.
 */
const url = (urlStr: string, refDesc: string, category?: string, background?: boolean): UrlSpec => ({
  type: "url",
  url: urlStr,
  refDesc,
  ...(category ? { category } : {}),
  ...(background !== undefined ? { background } : {}),
});

// Scoped factory helpers for concise single-line registry definitions.
// All non-Hammerspoon categories pin `background = false` to preserve
// today's foreground (`open -u`) behavior; `hs()` deliberately leaves
// `background` unset so Hammerspoon entries fall through to url()'s
// background-by-default fallback.
const sidenotes = (action: string, refDesc: string, background = false): UrlSpec =>
  url(`sidenotes://${action}`, refDesc, "sidenotes", background);

const ray = (path: string, refDesc: string, background = false): UrlSpec =>
  url(`raycast-x://extensions/${path}`, refDesc, "raycast", background);

const rect = (action: string, refDesc: string, background = false): UrlSpec =>
  url(`rectangle-pro://execute-action?name=${action}`, refDesc, "rectangle", background);

const csx = (action: string, refDesc: string, background = false): UrlSpec =>
  url(`cleanshot://${action}`, refDesc, "cleanshot", background);

const antinote = (action: string, refDesc: string, background = false): UrlSpec =>
  url(`antinote://${action}`, refDesc, "antinote", background);

const hs = (action: string, refDesc: string, background?: boolean): UrlSpec =>
  url(`hammerspoon://${action}`, refDesc, "hammerspoon", background);

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
  rectAppLeftHalf: rect("app-left-half", "app to ◧"),
  rectAppNextDisplay: rect("app-next-display", "app to display →"),
  rectAppPrevDisplay: rect("app-prev-display", "app to display ←"),
  rectAppRightHalf: rect("app-right-half", "app to ◨"),
  rectCascadeAll: rect("cascade-all", "cascade all windows"),
  rectCascadeApp: rect("cascade-app", "cascade app windows"),
  rectCenterHalf: rect("center-half", "window center 1/2"),
  rectCycleStashed: rect("cycle-stashed", "cycle stashed windows"),
  rectDisplayNext: rect("next-display", "display →"),
  rectDisplayPrev: rect("previous-display", "display ←"),
  winFullscreen: rect("fullscreen", "fullscreen"),
  rectHideApp: rect("hide-app", "hide app"),
  rectSpaceNext: rect("next-space", "space →"),
  rectSpacePrev: rect("prev-space", "last space"),
  winBottomHalf: rect("bottom-half", "window to ⬓"),
  winBottomLeft: rect("bottom-left", "window ◱"),
  winBottomLeftSixth: rect("bottom-left-sixth", "window ↓← 1/6"),
  winBottomLeftThird: rect("bottom-left-third", "window ↓← 1/3"),
  winBottomRight: rect("bottom-right", "window ◲"),
  winBottomRightSixth: rect("bottom-right-sixth", "window ↓→ 1/6"),
  winBottomRightThird: rect("bottom-right-third", "window ↓→ 1/3"),
  winCenter: rect("center", "center window"),
  winCenterThird: rect("center-third", "window center 1/3"),
  winCenterTwoThirds: rect("center-two-thirds", "window center 2/3"),
  winClose: rect("close", "close window"),
  winFillBottomLeft: rect("fill-bottom-left", "window fill ◲"),
  winFillBottomRight: rect("fill-bottom-right", "window fill ◲"),
  winFillLeft: rect("fill-left", "window fill ←"),
  winFillRight: rect("fill-right", "window fill →"),
  winFillTopLeft: rect("fill-top-left", "window fill ◰"),
  winFillTopRight: rect("fill-top-right", "window fill ◱"),
  winFirstFourth: rect("first-fourth", "window to ◰"),
  winFirstSixth: rect("first-sixth", "window first 1/6"),
  winFirstThird: rect("first-third", "window first 1/3"),
  winFirstThreeFourths: rect("first-three-fourths", "window first 3/4"),
  winFirstTwoThirds: rect("first-two-thirds", "window first 2/3"),
  winLarger: rect("larger", "make window larger"),
  winLast: rect("last", "go to last window"),
  winLastFourth: rect("last-fourth", "window ◲"),
  winLastSixth: rect("last-sixth", "window last 1/6"),
  winLastThird: rect("last-third", "window last 1/3"),
  winLastThreeFourths: rect("last-three-fourths", "window last 3/4"),
  winLastTwoThirds: rect("last-two-thirds", "window last 2/3"),
  winLeftHalf: rect("left-half", "window ◨"),
  winMaximize: rect("maximize", "window ✥"),
  winMaximizeHeight: rect("maximize-height", "max window height"),
  winMinimize: rect("minimize", "window ⇣"),
  winMoveDown: rect("move-down", "move window ↓"),
  winMoveLeft: rect("move-left", "move window ←"),
  winMoveRight: rect("move-right", "move window →"),
  winMoveUp: rect("move-up", "move window ↑"),
  winNudgeDown: rect("nudge-down", "nudge window ↓"),
  winNudgeLeft: rect("nudge-left", "nudge window ←"),
  winNudgeRight: rect("nudge-right", "nudge window →"),
  winNudgeUp: rect("nudge-up", "nudge window ↑"),
  winPin: rect("pin", "pin window"),
  winRestore: rect("restore", "restore window"),
  winRightHalf: rect("right-half", "window ◧"),
  winSecondFourth: rect("second-fourth", "window ◳"),
  winSmaller: rect("smaller", "make window smaller"),
  winSnapBottomLeft: rect("snap-bottom-left", "snap window ◱"),
  winSnapBottomRight: rect("snap-bottom-right", "snap window to ◲"),
  winSnapTopLeft: rect("snap-top-left", "snap window to ◰"),
  winSnapTopRight: rect("snap-top-right", "snap window to ◳"),
  winsReflowPin: rect("reflow-pin", "reflow pin"),
  winsStashAllButFront: rect("stash-all-but-front", "stash all but front"),
  winStashAll: rect("stash-all", "stash all"),
  winStashDown: rect("stash-down", "stash ↓"),
  winStashLeft: rect("stash-left", "stash ←"),
  winStashRight: rect("stash-right", "stash →"),
  winStashUp: rect("stash-up", "stash ↑"),
  winsTile2x2: rect("tile2x2", "tile ⊞"),
  winsTile2x3: rect("tile2x3", "tile 2x3"),
  winsToggleStashed: rect("toggle-stashed", "toggle stashed"),
  winsUnstash: rect("unstash", "unstash"),
  winsUnstashAll: rect("unstash-all", "unstash all"),
  winThirdFourth: rect("third-fourth", "window to ◳"),
  winTopCenterSixth: rect("top-center-sixth", "window to top center 1/6"),
  winTopHalf: rect("top-half", "window ⬒"),
  winTopLeft: rect("top-left", "window to ◰"),
  winTopLeftSixth: rect("top-left-sixth", "window to ↑← 1/6"),
  winTopLeftThird: rect("top-left-third", "window to ↑← 1/3"),
  winTopRight: rect("top-right", "window to ◳"),
  winTopRightSixth: rect("top-right-sixth", "window to ↑→ 1/6"),
  winTopRightThird: rect("top-right-third", "window to ↑→ 1/3"),
  winUpperCenter: rect("upper-center", "window to upper center"),
  winBottomRightEighth: rect("bottom-right-eighth", "Window to bottom right 1/8"),
  winBottomLeftEighth: rect("bottom-left-eighth", "Window to bottom left 1/8"),
  winTopRightEighth: rect("top-right-eighth", "Window to top right 1/8"),
  winTopLeftEighth: rect("top-left-eighth", "Window to top left 1/8"),
};

const CsxUrls = {
  csxArea: csx("capture-area", "capture a screenshot of an area"),
  csxScreen: csx("capture-fullscreen", "capture a fullscreen screenshot"),
  csxOcr: csx("capture-text", "capture text, preserving line breaks"),
  csxOcrNoLinebreaks: csx("capture-text?linebreaks=false", "capture text without line breaks"),
  csxWindow: csx("capture-window", "capture a screenshot of a window"),
  csxRecord: csx("record-screen", "take a screen recording"),
};

const AntiNoteUrls = {
  antinote: antinote("", "open AntiNote"),
  antinoteNewNote: antinote("new-note", "create a new note in Antinote"),
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
