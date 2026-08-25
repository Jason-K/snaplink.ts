import type {
  Action,
  ActionEventOptions,
  ActionKeyModifier,
  ActionSpec,
  AppHistoryExclude,
  AppHistoryOptions,
  AppSpec,
  AppTarget,
  Case,
  CommandSpec,
  Condition,
  KeyCode,
  MapSpec,
  ModKey,
  PathSpec,
  Phase,
  UrlSpec,
  VarSpec,
} from "../../data";
import type { ConsumerKeyCode, StickyModifierName, ToMouseKey } from "../../types/karabiner";
import { resolveKeyAlias } from "../utils";
import { state } from "./condition-wrappers";
import type { StateItem } from "./condition-wrappers";

// Type-only imports to enable IDE IntelliSense {@link ...} symbol resolution in JSDoc comments.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { APPS, CMDS, COMBOS, DEVICES, PATHS, URLS, VARS } from "../../data";
import type { bind, bindKeys, bindPointer } from "./binding-wrappers";
import type {
  condApp,
  condDevice,
  condNotApp,
  condNotVar,
  condState,
  condUnless,
  condVar,
  ifApp,
  ifDevice,
  ifKeVar,
  ifState,
  ifUserVar,
  ifVar,
  unless,
  unlessApp,
  unlessKeVar,
  unlessUserVar,
  WhenWrapper,
} from "./condition-wrappers";
import type { from } from "./from-action-wrappers";
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Union of all inputs accepted by action phase wrappers ({@link press}, {@link release}, {@link hold}, {@link tap}, {@link doubleTap}, {@link guard}, {@link tapAndHold}).
 *
 * Accepts built {@link Action} objects, or bare registry primitives ({@link UrlSpec} from `URLS.*`, {@link MapSpec} from `COMBOS.*`, {@link CommandSpec} from `CMDS.*`, {@link AppSpec} from `APPS.*`)
 * that are automatically promoted to their corresponding {@link ActionSpec}.
 */
export type ActionInput = Action | UrlSpec | MapSpec | CommandSpec | AppSpec;

/**
 * `true` for a raw registry primitive (something with `refDesc`, per
 * `BaseSpec`) rather than a built `Action`.
 *
 * Deliberately NOT based on the `type` tag: `UrlSpec`/`MapSpec`/`CommandSpec`/
 * `AppSpec` reuse the same `type` string as their corresponding `ActionSpec`
 * variant ("map", "url", "command", "app" — see `isActionSpec()` in
 * `action-handlers.ts`), so a tag-only check would misidentify a raw
 * `MapSpec` as an already-built `map` action and hand it to `actionToEvents()`
 * with no `.ref`, crashing at `resolveKeyAlias(a.ref.keyCode)`. `refDesc`
 * (required by `BaseSpec` on every registry primitive, and never present on a
 * built `ActionSpec`, which uses `actionDesc` instead) is collision-free.
 */
function isRawRegistrySpec(x: ActionInput): x is UrlSpec | MapSpec | CommandSpec | AppSpec {
  return typeof x === "object" && x !== null && "refDesc" in x;
}

/** Promote a raw registry primitive to its `ActionSpec`; pass built actions through untouched. */
function normalizeAction(action: ActionInput): Action {
  if (!isRawRegistrySpec(action)) return action;
  switch (action.type) {
    case "url":
      return url(action);
    case "map":
      return map(action);
    case "command":
      return cmd(action);
    case "app":
      return app(action);
    default: {
      const exhaustive: never = action;
      throw new Error(`normalizeAction: unrecognized registry spec type '${(exhaustive as { type?: string }).type}'`);
    }
  }
}

/**
 * Fluent builder for {@link Case} items in Karabiner bindings.
 *
 * Implements {@link Case} directly so builder instances can be placed into `cases: [...]` arrays or returned from phase functions.
 * Provides chaining methods (`.when(...)`, `.withTapCount(...)`, `.withDelayed(...)`, `.guardProtection(...)`, `.describe(...)`, `.withSuppress(...)`).
 */
export class CaseBuilder implements Case {
  phase?: Phase;
  do: Action[];
  declare conditions?: Condition[];
  declare tapCount?: number;
  declare description?: string;
  declare suppress?: boolean;
  declare delayed?: boolean;
  declare guard?: boolean;

