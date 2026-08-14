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

const SCRIPT_DIR = {
  stringThingsDir: path(
    `${ENV_DIRS.scriptsDir.path}/strings/text_processor`,
    "Text Processor script folder",
  ),
  dirGits: path("$HOME/gits", "Gits"),
  dirWorkspaces: path("$HOME/Scripts/workspaces", "VSC workspaces folder"),
};

const WORK_DIRS = {
  myCases: path(
    `${ENV_DIRS.onedriveWork.path}/Documents/0-myCases`,
    "my cases",
  ),
  workLib: path(
    `${ENV_DIRS.onedriveWork.path}/Documents/1-firmLibrary`,
    "work library",
  ),
};

const SCRIPT_FILES = {
  here2there: path(
    `${ENV_DIRS.scriptsDir.path}/active_process/take_action_here/take_action_here.sh`,
    "Here2There script",
  ),
  recentDls: path(
    `${ENV_DIRS.scriptsDir.path}/filesystem/recent_changes/recent_dl.sh`,
    "Recent Dls script",
  ),
  stringThings: path(
    `${ENV_DIRS.scriptsDir.path}/strings/text_processor/interfaces/cli.py`,
    "Text Processor CLI entrypoint",
  ),
  lastTypinatorRule: path(
    `${ENV_DIRS.scriptsDir.path}/apps/Typinator/Edit_Last_Typinator_Expansion.applescript`,
    "edit the last Typinator rule",
  ),
  newTypinatorRule: path(
    `${ENV_DIRS.scriptsDir.path}/apps/Typinator/new_rule/new_rule.py`,
    "create a new Typinator rule",
  ),
  getDocPath: path(
    `${HOME}/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript`,
    "get path to active word document",
  ),
};

const CONFIG_FILES = {
  configKE: path(
    `${ENV_DIRS.xdgConfig.path}/karabiner/karabiner.json`,
    "Karabiner configuration file",
  ),
};

const BIN_FILES = {
  binCliClick: path(`${ENV_DIRS.xdgBin.path}/binCliClick`, "Cliclick binary"),
  binHSBridge: path("$HOME/Hammer-Console/cli/hammer", "Hammer CLI bin"),
  binAppKill: path(`${ENV_DIRS.xdgBin.path}/kill-app`, "Kill App binary"),
  binAppOpen: path(`${ENV_DIRS.xdgBin.path}/open-app`, "Open App binary"),
  binPrivCLI: path(
    `/Applications/Privileges.app/Contents/MacOS/PrivilegesCLI`,
    "PrivilegesCLI",
  ),
  binHS: path(`${BIN_DIRS.brewBin.path}/hs`, "Hammerspoon binary"),
  binNeru: path(`${BIN_DIRS.brewBin.path}/neru`, "Neru binary"),
  binSendKeys: path(`${BIN_DIRS.brewBin.path}/SendKeys`, "Sendkeys"),
  binSharedVenv: path(`${ENV_DIRS.sharedVenv.path}/bin/python`, "shared venv python"),
  binTypinatorVenv: path(
    `${ENV_DIRS.typinatorVenv.path}/bin/python`,
    "python bin for Typinator",
  ),
  binUV: path(`${ENV_DIRS.xdgBin.path}/uv`, "UV binary"),
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
