import type { ConsumerKeyCode, StickyModifierName, ToEvent, ToMouseKey } from "../../types/karabiner";
import type { AppSpec } from "./apps";
import type { CommandSpec } from "./commands";
import type { MapSpec } from "./maps";
import type { PathSpec } from "./paths";
import type { UrlSpec } from "./urls";
import type { VarSpec } from "./vars";
import type { ModKey } from "./keys";
import type { ModComboAlias } from "../constants/keys";

/**
 * Target reference accepted by application actions (`app`).
 * Accepts a typed {@link AppSpec}, a typed {@link PathSpec}, or a raw bundle ID / application file path string.
 */
export type AppTarget = AppSpec | PathSpec | string;

export type AppHistoryExclude =
  | AppTarget
  | AppTarget[]
  | {
      bundle_identifiers?: string[];
      file_paths?: string[];
      exclusionBundleIdentifiers?: string[];
      exclusionFilePaths?: string[];
      exclude?: AppTarget | AppTarget[];
    };

export interface AppHistoryOptions {
  exclude?: AppHistoryExclude;
  exclusionBundleIdentifiers?: string[];
  exclusionFilePaths?: string[];
  bundle_identifiers?: string[];
  file_paths?: string[];
  actionDesc?: string;
}

/** Valid modifier key specifier for actions: individual modifier or virtual modifier alias (`"CO__"`, `"COCS"`). */
export type ActionKeyModifier = ModKey | ModComboAlias;

/** Folder-open strategy: a Finder replacement app, or plain Finder. */
export type FolderOpener = "bloom" | "qspace" | "finder";

/**
 * High-level action specifications evaluated by the synthesizer into Karabiner `to` events.
 */
/**
 * Per-event options carried by an emitting action.
 *
 * These are Karabiner's own `to`-event option names, not a camelCase mirror:
 * `toKey()` spreads this object straight into the emitted event, so a rename
 * here would silently produce a key Karabiner ignores. Timing that maps to
 * `parameters` rather than to an event lives on `Binding.timing` and *is*
 * camelCase — the two are different layers.
 */
export type ActionEventOptions = {
  /** Default false here (Karabiner's own default is true). */
  repeat?: boolean;
  /** In `to_if_alone` / `to_if_held_down`: cancel `to_after_key_up` and `to_delayed_action`. */
  halt?: boolean;
  /** Hold the modifier until another key needs it. */
  lazy?: boolean;
  /**
   * Gap in milliseconds between key_down and key_up when both are sent at once.
   *
   * Required whenever a key must be *held* to register. `to_if_alone` posts
   * key_down and key_up together, so `caps_lock` emitted from a tap needs
   * roughly 200 here or it does nothing (gotchas 5.7, 5.8, 7.4). Pair it with a
   * `vk_none` event to swallow the hardware key_up.
   */
  hold_down_milliseconds?: number;
};