  /**
   * Constructs a new {@link CaseBuilder} instance.
   *
   * @param phase - Lifecycle phase (`"press"`, `"release"`, or `"hold"`).
   * @param actions - Target action(s) or registry primitive(s) to execute.
   * @param conditions - Optional condition or array of conditions.
   */
  constructor(phase: Phase, actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]) {
    this.phase = phase;
    this.do = (Array.isArray(actions) ? actions : [actions]).map(normalizeAction);
    delete this.conditions;
    delete this.tapCount;
    delete this.description;
    delete this.suppress;
    delete this.delayed;
    delete this.guard;

    if (conditions) {
      this.when(conditions);
    }
  }

  /**
   * Adds one or more condition filters to this case.
   *
   * Use when gating a specific action case to only trigger under certain conditions (e.g. frontmost app, active layer variable, source device).
   * Accepts pre-built {@link Condition} objects, {@link WhenWrapper} containers, bare registry specs (`APPS.*`, `DEVICES.*`, `VARS.*`), or `[target, value]` tuples.
   *
   * Recognized condition builders:
   * - {@link state} / {@link condState} / {@link ifState} — evaluates state specs, registry keys (`STATES`, `VARS`), apps, devices, or tuples
   * - {@link unless} / {@link condUnless} — enforces state specs, registry keys, apps, or devices to be false/negated
   * - {@link ifApp} / {@link condApp} — matches frontmost application(s)
   * - {@link unlessApp} / {@link condNotApp} — matches when application(s) are NOT frontmost
   * - {@link ifDevice} / {@link condDevice} — matches hardware source device specifications
   * - {@link ifUserVar} / {@link ifKeVar} / {@link condVar} / {@link ifVar} — matches Karabiner variable values
   * - {@link unlessUserVar} / {@link unlessKeVar} / {@link condNotVar} — matches when variable values do NOT match
   *
   * @param items - Conditions, condition arrays, or bare state specs to attach.
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * press(key("a")).when(ifApp("com.apple.finder"))
   * press(key("b")).when(state(VARS.rButtonDown))
   * press(key("c")).when(APPS.word)
   * ```
   */
  when(...items: (StateItem | readonly StateItem[])[]): this {
    const resolved = items.flatMap((item) => {
      const r = state(item as any) as Condition | Condition[];
      return Array.isArray(r) ? r : [r];
    });
    if (resolved.length > 0) {
      this.conditions = this.conditions ? [...this.conditions, ...resolved] : resolved;
    }
    return this;
  }

  /**
   * Sets the required tap count threshold to trigger this case.
   *
   * Use when configuring multi-tap bindings (e.g. tap count 2 for double-tap, tap count 3 for triple-tap).
   *
   * @param count - Integer tap count required (e.g. `2` for double-tap).
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * press(key("spacebar")).withTapCount(2)
   * ```
   */
  withTapCount(count: number): this {
    this.tapCount = count;
    return this;
  }

  /**
   * Marks whether execution is delayed until the multi-tap window expires.
   *
   * Use when defining single-tap fallback actions on multi-tap keys so the single tap does not fire prematurely during double taps.
   *
   * @param isDelayed - Whether execution is delayed (defaults to `true`).
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * release(key("b")).withDelayed(true)
   * ```
   */
  withDelayed(isDelayed = true): this {
    this.delayed = isDelayed;
    return this;
  }

  /**
   * Enables or disables double-tap guard confirmation protection on this case.
   *
   * Use when protecting destructive actions (e.g. killing processes, quitting apps) from accidental single key presses.
   *
   * @param isGuarded - Whether guard protection is enabled (defaults to `true`).
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * press(shell("killall Finder")).guardProtection(true)
   * ```
   */
  guardProtection(isGuarded = true): this {
    this.guard = isGuarded;
    return this;
  }

  /**
   * Sets an optional human-readable description for this action case.
   *
   * Use when documenting specific case actions for debugging or GUI inspector logs.
   *
   * @param text - Description string for the case.
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * press(key("c", ["cmd"])).describe("Copy selection")
   * ```
   */
  describe(text: string): this {
    this.description = text;
    return this;
  }

  /**
   * Sets whether trigger fallback behavior should be suppressed.
   *
   * Use when intercepting an event exclusively without allowing default key passthrough when conditions match.
   *
   * @param suppress - Whether to suppress fallback (defaults to `true`).
   * @returns `this` for fluent method chaining.
   *
   * @example
   * ```ts
   * press(noop()).withSuppress(true)
   * ```
   */
  withSuppress(suppress = true): this {
    this.suppress = suppress;
    return this;
  }
}

/**
 * Creates a {@link CaseBuilder} for actions executed on the key press (down) phase.
 *
 * Use when an action should fire immediately as soon as the key or mouse button is depressed.
 *
 * Recognized action builders:
 * - {@link key} — key press action with optional modifiers and options (`repeat`, `halt`, `lazy`)
 * - {@link consumerKey} — media, volume, and brightness consumer keys
 * - {@link button} — mouse button press action
 * - {@link app} — launch or focus application
 * - {@link url} — open URL in browser (supports background)
 * - {@link folder} — open file directory
 * - {@link cmd} — run registered command spec
 * - {@link shell} — run shell command
 * - {@link python} — execute python script with virtual environment support
 * - {@link osascript} — run AppleScript/JOSA script
 * - {@link setVar} — set or toggle Karabiner variable
 * - {@link cut} / {@link copy} / {@link paste} — clipboard shortcut actions
 * - {@link sequence} — run multiple action specs sequentially
 * - {@link map} — trigger mapped combo spec
 * - {@link noop} — no-op (swallows trigger without emitting output)
 * - {@link actHere} — in-place context action spec
 * - {@link appHistory} — navigate app history stack
 * - Bare registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly
 *
 * @param actions - {@link ActionInput} or array of actions to execute on press.
 * @param conditions - Optional condition or array of conditions for this case.
 * @returns A {@link CaseBuilder} initialized for the `"press"` phase.
 *
 * @example
 * ```ts
 * press(key("a"))
 * press(COMBOS.showPopclip)
 * press([key("c", ["cmd"])], ifApp(APPS.finder))
 * ```
 */
export function press(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return new CaseBuilder("press", actions, conditions);
}

/**
 * Creates a {@link CaseBuilder} for actions executed on the key release (up) phase.
 *
 * Use when an action should fire upon releasing the key after a brief tap without holding.
 *
 * Recognized action builders:
 * - {@link key}, {@link consumerKey}, {@link button}, {@link app}, {@link url}, {@link folder},
 *   {@link cmd}, {@link shell}, {@link python}, {@link osascript}, {@link setVar}, {@link cut},
 *   {@link copy}, {@link paste}, {@link sequence}, {@link map}, {@link noop}, {@link actHere}, {@link appHistory}
 * - Bare registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly
 *
 * @param actions - {@link ActionInput} or array of actions to execute on release.
 * @param conditions - Optional condition or array of conditions for this case.
 * @returns A {@link CaseBuilder} initialized for the `"release"` phase.
 *
 * @example
 * ```ts
 * release(key("b"))
 * release(URLS.rectDisplayNext)
 * ```
 */
