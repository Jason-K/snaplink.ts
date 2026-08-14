/**
 * The single registry of what each {@link ActionSpec} variant *is*.
 *
 * Every consumer of the action union reads from this one object, so adding a
 * new action type is two edits: add the variant to `ActionSpec`, add its entry
 * here. The `satisfies ActionHandlers` annotation makes a missing entry a
 * compile error naming the tag you forgot — previously the same information was
 * spread across a `switch` with a silent `default:`, a second `switch`, and a
 * hand-maintained `Set` of tag strings that nothing kept in sync.
 */

import type { ToEvent, ToMouseKey } from "../../types/karabiner";
import type { Action, ActionSpec } from "../../data";
import { FINDER_REPLACEMENT } from "../../data/constants/env";
import { expandModifiers, resolveButton, resolveKeyAlias } from "../utils";
import { keyTokenToLabel, modifierTokenToSymbols } from "../resolve-description/rule-descriptions";
import { toKey, toPointingButton } from "../karabiner-helpers";

import { resolveAppTarget, toApp, toAppId, toAppPath } from "./resolve-app";
import { toVar } from "./resolve-conditions";
import { toFolder } from "./resolve-folder";
import { toCmd, toHere2There, toOsa, toPy, toTp, toWithSleep } from "./resolve-script";

/** Narrow the action union to one variant by its tag. */
type OfType<T extends ActionSpec["type"]> = Extract<ActionSpec, { type: T }>;

export type ActionHandler<T extends ActionSpec["type"]> = {
  /** Compile the action into Karabiner `to` events. */
  toEvents: (action: OfType<T>) => ToEvent[];
  /** One-line human description, used to synthesize rule descriptions. */
  describe: (action: OfType<T>) => string;
  /**
   * The shell command this action runs, when it is expressible as one.
   * Actions that emit key events rather than shell commands omit this.
   */
  shellCommand?: (action: OfType<T>) => string;
};

/** Every action tag must have a handler; omitting one is a compile error. */
export type ActionHandlers = {
  [T in ActionSpec["type"]]: ActionHandler<T>;
};

/** Append ` | actionDesc` when the action carries a nuance label. */
function withDesc(base: string, actionDesc?: string): string {
  return actionDesc ? `${base} | ${actionDesc}` : base;
}

function nonEmpty<T extends object>(o: T | undefined): T | undefined {
  return o && Object.keys(o).length ? o : undefined;
}

function keyEvent(
  key: string,
  modifiers?: string[],
  options?: { repeat?: boolean; halt?: boolean; lazy?: boolean },
): ToEvent {
  const mods = modifiers?.length ? expandModifiers(modifiers) : undefined;
  return toKey(resolveKeyAlias(key), mods?.length ? mods : undefined, nonEmpty(options));
}

function describeKeyEmit(key: string, modifiers?: string[]): string {
  const label = keyTokenToLabel(key);
  const mods = modifiers?.length
    ? expandModifiers(modifiers).map(modifierTokenToSymbols).join("")
    : "";
  return mods ? `Emit ${mods} + '${label}'` : `Emit '${label}'`;
}

function urlString(url: OfType<"url">["url"]): string {
  return typeof url === "string" ? url : url.url;
}

function pythonCommandFor(a: OfType<"python">): string {
  return toPy(a.scriptPath, {
    ...(a.venv !== undefined ? { venv: a.venv } : {}),
    ...(a.args !== undefined ? { args: a.args } : {}),
  });
}

/**
 * Human label for a `mouse_key`, in directions rather than signs.
 *
 * Karabiner's axis conventions are not uniform: `y > 0` moves the pointer down
 * and `vertical_wheel > 0` scrolls down, but `horizontal_wheel > 0` scrolls
 * **left** (gotcha 6.10). Reading a raw spec back is exactly where that bites.
 */