export type ActionSpec =
  | {
      /** Execute a named action in context. */
      type: "actHere";
      action: string;
    }
  | {
      /** Launch or focus an application bundle. */
      type: "app";
      ref: AppTarget;
      mode?: "open" | "shell";
      actionDesc?: string;
    }
  | {
      /** Switch application history state by relative index. */
      type: "appHistory";
      index: number;
      exclude?: AppHistoryExclude;
      actionDesc?: string;
    }
  | {
      /**
       * Move the pointer or scroll while the key is held (`to.mouse_key`).
       *
       * Raw Karabiner axes and signs. Prefer the `mouseMove` / `mouseScroll`
       * wrappers, which take directions instead — the sign conventions are not
       * uniform (gotcha 6.10).
       */
      type: "mouseKey";
      mouseKey: ToMouseKey;
      actionDesc?: string;
    }
  | {
      /** Emit a mouse button click. */
      type: "button";
      button: string;
      modifiers?: ActionKeyModifier[];
      options?: ActionEventOptions;
      actionDesc?: string;
    }
  | {
      /** Apply text case transformation operation on active text selection. */
      type: "caseChange";
      operation: "lowercase" | "sentence_case" | "title_case" | "uppercase";
    }
  | {
      /** Execute a CLI command from registry. */
      type: "command";
      ref: CommandSpec;
      actionDesc?: string;
    }
  | {
      /**
       * Emit a consumer-control event (media/volume/brightness key) —
       * `to.consumer_key_code`, a namespace distinct from `to.key_code`.
       */
      type: "consumerKey";
      key: ConsumerKeyCode | number;
      modifiers?: ActionKeyModifier[];
      options?: ActionEventOptions;
      actionDesc?: string;
    }
  | {
      /** Copy active selection to clipboard (`Cmd+C`). */
      type: "copy";
    }
  | {
      /**
       * Move the mouse cursor to an absolute or screen-relative position
       * (`software_function.set_mouse_cursor_position`).
       */
      type: "cursorTo";
      /** Points (`100`) or percent (`"50%"`). */
      x: number | string;
      /** Points (`100`) or percent (`"50%"`). */
      y: number | string;
      screen?: number;
      relativeTo?: "screen" | "focused_window";
      fallbackTo?: "none" | "screen";
      actionDesc?: string;
    }
  | {
      /** Cut active selection to clipboard (`Cmd+X`). */
      type: "cut";
    }
  | {
      /**
       * Simulate a mouse double-click via the OS event system rather than two
       * hardware clicks (`software_function.cg_event_double_click`). Laggier
       * than `sequence([button(...), button(...)])` and needs Accessibility
       * permission for `karabiner_console_user_server` — prefer two real
       * clicks unless this is specifically required.
       */
      type: "doubleClick";
      /** CGMouseButton: 0 left (default), 1 right, 2 middle, 3+ other. */
      button?: number;
      actionDesc?: string;
    }
  | {
      /** Emit a hotkey map specification. */
      type: "map";
      ref: MapSpec;
      options?: ActionEventOptions;
      actionDesc?: string;
    }
  | {
      /** Open a folder path in Finder. */
      type: "folder";
      ref: PathSpec;
      actionDesc?: string;
    }
  | {
      /** Emit a single key press with optional modifiers and options. */
      type: "key";
      key: string;
      modifiers?: ActionKeyModifier[];
      options?: ActionEventOptions;
      actionDesc?: string;
    }
  | {
      /** No-operation (swallows key event without emitting output). */
      type: "noop";
    }
  | {
      /** Execute an AppleScript script file. */
      type: "osascript";
      scriptPath: string;
      args?: string[];
      actionDesc?: string;
    }
  | {
      /** Paste clipboard contents (`Cmd+V`). */
      type: "paste";
    }
  | {
      /** Execute a Python script inside a virtual environment or with arguments. */
      type: "python";
      scriptPath: string;
      venv?: string;
      args?: string[];
      actionDesc?: string;
    }
  | {
      /** Mutate a Karabiner state variable. */
      type: "setVar";
      var: VarSpec;
      value?: number | string | boolean;
      toggle?: boolean;
    }
  | {
      /** Execute a sequential series of actions in order. */
      type: "sequence";
      actions: ActionSpec[];
    }
  | {
      /** Execute a raw shell command string or command primitive. */
      type: "shell";
      command: string | CommandSpec;
      actionDesc?: string;
    }
  | {
      /** Put the Mac to sleep (`software_function.iokit_power_management_sleep_system`). */
      type: "sleepSystem";
      /** Delay before sleeping, in milliseconds. Karabiner defaults to 500. */
      delayMilliseconds?: number;
      actionDesc?: string;
    }
  | {
      /**
       * Toggle a modifier key sticky — it stays "held" until pressed again or
       * cleared, rather than releasing with the key event (`to.sticky_modifier`).
       * Karabiner does not accept booleans here; use `"on"` / `"off"` / `"toggle"`.
       */
      type: "sticky";
      flag: StickyModifierName;
      toggle?: "on" | "off" | "toggle";
      actionDesc?: string;
    }
  | {
      /** Wrap selected text string in delimiter characters (quotes, braces, etc.). */
      type: "wrapString";
      operation:
        | "wrap_braces"
        | "wrap_parentheses"
        | "wrap_quotes"
        | "wrap_brackets";
      delaySeconds?: number;
    }
  | {
      /** Open a URL or custom URI scheme. */
      type: "url";
      url: UrlSpec | string;
      background?: boolean;
      actionDesc?: string;
    };

/** Union of high-level ActionSpec and native Karabiner ToEvent objects. */
export type Action = ActionSpec | ToEvent;