export function release(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return new CaseBuilder("release", actions, conditions);
}

/**
 * Alias for {@link release}. Creates a {@link CaseBuilder} for actions executed on key tap (release phase).
 *
 * Use when specifying tap actions in dual-role tap/hold keys or modal buttons.
 *
 * @param actions - {@link ActionInput} or array of actions to execute on tap.
 * @param conditions - Optional condition or array of conditions.
 * @returns A {@link CaseBuilder} initialized for the `"release"` phase.
 *
 * @example
 * ```ts
 * tap(key("spacebar"))
 * ```
 */
export function tap(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return release(actions, conditions);
}

/**
 * Creates a {@link CaseBuilder} for actions executed on the key hold phase (held past the hold threshold).
 *
 * Use when defining the held action for dual-role modifier keys, layer activation, or repeat triggers.
 *
 * Recognized action builders:
 * - {@link key}, {@link consumerKey}, {@link button}, {@link app}, {@link url}, {@link folder},
 *   {@link cmd}, {@link shell}, {@link python}, {@link osascript}, {@link setVar}, {@link cut},
 *   {@link copy}, {@link paste}, {@link sequence}, {@link map}, {@link noop}, {@link actHere}, {@link appHistory}
 * - Bare registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly
 *
 * @param actions - {@link ActionInput} or array of actions to execute when held down.
 * @param conditions - Optional condition or array of conditions for this case.
 * @returns A {@link CaseBuilder} initialized for the `"hold"` phase.
 *
 * @example
 * ```ts
 * hold(key("left_shift"))
 * hold(APPS.kitty)
 * ```
 */
export function hold(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return new CaseBuilder("hold", actions, conditions);
}

/**
 * Creates a {@link CaseBuilder} for actions requiring a rapid double-tap to execute.
 *
 * Use when assigning secondary shortcut actions triggered by pressing a key twice within the multi-tap threshold window.
 *
 * @param actions - {@link ActionInput} or array of actions to execute on double tap.
 * @param conditions - Optional condition or array of conditions.
 * @returns A {@link CaseBuilder} initialized with tap count 2.
 *
 * @example
 * ```ts
 * doubleTap(app(APPS.terminal))
 * ```
 */
export function doubleTap(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return press(actions, conditions).withTapCount(2);
}

/**
 * Creates a paired 2-tuple containing a tap case (release phase) and a hold case (hold phase) under identical optional conditions.
 *
 * Use as a concise shorthand for standard tap/hold dual-role keys (equivalent to `[release(tapAction), hold(holdAction)]`).
 *
 * @param tapAction - {@link ActionInput} or array of actions to execute on tap (release phase).
 * @param holdAction - {@link ActionInput} or array of actions to execute when held (hold phase).
 * @param conditions - Optional condition or array of conditions applied to both cases.
 * @returns A 2-tuple `[CaseBuilder, CaseBuilder]` representing `[release(tapAction), hold(holdAction)]`.
 *
 * @example
 * ```ts
 * to(tapAndHold(URLS.hsWinToggleFill, URLS.rectDisplayNext))
 * to(tapAndHold(key("spacebar"), key("left_shift")))
 * ```
 */
export function tapAndHold(
  tapAction: ActionInput | ActionInput[],
  holdAction: ActionInput | ActionInput[],
  conditions?: Condition | Condition[],
): [CaseBuilder, CaseBuilder] {
  return [release(tapAction, conditions), hold(holdAction, conditions)];
}

/**
 * Creates a {@link CaseBuilder} for actions requiring a double-tap followed by holding the key down.
 *
 * Use when assigning tertiary actions activated by double-tapping and holding a key (e.g. momentary modal sublayers).
 *
 * @param actions - {@link ActionInput} or array of actions to execute on double tap and hold.
 * @param conditions - Optional condition or array of conditions.
 * @returns A {@link CaseBuilder} initialized with the hold phase and tap count 2.
 *
 * @example
 * ```ts
 * doubleTapHold(key("tab", ["cmd"]))
 * ```
 */
export function doubleTapHold(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return hold(actions, conditions).withTapCount(2);
}

/**
 * Creates a {@link CaseBuilder} for single-tap actions delayed until the multi-tap expiration window completes.
 *
 * Use on keys that have both single-tap and double-tap actions so the single-tap action does not fire prematurely during a double-tap sequence.
 *
 * @param actions - {@link ActionInput} or array of actions to execute on delayed single tap.
 * @param conditions - Optional condition or array of conditions.
 * @returns A {@link CaseBuilder} initialized with the release phase and `delayed: true`.
 *
 * @example
 * ```ts
 * delayedSingleTap(key("escape"))
 * ```
 */
