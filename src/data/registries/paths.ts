import { HOME, HOMEBREW_PREFIX, SHARED_VENV, TMPDIR, TP_CLI, USER } from "../constants/env";
import type { PathSpec } from "../primitives/paths";

export { HOME, HOMEBREW_PREFIX, SHARED_VENV, TMPDIR, TP_CLI, USER };

// ---------------------------------------------------------
// Factory
// ---------------------------------------------------------

/** Create a registry entry for a file-system path.
 *  @param pathStr - absolute file or directory path (e.g. "/opt/homebrew")
 *  @param refDesc - human label used in descriptions
 */
const path = (pathStr: string, refDesc: string): PathSpec => ({
  type: "path",
  path: pathStr,
  refDesc,
});

// ---------------------------------------------------------
// Environment helpers (kept at top of registry section)
// ---------------------------------------------------------
const ENV_DIRS = {
  xdgConfig: path("$HOME/.config", "XDG Config dir"),
  xdgData: path("$HOME/.local/share", "XDG Data dir"),
  xdgCache: path("$HOME/.cache", "XDG Cache dir"),
  xdgBin: path("$HOME/.local/bin", "XDG Bin dir"),
  xdgState: path("$HOME/.local/state", "XDG State dir"),
  zDotDir: path("$HOME/.config/zsh", "ZSH home dir"),
  chezmoiDir: path("$HOME/.local/share/chezmoi", "chezmoi"),
  brewDir: path("/opt/homebrew", "Brew home dir"),
  scriptsDir: path("$HOME/Scripts", "Scripts folder"),
  dlsDir: path("$HOME/Downloads", "DLs"),
  appsDir: path("/Applications", "Global applications folder"),
  onedriveWork: path("$HOME/Library/CloudStorage/OneDrive-BoxerandGerson,LLP", "work OneDrive"),
  onedrivePersonal: path("$HOME/Library/CloudStorage/OneDrive-Personal", "my OneDrive"),
  sharedVenv: path("$HOME/Scripts/.venv/shared_venv", "shared venv"),
  typinatorVenv: path("$HOME/.venv/typinator", "Typinator venv"),
};

const BIN_DIRS = {
  brewBin: path(`${ENV_DIRS.brewDir.path}/bin`, "Brew bins"),
};

// Scoped factory helpers for concise single-line path definitions
const script = (relPath: string, desc: string): PathSpec => path(`${ENV_DIRS.scriptsDir.path}/${relPath}`, desc);

const brewBin = (binName: string, desc: string): PathSpec => path(`${BIN_DIRS.brewBin.path}/${binName}`, desc);

const xdgBin = (binName: string, desc: string): PathSpec => path(`${ENV_DIRS.xdgBin.path}/${binName}`, desc);

const workDoc = (relPath: string, desc: string): PathSpec =>
  path(`${ENV_DIRS.onedriveWork.path}/Documents/${relPath}`, desc);

const SCRIPT_DIR = {
  stringThingsDir: script("strings/text_processor", "Text Processor script folder"),
  dirGits: path("$HOME/gits", "Gits"),
  dirWorkspaces: script("workspaces", "VSC workspaces folder"),
};

const WORK_DIRS = {
  myCases: workDoc("0-myCases", "my cases"),
  workLib: workDoc("1-firmLibrary", "work library"),
};

const SCRIPT_FILES = {
  getPrivileges: script("apps/privileges/call_priv.sh", "ensure active user has admin privileges"),
  here2there: script("active_process/take_action_here/take_action_here.sh", "Here2There script"),
  recentDls: script("filesystem/recent_changes/recent_dl.sh", "recent Dls script"),
  stringThings: script("strings/text_processor/interfaces/cli.py", "text processor cli entrypoint"),
  lastTypinatorRule: script(
    "apps/Typinator/edit_last_rule/Edit_Last_Typinator_Expansion.applescript",
    "edit last Typinator expansion",
  ),
  newTypinatorRule: script("apps/Typinator/new_rule/new_rule.py", "create new Typinator rule"),
  getDocPath: path(
    `${HOME}/Developer/snaplink.ts/scripts/applescripts/get-word-document-path.applescript`,
    "get path to active word document",
  ),
};

const CONFIG_FILES = {
  configKE: path(`${ENV_DIRS.xdgConfig.path}/karabiner/karabiner.json`, "Karabiner configuration file"),
};

const BIN_FILES = {
  binCliClick: xdgBin("binCliClick", "cliclick binary"),
  binHSBridge: path("$HOME/Hammer-Console/cli/hammer", "Hammer CLI bin"),
  binAppKill: xdgBin("kill-app", "kill app"),
  binAppOpen: xdgBin("open-app", "open app"),
  binPrivCLI: path("/Applications/Privileges.app/Contents/MacOS/PrivilegesCLI", "PrivilegesCLI"),
  binHS: brewBin("hs", "Hammerspoon binary"),
  binNeru: brewBin("neru", "Neru binary"),
  binSendKeys: brewBin("SendKeys", "Sendkeys"),
  binSharedVenv: path(`${ENV_DIRS.sharedVenv.path}/bin/python`, "shared venv python"),
  binTypinatorVenv: path(`${ENV_DIRS.typinatorVenv.path}/bin/python`, "python bin for Typinator"),
  binUV: xdgBin("uv", "UV binary"),
};

// ---------------------------------------------------------
// Registry
// ---------------------------------------------------------

export const PATHS = {
  ...ENV_DIRS,
  ...BIN_DIRS,
  ...SCRIPT_DIR,
  ...WORK_DIRS,
  ...SCRIPT_FILES,
  ...CONFIG_FILES,
  ...BIN_FILES,
} as const;

export type { PathSpec };