function describeMouseKey(m: ToMouseKey): string {
  const parts: string[] = [];
  if (m.x) parts.push(`pointer ${m.x > 0 ? "right" : "left"}`);
  if (m.y) parts.push(`pointer ${m.y > 0 ? "down" : "up"}`);
  if (m.vertical_wheel) parts.push(`scroll ${m.vertical_wheel > 0 ? "down" : "up"}`);
  if (m.horizontal_wheel) parts.push(`scroll ${m.horizontal_wheel > 0 ? "left" : "right"}`);
  if (m.speed_multiplier !== undefined) parts.push(`speed x${m.speed_multiplier}`);
  return parts.length ? parts.join(", ") : "mouse key";
}

export const ACTION_HANDLERS = {
  actHere: {
    toEvents: (a) => [toCmd(toHere2There(a.action))],
    describe: (a) => `Context action: ${a.action}`,
    shellCommand: (a) => toHere2There(a.action),
  },

  app: {
    toEvents: (a) => {
      const target = resolveAppTarget(a.ref);
      if (a.mode === "shell") {
        return [
          toCmd("filePath" in target ? toAppPath(target.filePath) : toAppId(target.bundleIdentifier)),
        ];
      }
      return [toApp(target)];
    },
    describe: (a) =>
      withDesc(
        `${a.mode === "shell" ? "open-shell" : "open"} ${
          typeof a.ref === "string" ? a.ref : a.ref.refDesc
        }`,
        a.actionDesc,
      ),
    shellCommand: (a) => {
      const target = resolveAppTarget(a.ref);
      return "filePath" in target ? toAppPath(target.filePath) : toAppId(target.bundleIdentifier);
    },
  },

  appHistory: {
    toEvents: (a) => [toApp({ historyIndex: a.index })],
    describe: (a) => `Go back ${a.index} apps`,
  },

  mouseKey: {
    toEvents: (a) => [{ mouse_key: a.mouseKey }],
    describe: (a) => a.actionDesc ?? describeMouseKey(a.mouseKey),
  },

  button: {
    toEvents: (a) => {
      const mods = a.modifiers?.length ? expandModifiers(a.modifiers) : undefined;
      return [
        toPointingButton(
          // Resolves aliases ("back") to real names; `buttonN` passes through.
          resolveButton(a.button).button,
          mods?.length ? (mods as never) : undefined,
          nonEmpty(a.options),
        ),
      ];
    },
    describe: (a) => withDesc(`Click button '${a.button}'`, a.actionDesc),
  },

  caseChange: {
    toEvents: (a) => [toKey("x", ["command"]), toCmd(toTp(a.operation))],
    describe: (a) => `Change case to ${a.operation}`,
    shellCommand: (a) => toTp(a.operation),
  },

  command: {
    toEvents: (a) => [toCmd(a.ref.command)],
    describe: (a) => withDesc(`Run command '${a.ref.refDesc}'`, a.actionDesc),
    shellCommand: (a) => a.ref.command,
  },

  copy: {
    toEvents: () => [toKey("c", ["command"])],
    describe: () => "Copy selection",
  },

  cut: {
    toEvents: () => [toKey("x", ["command"])],
    describe: () => "Cut selection",
  },

  folder: {
    toEvents: (a) => [toCmd(toFolder(a.ref.path, FINDER_REPLACEMENT))],
    describe: (a) => withDesc(`open '${a.ref.refDesc}'`, a.actionDesc),
    shellCommand: (a) => toFolder(a.ref.path, FINDER_REPLACEMENT),
  },

  key: {
    toEvents: (a) => [keyEvent(a.key, a.modifiers, a.options)],
    describe: (a) => withDesc(describeKeyEmit(a.key, a.modifiers), a.actionDesc),
  },

  map: {
    toEvents: (a) => {
      const options = nonEmpty({ ...a.ref?.options, ...a.options });
      if (a.ref?.combos?.length) {
        return a.ref.combos.map((c) => keyEvent(c.key, c.modifiers, options));
      }
      const resolved = resolveKeyAlias(a.ref.keyCode);
      const mods = a.ref?.modifiers?.length ? expandModifiers(a.ref.modifiers) : undefined;
      // vk_* pseudo-keys carry no modifiers of their own.
      if (resolved.startsWith("vk_") && !mods?.length) {
        return [options ? toKey(resolved, undefined, options) : toKey(resolved)];
      }
      return [toKey(resolved, mods?.length ? mods : undefined, options)];
    },
    describe: (a) =>
      withDesc(`map '${a.ref?.refDesc ?? a.ref?.keyCode}'`, a.actionDesc),
  },

  noop: {
    toEvents: () => [],
    describe: () => "No operation",
  },

  osascript: {
    toEvents: (a) => [toOsa(a.scriptPath, ...(a.args ?? []))],
    describe: (a) => withDesc(`Run osascript '${a.scriptPath}'`, a.actionDesc),
  },

  paste: {
    toEvents: () => [toKey("v", ["command"])],
    describe: () => "Paste selection",
  },

  python: {
    toEvents: (a) => [toCmd(pythonCommandFor(a))],
    describe: (a) => withDesc(`Run python '${a.scriptPath}'`, a.actionDesc),
    shellCommand: pythonCommandFor,
  },

  sequence: {
    toEvents: (a) => a.actions.flatMap(actionToEvents),
    describe: (a) => a.actions.map(describeAction).join(" then "),
  },

  setVar: {
    toEvents: (a) => [toVar(a.var.name, a.toggle ? "toggle" : a.value)],
    describe: (a) => `Set ${a.var.varDesc}`,
  },

  shell: {
    toEvents: (a) => [
      toCmd(typeof a.command === "string" ? a.command : a.command.command),
    ],
    describe: (a) =>
      withDesc(
        `Run '${typeof a.command === "string" ? a.command : a.command.refDesc}'`,
        a.actionDesc,
      ),
    shellCommand: (a) => (typeof a.command === "string" ? a.command : a.command.command),
  },

  url: {
    toEvents: (a) => [
      toCmd(a.background ? `open -g '${urlString(a.url)}'` : `open -u '${urlString(a.url)}'`),
    ],
    describe: (a) => {
      const url = a.url;
      if (typeof url === "string") return withDesc(`Open '${url}'`, a.actionDesc);
      const isCleanShot =
        url.category === "cleanshot" || url.url.startsWith("cleanshot://");
      const isRaycast =
        url.category === "raycast" || url.url.startsWith("raycast-x://extensions/");
      const base = isCleanShot
        ? `${url.refDesc} using CSX`
        : isRaycast
          ? `Call '${url.refDesc}'`
          : `Open '${url.refDesc}'`;
      return withDesc(base, a.actionDesc);
    },
    shellCommand: (a) =>
      a.background ? `open -g '${urlString(a.url)}'` : `open -u '${urlString(a.url)}'`,
  },

  wrapString: {
    toEvents: (a) => [
      toKey("x", ["command"]),
      toCmd(toWithSleep(a.delaySeconds ?? 0.1, toTp(a.operation))),
    ],
    describe: (a) => `Wrap selection in ${a.operation}`,
    shellCommand: (a) => toWithSleep(a.delaySeconds ?? 0.1, toTp(a.operation)),
  },
} satisfies ActionHandlers;

/** Every recognised action tag, derived from the registry. */
export const ACTION_SPEC_TYPES: ReadonlySet<string> = new Set(
  Object.keys(ACTION_HANDLERS),
);

/** `true` when the action is a high-level {@link ActionSpec}, not a raw `ToEvent`. */
export function isActionSpec(action: Action): action is ActionSpec {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    ACTION_SPEC_TYPES.has(action.type as string)
  );
}

function handlerFor<T extends ActionSpec["type"]>(type: T): ActionHandler<T> {
  return ACTION_HANDLERS[type] as ActionHandler<T>;
}

/** Compile one {@link ActionSpec} into Karabiner `to` events. */
export function actionToEvents(action: ActionSpec): ToEvent[] {
  return handlerFor(action.type).toEvents(action as never);
}

/** One-line human description for an {@link ActionSpec}. */
export function describeAction(action: ActionSpec): string {
  return handlerFor(action.type).describe(action as never);
}

/** The shell command an action runs, or `null` when it emits events instead. */
export function resolveShellCommand(action: ActionSpec): string | null {
  const handler = handlerFor(action.type);
  return handler.shellCommand ? handler.shellCommand(action as never) : null;
}
