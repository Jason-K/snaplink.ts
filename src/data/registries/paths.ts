import type { PathSpec } from "../primitives/paths";
import { HOME, HOMEBREW_PREFIX, SHARED_VENV, TP_CLI, TMPDIR, USER } from "../constants/env";

export { HOME, HOMEBREW_PREFIX, SHARED_VENV, TP_CLI, TMPDIR, USER };

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
const runtimeProcess = globalThis as {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const ENV_DIRS = {
  xdgConfig: path(`${runtimeProcess.process?.env?.XDG_CONFIG_HOME ?? "$HOME/.config"}`, "XDG Config dir"),
  xdgData: path(`${runtimeProcess.process?.env?.XDG_DATA_HOME ?? "$HOME/.local/share"}`, "XDG Data dir"),
  xdgCache: path(`${runtimeProcess.process?.env?.XDG_CACHE_HOME ?? "$HOME/.cache"}`, "XDG Cache dir"),
  xdgBin: path(`${runtimeProcess.process?.env?.XDG_BIN_HOME ?? "$HOME/.local/bin"}`, "XDG Bin dir"),
  xdgState: path(`${runtimeProcess.process?.env?.XDG_STATE_HOME ?? "$HOME/.local/state"}`, "XDG State dir"),
  zDotDir: path(`${runtimeProcess.process?.env?.ZDOTDIR ?? "$HOME/.config/zsh"}`, "ZSH home dir"),
  chezmoiDir: path("$HOME/.local/share/chezmoi", "chezmoi"),
  brewDir: path(`/opt/homebrew`, "Brew home dir"),
  scriptsDir: path("$HOME/Scripts", "Scripts folder"),
  dlsDir: path("$HOME/Downloads", "DLs"),
  appsDir: path(`/Applications`, "Global applications folder"),
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
  getPrivileges: script("apps/privileges/add-priv.sh", "ensure active user has admin privileges"),
  here2there: script("active_process/take_action_here/take_action_here.sh", "Here2There script"),
  recentDls: script("filesystem/recent_changes/recent_dl.sh", "recent Dls script"),
  stringThings: script("strings/text_processor/interfaces/cli.py", "text processor cli entrypoint"),
  lastTypinatorRule: script(
    "apps/Typinator/Edit_Last_Typinator_Expansion.applescript",
    "edit last Typinator expansion",
  ),
  newTypinatorRule: script("apps/Typinator/new_rule/new_rule.py", "create new Typinator rule"),
  getDocPath: path(
    `${HOME}/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript`,
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
