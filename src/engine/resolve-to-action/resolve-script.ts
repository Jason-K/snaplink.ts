import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToEvent } from "../../types/karabiner";

import { PATHS } from "../../data/registries/paths";
import { normalizePathForShell, shellSingleQuote } from "../utils";

export function toCmd(shell: string): ToEvent {
  return { shell_command: shell };
}

/**
 * Send a datagram to a user-provided UNIX socket server. Lower latency than
 * `toCmd`, which has to spawn a shell.
 */
export function toUserCommand(payload: unknown, endpoint?: string): ToEvent {
  return {
    send_user_command: {
      payload,
      ...(endpoint ? { endpoint } : {}),
    },
  };
}

/** Re-emit the triggering event unchanged (`to.from_event`). */
export function toTrigger(): ToEvent {
  return { from_event: true };
}

const ENABLE_LAYER_INDICATOR_USER_COMMAND = true;
const DEFAULT_LAYER_INDICATOR_USER_COMMAND_ENDPOINT =
  "/tmp/karabiner-layer-indicator.sock";

function readLayerIndicatorUserCommandEndpoint(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const endpointPath = resolve(
      currentDir,
      "../../../scripts/layer-indicator/layer-indicator-user-command-endpoint.txt",
    );
    const endpoint = readFileSync(endpointPath, "utf8").trim();
    return endpoint || DEFAULT_LAYER_INDICATOR_USER_COMMAND_ENDPOINT;
  } catch {
    return DEFAULT_LAYER_INDICATOR_USER_COMMAND_ENDPOINT;
  }
}

const LAYER_INDICATOR_USER_COMMAND_ENDPOINT =
  readLayerIndicatorUserCommandEndpoint();

/**
 * Create a user command for the layer-indicator receiver.
 * Replaces hammerspoon:// scheme calls with more efficient send_user_command events.
 */
export function toLayerIndicator(
  action: "show" | "hide",
  layer?: string,
): ToEvent {
  if (ENABLE_LAYER_INDICATOR_USER_COMMAND) {
    const payload: Record<string, string> = { action };
    if (layer !== undefined) {
      payload.layer = layer;
    }
    return toUserCommand(payload, LAYER_INDICATOR_USER_COMMAND_ENDPOINT);
  }

  if (action === "show") {
    const targetLayer = layer ?? "space";
    return toCmd(
      `open -g 'hammerspoon://layer_indicator?action=show&layer=${targetLayer}'`,
    );
  }

  return toCmd(`open -g 'hammerspoon://layer_indicator?action=hide'`);
}

export function toOsa(scriptPath: string, ...args: string[]): ToEvent {
  const p = normalizePathForShell(scriptPath);
  const parts = ["osascript", p, ...args.map((a) => shellSingleQuote(a))];
  return toCmd(parts.join(" "));
}

function pythonCommand(
  spec: string | string[],
  opts?: { useEnv?: boolean; pythonBin?: string },
): string {
  const pythonBin = opts?.pythonBin ?? "python3";
  if (Array.isArray(spec)) {
    const joined = spec
      .map((s) => (s.includes(" ") ? shellSingleQuote(s) : s))
      .join(" ");
    return `${pythonBin} ${joined}`;
  }
  return `${pythonBin} ${spec}`;
}

export function toPy(
  scriptPath: string,
  opts?: { venv?: string; args?: string[] },
): string {
  const parts = [PATHS.binUV.path, "run"];
  if (opts?.venv) {
    parts.push("--python", normalizePathForShell(`${opts.venv}/bin/python`));
  }
  parts.push(normalizePathForShell(scriptPath));
  if (opts?.args?.length) {
    parts.push(...opts.args.map(shellSingleQuote));
  }
  return parts.join(" ");
}

export function toTp(action: string): string {
  return pythonCommand(
    [
      PATHS.stringThings.path,
      action,
      "--source",
      "clipboard",
      "--dest",
      "paste",
    ],
    {
      pythonBin: `${PATHS.binUV.path} --directory ${PATHS.stringThingsDir.path} run python`,
    },
  );
}

export function toWithSleep(delaySeconds: number, shell: string): string {
  return `sleep ${delaySeconds} && ${shell}`;
}

export function toHere2There(action: string): string {
  return `${PATHS.here2there.path} --action ${action}`;
}