export function delayedSingleTap(
  actions: ActionInput | ActionInput[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  return release(actions, conditions).withDelayed(true);
}

function isConditionLike(val: unknown): boolean {
  if (typeof val !== "object" || val === null) return false;
  if (Array.isArray(val)) return val.length > 0 && isConditionLike(val[0]);
  const obj = val as Record<string, unknown>;
  return (
    "app" in obj ||
    "var" in obj ||
    "device" in obj ||
    (typeof obj.type === "string" && (obj.type.endsWith("_if") || obj.type.endsWith("_unless")))
  );
}

/**
 * Creates a guarded {@link CaseBuilder} requiring double-tap confirmation to execute.
 *
 * Use when guarding destructive or high-impact actions (e.g. killing system services, closing entire workspaces) against accidental key presses.
 * If actions are omitted, automatically defaults to passing through the trigger event on confirmation.
 *
 * @param actionsOrConditions - Optional action(s) to execute under guard protection, or condition(s) if actions are omitted.
 * @param conditions - Optional condition or array of conditions.
 * @returns A {@link CaseBuilder} with double-tap guard protection enabled.
 *
 * @example
 * ```ts
 * guard() // Emits the trigger event only on confirmation
 * guard(shell("killall Finder")) // Emits shell command on confirmation
 * guard(ifApp("com.apple.finder")) // Guarded trigger with condition
 * ```
 */
export function guard(
  actionsOrConditions?: ActionInput | ActionInput[] | Condition | Condition[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  if (isConditionLike(actionsOrConditions)) {
    return press([], actionsOrConditions as Condition | Condition[]).guardProtection(true);
  }
  return press((actionsOrConditions as ActionInput | ActionInput[]) ?? [], conditions).guardProtection(true);
}

/**
 * Container wrapping one or more {@link Case} objects created by {@link to}.
 */
export type ToWrapper = {
  kind: "to";
  cases: Case[];
};

/**
 * Wraps one or more action cases or case arrays into a {@link ToWrapper} container for {@link bind}.
 *
 * Use as the primary destination action builder when constructing bindings with {@link bind}, combining press, release, hold, tap, double-tap, and guard cases.
 *
 * Recognized case wrappers:
 * - {@link press} — executes on key press phase
 * - {@link release} / {@link tap} — executes on key release phase
 * - {@link hold} — executes on key hold phase
 * - {@link doubleTap} — requires double tap to trigger
 * - {@link doubleTapHold} — requires double tap and hold to trigger
 * - {@link delayedSingleTap} — delayed single tap execution for multi-tap
 * - {@link guard} — guarded execution requiring double-tap confirmation
 * - {@link tapAndHold} — combined tap (release) and hold pair
 *
 * @param cases - Cases, case arrays, or {@link CaseBuilder} instances to include.
 * @returns A {@link ToWrapper} container holding all flattened cases.
 *
 * @example
 * ```ts
 * to(press(key("a", ["cmd"])))
 * to(release(key("spacebar")), hold(key("left_shift")))
 * to(tapAndHold(APPS.finder, APPS.terminal))
 * ```
 */
export function to(...cases: (Case | Case[])[]): ToWrapper {
  return {
    kind: "to",
    cases: cases.flat(),
  };
}

/**
 * Creates an action spec to open or switch focus to an application.
 *
 * Use when binding hotkeys to launch apps, bring running apps to the foreground, or toggle app visibility.
 *
 * @param ref - Target {@link AppSpec} (e.g. `APPS.finder`), bundle identifier string, or application name.
 * @param mode - Optional launch mode (`"open"` using macOS `open` or `"shell"` execution).
 * @param actionDesc - Optional human-readable description for documentation and logs.
 * @returns An {@link ActionSpec} of type `"app"`.
 *
 * @example
 * ```ts
 * app("com.apple.finder")
 * app(APPS.browser, "open", "Launch Zen Browser")
 * ```
 */
export function app(ref: AppTarget, mode?: "open" | "shell", actionDesc?: string): ActionSpec {
  return {
    type: "app",
    ref,
    ...(mode ? { mode } : {}),
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to open a URL in the default browser or target scheme handler.
 *
 * Use when opening web links, deep links, or application custom schemes (e.g. `raycast://`, `rectangle://`).
 * Supports background execution without stealing focus.
 *
 * Precedence for `background`:
 * 1. Explicit `background` parameter.
 * 2. `ref.background` (when `ref` is a {@link UrlSpec}).
 * 3. Default fallback: `true` (opens in background via `open -g`).
 *
 * @param ref - Target {@link UrlSpec} (e.g. `URLS.rectDisplayNext`) or URL string.
 * @param background - Whether to open in the background without focusing the browser (defaults to `true` unless pinned by registry).
 * @param actionDesc - Optional human-readable description for documentation and logs.
 * @returns An {@link ActionSpec} of type `"url"`.
 *
 * @example
 * ```ts
 * url("https://github.com") // background: true (default fallback)
 * url(URLS.rectDisplayNext) // background: false (registry pins foreground)
 * url(URLS.rectDisplayNext, false) // explicit override
 * ```
 */
export function url(ref: UrlSpec | string, background?: boolean, actionDesc?: string): ActionSpec {
  const refBackground = typeof ref === "object" ? ref.background : undefined;
  const resolvedBackground = background ?? refBackground ?? true;
  return {
    type: "url",
    url: ref,
    background: resolvedBackground,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Configuration options for key, consumer key, and mouse button output events.
 * Re-exported from {@link ActionEventOptions}.
 *
 * ### Available Options:
 * - `repeat` (`boolean`): Whether the key repeats while held down (defaults to `false` in Snaplink to prevent stuck keys).
 * - `halt` (`boolean`): In `to_if_alone` or `to_if_held_down`, cancels subsequent `to_after_key_up` and `to_delayed_action` channels when this action fires.
 * - `lazy` (`boolean`): Suppresses modifier key events until another non-modifier key is pressed with it.
 * - `hold_down_milliseconds` (`number`): Gap in ms between key_down and key_up when sent together.
 *
 * @example
 * ```ts
 * { repeat: true }
 * { halt: true, lazy: true }
 * { hold_down_milliseconds: 200 }
 * ```
 */
export type KeyOptions = ActionEventOptions;

/**
 * Creates an action spec for a consumer-control key press event (media playback, volume, and display brightness keys).
 *
 * Use when mapping triggers to media controls (`"volume_increment"`, `"play_or_pause"`, `"display_brightness_increment"`) in Karabiner's `to.consumer_key_code` namespace.
 *
 * @param keyName - Consumer key code name (e.g. `"volume_increment"`, `"mute"`, `"play_or_pause"`) or raw usage integer.
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift"]`, `VM.COCS`) OR a {@link KeyOptions} configuration object.
 * @param options - Additional {@link KeyOptions} configuration when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for documentation and logs.
 * @returns An {@link ActionSpec} of type `"consumerKey"`.
 *
 * @example
 * ```ts
 * consumerKey("volume_increment")
 * consumerKey("play_or_pause", { halt: true })
 * consumerKey("display_brightness_increment", ["shift"], { repeat: true })
 * ```
 */
export function consumerKey(
  keyName: ConsumerKeyCode | number,
  modifiersOrOptions?: ActionKeyModifier[] | KeyOptions,
  options?: KeyOptions,
  actionDesc?: string,
): ActionSpec {
  let modifiers: ActionKeyModifier[] | undefined;
  let opts: KeyOptions | undefined;
  if (Array.isArray(modifiersOrOptions)) {
    modifiers = modifiersOrOptions.map((m) => resolveKeyAlias(m as string)) as ActionKeyModifier[];
    opts = options;
  } else {
    opts = modifiersOrOptions;
    modifiers = undefined;
  }
  const finalOptions: KeyOptions = { ...opts, repeat: opts?.repeat ?? false };
  return {
    type: "consumerKey",
    key: keyName,
    ...(modifiers?.length ? { modifiers } : {}),
    options: finalOptions,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec for a keyboard key press event.
 *
 * Use when emitting standard keyboard key strokes with optional modifiers and event configuration flags.
 *
 * @param keyName - Target key code or alias (e.g. `"a"`, `"spacebar"`, `"left_command"`, `"escape"`, `"f12"`).
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift", "opt"]`, `VM.COCS`) OR a {@link KeyOptions} configuration object.
 * @param options - Additional {@link KeyOptions} configuration when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for documentation and logs.
 * @returns An {@link ActionSpec} of type `"key"`.
 *
 * @example
 * ```ts
 * key("c", ["cmd"])
 * key("spacebar", { repeat: false })
 * key("tab", ["cmd", "shift"], { lazy: true }, "Switch reverse tab")
 * ```
 */
export function key(
  keyName: KeyCode | ModKey,
  modifiersOrOptions?: ActionKeyModifier[] | KeyOptions,
  options?: KeyOptions,
  actionDesc?: string,
): ActionSpec {
  let modifiers: ActionKeyModifier[] | undefined;
  let opts: KeyOptions | undefined;

  if (Array.isArray(modifiersOrOptions)) {
    modifiers = modifiersOrOptions.map((m) => resolveKeyAlias(m as string)) as ActionKeyModifier[];
    opts = options;
  } else {
    opts = modifiersOrOptions;
    modifiers = undefined;
  }

  const finalOptions: KeyOptions = {
    ...opts,
    repeat: opts?.repeat ?? false,
  };

  return {
    type: "key",
    key: resolveKeyAlias(keyName),
    ...(modifiers?.length ? { modifiers } : {}),
    options: finalOptions,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to move the mouse pointer in cardinal directions while a key is held.
 *
 * Use when building keyboard-driven mouse navigation (e.g. Vim-style HJKL cursor movement).
 *
 * @param opts - Movement distance options in Karabiner mouse-key units (`left`, `right`, `up`, `down`, `speedMultiplier`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"mouseKey"`.
 *
 * @example
 * ```ts
 * mouseMove({ right: 1536 })
 * mouseMove({ up: 1536, speedMultiplier: 2 })
 * ```
 */
export function mouseMove(
  opts: { left?: number; right?: number; up?: number; down?: number; speedMultiplier?: number },
  actionDesc?: string,
): ActionSpec {
  const x = (opts.right ?? 0) - (opts.left ?? 0);
  const y = (opts.down ?? 0) - (opts.up ?? 0);
  const mouseKey: ToMouseKey = {
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    ...(opts.speedMultiplier !== undefined ? { speed_multiplier: opts.speedMultiplier } : {}),
  } as ToMouseKey;
  if (!Object.keys(mouseKey).length) {
    throw new Error("mouseMove: name at least one direction or a speedMultiplier");
  }
  return { type: "mouseKey", mouseKey, ...(actionDesc ? { actionDesc } : {}) };
}

/**
 * Creates an action spec to scroll the wheel in cardinal directions while a key is held.
 *
 * Use when building keyboard-driven scrolling (e.g. mapping modifier+arrow keys to mouse wheel scroll events).
 * Corrects Karabiner's inverted horizontal scroll axis automatically.
 *
 * @param opts - Scroll distance options (`up`, `down`, `left`, `right`, `speedMultiplier`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"mouseKey"`.
 *
 * @example
 * ```ts
 * mouseScroll({ down: 64 })
 * mouseScroll({ right: 32 })
 * ```
 */
export function mouseScroll(
  opts: { up?: number; down?: number; left?: number; right?: number; speedMultiplier?: number },
  actionDesc?: string,
): ActionSpec {
  const vertical_wheel = (opts.down ?? 0) - (opts.up ?? 0);
  // Inverted on purpose: positive horizontal_wheel scrolls left.
  const horizontal_wheel = (opts.left ?? 0) - (opts.right ?? 0);
  const mouseKey: ToMouseKey = {
    ...(vertical_wheel ? { vertical_wheel } : {}),
    ...(horizontal_wheel ? { horizontal_wheel } : {}),
    ...(opts.speedMultiplier !== undefined ? { speed_multiplier: opts.speedMultiplier } : {}),
  } as ToMouseKey;
  if (!Object.keys(mouseKey).length) {
    throw new Error("mouseScroll: name at least one direction or a speedMultiplier");
  }
  return { type: "mouseKey", mouseKey, ...(actionDesc ? { actionDesc } : {}) };
}

/**
 * Creates a raw Karabiner `to.mouse_key` action spec.
 *
 * Use when raw low-level mouse manipulation is required. For higher-level cardinal direction movement/scrolling, prefer {@link mouseMove} or {@link mouseScroll}.
 *
 * @param spec - Raw {@link ToMouseKey} parameters (`x`, `y`, `vertical_wheel`, `horizontal_wheel`, `speed_multiplier`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"mouseKey"`.
 *
 * @example
 * ```ts
 * mouseKey({ x: 100, speed_multiplier: 1.5 })
 * ```
 */
export function mouseKey(spec: ToMouseKey, actionDesc?: string): ActionSpec {
  return { type: "mouseKey", mouseKey: spec, ...(actionDesc ? { actionDesc } : {}) };
}

/**
 * Creates an action spec for a mouse button press event.
 *
 * Use when emitting mouse clicks (e.g. left click `"button1"`, right click `"button2"`, middle click `"button3"`, back/forward `"button4"`/`"button5"`).
 *
 * @param buttonName - Target mouse button name or alias (e.g. `"button1"`, `"button2"`, `"button4"`, `"left"`, `"right"`).
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift"]`) OR a {@link KeyOptions} configuration object.
 * @param options - Additional {@link KeyOptions} configuration (`repeat`, `halt`, `lazy`, `hold_down_milliseconds`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"button"`.
 *
 * @example
 * ```ts
 * button("button1")
 * button("button2", ["cmd"])
 * button("button4", ["cmd", "shift"], { halt: true })
 * ```
 */
export function button(
  buttonName: string,
  modifiersOrOptions?: ActionKeyModifier[] | KeyOptions,
  options?: KeyOptions,
  actionDesc?: string,
): ActionSpec {
  let modifiers: ActionKeyModifier[] | undefined;
  let opts: KeyOptions | undefined;

  if (Array.isArray(modifiersOrOptions)) {
    modifiers = modifiersOrOptions.map((m) => resolveKeyAlias(m as string)) as ActionKeyModifier[];
    opts = options;
  } else {
    opts = modifiersOrOptions;
    modifiers = undefined;
  }

  const finalOptions: KeyOptions = {
    ...opts,
    repeat: opts?.repeat ?? false,
  };

  return {
    type: "button",
    button: buttonName,
    ...(modifiers?.length ? { modifiers } : {}),
    options: finalOptions,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec referencing a pre-registered mapped key combination (from `COMBOS.*`).
 *
 * Use when triggering centralized shortcut definitions from {@link MapSpec} registries.
 *
 * @param ref - Target {@link MapSpec} reference (e.g. `COMBOS.focusWinRight`, `COMBOS.showPopclip`).
 * @param options - Optional {@link KeyOptions} configuration (`repeat`, `halt`, `lazy`, `hold_down_milliseconds`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"map"`.
 *
 * @example
 * ```ts
 * map(COMBOS.focusWinRight)
 * map(COMBOS.showPopclip, { halt: true })
 * ```
 */
export function map(ref: MapSpec, options?: KeyOptions, actionDesc?: string): ActionSpec {
  return {
    type: "map",
    ref,
    options: {
      ...options,
      repeat: options?.repeat ?? false,
    },
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an in-place context action spec for active window operations.
 *
 * Use when invoking context-sensitive actions handled by external integrations.
 *
 * @param action - Action identifier string (e.g. `"kitty"`, `"qspace"`, `"copy"`).
 * @returns An {@link ActionSpec} of type `"actHere"`.
 *
 * @example
 * ```ts
 * actHere("kitty")
 * actHere("qspace")
 * ```
 */
export function actHere(action: string): ActionSpec {
  return { type: "actHere", action };
}

/**
 * Creates an action spec to navigate through recently focused application history.
 *
 * Use when implementing MRU (Most Recently Used) application switching shortcuts.
 *
 * @param index - Delta index in the app history stack (`1` for previously active app, `2` for 2nd previous app).
 * @param exclude - Optional {@link AppHistoryExclude} or {@link AppHistoryOptions} specifying bundle IDs or file paths to ignore.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"appHistory"`.
 *
 * @example
 * ```ts
 * appHistory(1)
 * appHistory(1, [APPS.safari, APPS.preview])
 * ```
 */
export function appHistory(
  index: number,
  exclude?: AppHistoryExclude | AppHistoryOptions,
  actionDesc?: string,
): ActionSpec {
  if (exclude === undefined) {
    return { type: "appHistory", index };
  }

  let finalExclude: AppHistoryExclude | undefined;
  let finalDesc: string | undefined = actionDesc;

  if (
    typeof exclude === "object" &&
    !Array.isArray(exclude) &&
    exclude !== null &&
    (exclude as any).type === undefined &&
    !("bundleId" in exclude) &&
    !("path" in exclude) &&
    ("actionDesc" in exclude || "exclude" in exclude)
  ) {
    const opts = exclude as AppHistoryOptions;
    finalExclude = opts.exclude ?? {
      ...(opts.exclusionBundleIdentifiers ? { exclusionBundleIdentifiers: opts.exclusionBundleIdentifiers } : {}),
      ...(opts.exclusionFilePaths ? { exclusionFilePaths: opts.exclusionFilePaths } : {}),
      ...(opts.bundle_identifiers ? { bundle_identifiers: opts.bundle_identifiers } : {}),
      ...(opts.file_paths ? { file_paths: opts.file_paths } : {}),
    };
    if (Object.keys(finalExclude).length === 0 && !opts.exclude) {
      finalExclude = undefined;
    }
    finalDesc = opts.actionDesc ?? actionDesc;
  } else {
    finalExclude = exclude as AppHistoryExclude;
  }

  return {
    type: "appHistory",
    index,
    ...(finalExclude !== undefined ? { exclude: finalExclude } : {}),
    ...(finalDesc !== undefined ? { actionDesc: finalDesc } : {}),
  };
}

/**
 * Creates an action spec to open a folder path in Finder or configured file manager.
 *
 * Use when mapping shortcuts to open specific project or system directories.
 *
 * @param ref - Target {@link PathSpec} (e.g. `PATHS.downloads`) or directory path string.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"folder"`.
 *
 * @example
 * ```ts
 * folder(PATHS.downloads)
 * folder("~/Documents", "Open Documents folder")
 * ```
 */
export function folder(ref: PathSpec, actionDesc?: string): ActionSpec {
  return {
    type: "folder",
    ref,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec from a registered command reference (from `CMDS.*`).
 *
 * Use when executing pre-registered commands with automatic environment, quoting, and path resolution.
 *
 * @param ref - Target {@link CommandSpec} reference (e.g. `CMDS.neruHints`, `CMDS.wordPrint`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"command"`.
 *
 * @example
 * ```ts
 * cmd(CMDS.neruHints)
 * cmd(CMDS.wordPrint, "Print Word Document")
 * ```
 */
export function cmd(ref: CommandSpec, actionDesc?: string): ActionSpec {
  return {
    type: "command",
    ref,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to execute a raw shell command.
 *
 * Use when running command-line scripts, CLI tools, or macOS system commands (`to.shell_command`).
 *
 * @param command - Shell command string or {@link CommandSpec}.
 * @param actionDesc - Optional human-readable description for documentation and logs.
 * @returns An {@link ActionSpec} of type `"shell"`.
 *
 * @example
 * ```ts
 * shell("echo 'Hello World'")
 * shell("open -a Terminal .", "Open terminal in current dir")
 * shell(CMDS.recentFiles)
 * ```
 */
export function shell(command: string | CommandSpec, actionDesc?: string): ActionSpec {
  return {
    type: "shell",
    command,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to execute a Python script with optional virtual environment support.
 *
 * Use when running Python automation scripts with specific virtual environments (`venv`) and CLI arguments.
 *
 * @param scriptPath - File path to the target Python script.
 * @param options - Argument array (`["--verbose"]`) or configuration object containing `venv`, `args`, or `actionDesc`.
 * @param actionDesc - Optional human-readable description when `options` is passed as an argument array.
 * @returns An {@link ActionSpec} of type `"python"`.
 *
 * @example
 * ```ts
 * python("~/scripts/main.py", ["--verbose"])
 * python("~/scripts/main.py", { venv: "~/.venv", args: ["--arg"] }, "Run python script")
 * ```
 */
export function python(
  scriptPath: string,
  options?: { venv?: string; args?: string[]; actionDesc?: string } | string[],
  actionDesc?: string,
): ActionSpec {
  if (Array.isArray(options)) {
    return {
      type: "python",
      scriptPath,
      args: options,
      ...(actionDesc ? { actionDesc } : {}),
    };
  }
  return {
    type: "python",
    scriptPath,
    ...(options ?? {}),
  };
}

/**
 * Creates an action spec to execute an AppleScript or JavaScript for Automation (JOSA) script (`osascript`).
 *
 * Use when driving macOS system automation or application scripting dictionaries via AppleScript files.
 *
 * @param scriptPath - Path to the AppleScript/JOSA script file.
 * @param args - Optional positional command line arguments passed to the script.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"osascript"`.
 *
 * @example
 * ```ts
 * osascript("~/scripts/dialog.scpt", ["Hello"])
 * ```
 */
export function osascript(scriptPath: string, args?: string[], actionDesc?: string): ActionSpec {
  return {
    type: "osascript",
    scriptPath,
    ...(args?.length ? { args } : {}),
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates a no-op (no-operation) action spec that swallows the trigger event without emitting output.
 *
 * Use when disabling default key behaviors, muting unwanted hardware buttons, or consuming keys inside a sublayer.
 *
 * @returns An {@link ActionSpec} of type `"noop"`.
 *
 * @example
 * ```ts
 * press(noop())
 * ```
 */
export function noop(): ActionSpec {
  return { type: "noop" };
}

/**
 * Creates an action spec to toggle a modifier key into a sticky state (`to.sticky_modifier`).
 *
 * Use when implementing sticky modifiers that stay active until pressed again or cleared (e.g. one-handed modifier access).
 *
 * @param flag - Sticky modifier name (e.g. `"left_shift"`, `"left_command"`, `"fn"`).
 * @param toggle - Sticky action state (`"on"`, `"off"`, or `"toggle"`, defaults to `"toggle"`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"sticky"`.
 *
 * @example
 * ```ts
 * sticky("left_shift")
 * sticky("fn", "off")
 * ```
 */
export function sticky(
  flag: StickyModifierName,
  toggle: "on" | "off" | "toggle" = "toggle",
  actionDesc?: string,
): ActionSpec {
  return {
    type: "sticky",
    flag,
    toggle,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to put macOS immediately to sleep (`software_function.iokit_power_management_sleep_system`).
 *
 * Use when creating a dedicated instant system sleep hotkey.
 *
 * @param delayMilliseconds - Optional delay in ms before sleeping (Karabiner native default is 500ms).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"sleepSystem"`.
 *
 * @example
 * ```ts
 * sleepSystem()
 * sleepSystem(2000, "Sleep after a 2s delay")
 * ```
 */
export function sleepSystem(delayMilliseconds?: number, actionDesc?: string): ActionSpec {
  return {
    type: "sleepSystem",
    ...(delayMilliseconds !== undefined ? { delayMilliseconds } : {}),
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec to set or toggle a Karabiner internal state variable.
 *
 * Use when toggling modal layers, activating submodes, or tracking multi-tap state flags in Karabiner's variable registry.
 *
 * @param varSpec - Target {@link VarSpec} variable (e.g. `VARS.rButtonDown`, `VARS.myMode`).
 * @param value - Value to assign (`number`, `string`, or `boolean`, defaults to `1`).
 * @param toggle - If true, toggles the variable between `0` and `1`.
 * @returns An {@link ActionSpec} of type `"setVar"`.
 *
 * @example
 * ```ts
 * setVar(VARS.rButtonDown, 1)
 * setVar(VARS.myMode, 1, true)
 * ```
 */
export function setVar(varSpec: VarSpec, value: number | string | boolean = 1, toggle = false): ActionSpec {
  return {
    type: "setVar",
    var: varSpec,
    value,
    ...(toggle ? { toggle } : {}),
  };
}

/**
 * Creates a clipboard cut action spec (⌘+X).
 *
 * Use as a shorthand action for cutting selected text to the macOS clipboard.
 *
 * @returns An {@link ActionSpec} of type `"cut"`.
 *
 * @example
 * ```ts
 * cut()
 * ```
 */
export function cut(): ActionSpec {
  return { type: "cut" };
}

/**
 * Creates an action spec to move the mouse cursor to an absolute or window-relative screen position (`software_function.set_mouse_cursor_position`).
 *
 * Use when positioning the mouse cursor at specific coordinates or centering it within the active window.
 *
 * @param x - Horizontal coordinate points (`100`) or percentage string (`"50%"`).
 * @param y - Vertical coordinate points (`100`) or percentage string (`"50%"`).
 * @param opts - Optional screen index and relative positioning settings (`screen`, `relativeTo`, `fallbackTo`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"cursorTo"`.
 *
 * @example
 * ```ts
 * cursorTo(100, 100)
 * cursorTo("50%", "50%", { relativeTo: "focused_window" })
 * ```
 */
export function cursorTo(
  x: number | string,
  y: number | string,
  opts?: {
    screen?: number;
    relativeTo?: "screen" | "focused_window";
    fallbackTo?: "none" | "screen";
  },
  actionDesc?: string,
): ActionSpec {
  return {
    type: "cursorTo",
    x,
    y,
    ...opts,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates an action spec that simulates an OS-level mouse double-click (`software_function.cg_event_double_click`).
 *
 * Use when triggering double-clicks directly via CoreGraphics events. Note: For fast responsive clicks, prefer `sequence(button("button1"), button("button1"))`.
 *
 * @param button - CGMouseButton index: `0` left (default), `1` right, `2` middle.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type `"doubleClick"`.
 *
 * @example
 * ```ts
 * doubleClick()
 * doubleClick(1, "Double right-click")
 * ```
 */
export function doubleClick(button = 0, actionDesc?: string): ActionSpec {
  return {
    type: "doubleClick",
    button,
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates a clipboard copy action spec (⌘+C).
 *
 * Use as a shorthand action for copying selected text to the macOS clipboard.
 *
 * @returns An {@link ActionSpec} of type `"copy"`.
 *
 * @example
 * ```ts
 * copy()
 * ```
 */
export function copy(): ActionSpec {
  return { type: "copy" };
}

/**
 * Creates a clipboard paste action spec (⌘+V).
 *
 * Use as a shorthand action for pasting clipboard content.
 *
 * @returns An {@link ActionSpec} of type `"paste"`.
 *
 * @example
 * ```ts
 * paste()
 * ```
 */
export function paste(): ActionSpec {
  return { type: "paste" };
}

/**
 * Creates an action spec that executes multiple action specs sequentially in exact order.
 *
 * Use when composing compound macros (e.g. copying text, switching apps, and pasting).
 *
 * @param actions - Sequence of {@link ActionSpec} objects to execute.
 * @returns An {@link ActionSpec} of type `"sequence"`.
 *
 * @example
 * ```ts
 * sequence(copy(), app(APPS.notes), paste())
 * ```
 */
export function sequence(...actions: ActionSpec[]): ActionSpec {
  return { type: "sequence", actions };
}
