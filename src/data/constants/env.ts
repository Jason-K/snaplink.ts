import type { FolderOpener } from "../primitives/actions";

export const FINDER_REPLACEMENT: FolderOpener = "qspace";

export const HOME = "$HOME";
export const HOMEBREW_PREFIX = "$HOMEBREW_PREFIX";
export const SHARED_VENV = "$SHARED_VENV";
export const TP_CLI = "$TP_CLI";
export const TMPDIR = "$TMPDIR";
export const USER = "$USER";

export const SHELL_ENV: string[] = [
  "HOME",
  "HOMEBREW_PREFIX",
  "SHARED_VENV",
  "TP_CLI",
  "TMPDIR",
  "USER",
  "LOGNAME",
  "SHELL",
  "PATH",
  "PWD",
  "SSH_AUTH_SOCK",
  "DISPLAY",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_BIN_HOME",
  "XDG_STATE_HOME",
  "ZDOTDIR",
];
