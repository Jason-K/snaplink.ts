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

/**
 * Anything `press()`/`release()`/`hold()`/`tap()`/`doubleTap()`/`guard()` accept
 * as an action: a built {@link Action} (an `ActionSpec` or a raw `ToEvent`), or
 * a raw registry primitive (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) that gets
 * promoted to its corresponding `ActionSpec` automatically. `PathSpec` is
 * deliberately excluded — it is ambiguous between "open in Finder" (`folder()`)
 * and an `AppTarget` for `app()`, and nothing in this codebase disambiguates
 * that today, so it stays wrapper-explicit.
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
 * Fluent builder for `Case` items in Karabiner bindings.
 * Implements `Case` directly so instances can be placed into `cases: [...]` arrays.
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
   * Constructs a new `CaseBuilder` instance.
   *
   * @param phase - Key lifecycle phase ("press", "release", or "hold").
   * @param actions - Action or list of actions to execute.
   * @param conditions - Optional condition or list of conditions required for this case.
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
   * Add one or more conditions to this case.
   *
   * Accepts already-built `Condition`s (and arrays of them, as before) or
   * bare state specs — registry keys, apps, devices, vars, `[target, value]`
   * tuples, or `{ app/var, ... }` objects — resolved through the same
   * machinery as `state()`, so `.when(APPS.word)` and
   * `.when(condApp(APPS.word))` attach an identical condition.
   *
   * Recognized condition wrappers & builders:
   * - `state(...)` / `condState(...)` / `ifState(...)` — evaluates state specs, registry keys (`STATES`, `VARS`), apps, devices, or `[target, value]` tuples
   * - `unless(...)` / `condUnless(...)` — enforces state specs, registry keys, apps, or devices to be false/negated
   * - `ifApp(...)` / `condApp(...)` — matches frontmost application(s)
   * - `unlessApp(...)` / `condNotApp(...)` — matches when application(s) are NOT frontmost
   * - `ifDevice(...)` / `condDevice(...)` — matches hardware device specifications
   * - `ifUserVar(...)` / `ifKeVar(...)` / `condVar(...)` / `ifVar(...)` — matches Karabiner variable values
   * - `unlessUserVar(...)` / `unlessKeVar(...)` / `condNotVar(...)` — matches when variable values do NOT match
   *
   * @param items - Conditions, condition arrays, bare state specs, or state spec arrays to attach to this case.
   * @returns `this` for method chaining.
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
   * Set tap count requirement (e.g. 2 for double tap).
   *
   * @param count - Tap count threshold required to trigger this case.
   * @returns `this` for method chaining.
   *
   * @example
   * ```ts
   * press(key("space")).withTapCount(2)
   * ```
   */
  withTapCount(count: number): this {
    this.tapCount = count;
    return this;
  }

  /**
   * Mark action as delayed (multi-tap).
   *
   * @param isDelayed - Whether execution is delayed until multi-tap window expires.
   * @returns `this` for method chaining.
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
   * Enable double-tap guard protection on this case.
   *
   * @param isGuarded - Whether double-tap guard protection is enabled.
   * @returns `this` for method chaining.
   *
   * @example
   * ```ts
   * press(shell("rm -rf ~/temp")).guardProtection()
   * ```
   */
  guardProtection(isGuarded = true): this {
    this.guard = isGuarded;
    return this;
  }

  /**
   * Set optional action fragment description.
   *
   * @param text - Human-readable description text for the case.
   * @returns `this` for method chaining.
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
   * Suppress trigger fallback (emit only explicit `do`).
   *
   * @param suppress - Whether to suppress trigger fallback.
   * @returns `this` for method chaining.
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
 * Creates a case for key press phase.
 *
 * Recognized action builders:
 * - `key()` — key press action with optional modifiers and options (`repeat`, `halt`, `lazy`)
 * - `button()` — mouse button press action
 * - `app()` — launch or focus application
 * - `url()` — open URL in browser (supports background)
 * - `folder()` — open file directory
 * - `cmd()` — run registered command spec
 * - `shell()` — run shell command
 * - `python()` — execute python script with virtual environment support
 * - `osascript()` — run AppleScript/JOSA script
 * - `setVar()` — set or toggle Karabiner variable
 * - `cut()` / `copy()` / `paste()` — clipboard shortcut actions
 * - `sequence()` — run multiple action specs sequentially
 * - `map()` — trigger mapped combo spec
 * - `noop()` — no-op (swallows trigger without emitting output)
 * - `actHere()` — in-place context action spec
 * - `appHistory()` — navigate app history stack
 *
 * Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) can be passed
 * directly too — `press(COMBOS.x)` is `press(map(COMBOS.x))`. `PathSpec`
 * (`PATHS.*`) is not inferred; use `folder()` explicitly.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on press.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * press(key("a"))
 * press([key("c", ["cmd"])], { app: "com.apple.finder" })
 * press(COMBOS.showPopclip)
 * ```
 */
export function press(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return new CaseBuilder("press", actions, conditions);
}

/**
 * Creates a case for key release phase.
 *
 * Recognized action builders:
 * - `key()` — key press action with optional modifiers and options (`repeat`, `halt`, `lazy`)
 * - `button()` — mouse button press action
 * - `app()` — launch or focus application
 * - `url()` — open URL in browser (supports background)
 * - `folder()` — open file directory
 * - `cmd()` — run registered command spec
 * - `shell()` — run shell command
 * - `python()` — execute python script with virtual environment support
 * - `osascript()` — run AppleScript/JOSA script
 * - `setVar()` — set or toggle Karabiner variable
 * - `cut()` / `copy()` / `paste()` — clipboard shortcut actions
 * - `sequence()` — run multiple action specs sequentially
 * - `map()` — trigger mapped combo spec
 * - `noop()` — no-op (swallows trigger without emitting output)
 * - `actHere()` — in-place context action spec
 * - `appHistory()` — navigate app history stack
 *
 * Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) can be passed
 * directly too — `release(COMBOS.x)` is `release(map(COMBOS.x))`. `PathSpec`
 * (`PATHS.*`) is not inferred; use `folder()` explicitly.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on release.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
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
 * Alias for `release()`. Creates a case for key tap (release).
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 * - Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly —
 *   promoted the same way as in `press()`/`release()`.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * tap(key("space"))
 * ```
 */
export function tap(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return release(actions, conditions);
}

/**
 * Creates a case for key hold phase.
 *
 * Recognized action builders:
 * - `key()` — key press action with optional modifiers and options (`repeat`, `halt`, `lazy`)
 * - `button()` — mouse button press action
 * - `app()` — launch or focus application
 * - `url()` — open URL in browser (supports background)
 * - `folder()` — open file directory
 * - `cmd()` — run registered command spec
 * - `shell()` — run shell command
 * - `python()` — execute python script with virtual environment support
 * - `osascript()` — run AppleScript/JOSA script
 * - `setVar()` — set or toggle Karabiner variable
 * - `cut()` / `copy()` / `paste()` — clipboard shortcut actions
 * - `sequence()` — run multiple action specs sequentially
 * - `map()` — trigger mapped combo spec
 * - `noop()` — no-op (swallows trigger without emitting output)
 * - `actHere()` — in-place context action spec
 * - `appHistory()` — navigate app history stack
 *
 * Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) can be passed
 * directly too — `hold(COMBOS.x)` is `hold(map(COMBOS.x))`. `PathSpec`
 * (`PATHS.*`) is not inferred; use `folder()` explicitly.
 *
 * @param actions - Action, registry primitive, or list of either, to execute when held down.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
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
 * Creates a double-tap press case.
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 * - Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly —
 *   promoted the same way as in `press()`/`release()`.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on double tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with tap count 2.
 *
 * @example
 * ```ts
 * doubleTap(app("Terminal"))
 * ```
 */
export function doubleTap(actions: ActionInput | ActionInput[], conditions?: Condition | Condition[]): CaseBuilder {
  return press(actions, conditions).withTapCount(2);
}

/**
 * Shorthand for the tap/hold pair that runs through this codebase's bindings
 * far more often than any other shape: a `release()` case for the plain tap
 * and a `hold()` case for the held key, both under the same optional
 * conditions.
 *
 * Named `tapAndHold` rather than `tapHold` to avoid colliding with the
 * lower-level manipulator builder of that name in
 * `engine/resolve-trigger/tap-hold.ts` (a different API: it builds a raw
 * tap-hold manipulator from `{key, alone, hold, ...}`, not a `Case[]`).
 *
 * `to(tapAndHold(a, b))` is exactly `to(release(a), hold(b))` — nothing new
 * is modeled, this only collapses the two-call boilerplate. For a case that
 * needs its own distinct conditions instead of sharing one set with its
 * counterpart, use `release(...).when(...)` / `hold(...).when(...)` directly.
 *
 * @param tapAction - Action, registry primitive, or list of either, to execute on tap (release phase).
 * @param holdAction - Action, registry primitive, or list of either, to execute when held.
 * @param conditions - Optional condition or list of conditions, applied to both cases.
 * @returns A 2-tuple `[release(tapAction), hold(holdAction)]`.
 *
 * @example
 * ```ts
 * // Before:
 * bind(from("leftBack"), to(release(shell(URLS.hsWinToggleFill)), hold(url(URLS.rectDisplayNext))))
 * // After:
 * bind(from("leftBack"), to(tapAndHold(URLS.hsWinToggleFill, URLS.rectDisplayNext)))
 * // Note: a bare CommandSpec auto-infers to cmd() (ActionSpec type
 * // "command"), not shell() (type "shell") — a different variant. For a
 * // CommandSpec (not a raw string), both handlers resolve to the same
 * // to_shell_command, so this is safe either way; the only observable
 * // difference is the compiled description ("Run command 'X'" vs
 * // "Run 'X'"). Prefer bare unless that description text matters to you.
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
 * Creates a double-tap hold case.
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 * - Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly —
 *   promoted the same way as in `press()`/`release()`.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on double tap and hold.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with hold phase and tap count 2.
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
 * Creates a delayed single tap case (useful in multi-tap configurations).
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 * - Registry primitives (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) directly —
 *   promoted the same way as in `press()`/`release()`.
 *
 * @param actions - Action, registry primitive, or list of either, to execute on delayed single tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with release phase and delayed true.
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
 * Creates a guarded press case requiring double-tap confirmation.
 * If actions are omitted, automatically defaults to emitting the trigger event.
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 *
 * @param actionsOrConditions - Optional action(s) to execute under guard protection, or condition(s) if actions are omitted.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` with double-tap guard protection enabled.
 *
 * @example
 * ```ts
 * guard() // Emits the trigger event on confirmation
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
 * Container wrapping one or more `Case` objects created by {@link to}.
 */
export type ToWrapper = {
  kind: "to";
  cases: Case[];
};

/**
 * Wraps one or more cases or case arrays into a `ToWrapper` container.
 *
 * Recognized case wrappers:
 * - `press(actions)` — executes on key press phase
 * - `release(actions)` / `tap(actions)` — executes on key release phase
 * - `hold(actions)` — executes on key hold phase
 * - `doubleTap(actions)` — requires double tap to trigger
 * - `doubleTapHold(actions)` — requires double tap and hold to trigger
 * - `delayedSingleTap(actions)` — delayed single tap execution for multi-tap
 * - `guard(actions)` — guarded execution requiring double-tap confirmation
 *
 * Recognized action builders (passed into case wrappers):
 * - `key()` — key press action with optional modifiers and options (`repeat`, `halt`, `lazy`)
 * - `button()` — mouse button press action
 * - `app()` — launch or focus application
 * - `url()` — open URL in browser (supports background)
 * - `folder()` — open file directory
 * - `cmd()` — run registered command spec
 * - `shell()` — run shell command
 * - `python()` — execute python script with virtual environment support
 * - `osascript()` — run AppleScript/JOSA script
 * - `setVar()` — set or toggle Karabiner variable
 * - `cut()` / `copy()` / `paste()` — clipboard shortcut actions
 * - `sequence()` — run multiple action specs sequentially
 * - `map()` — trigger mapped combo spec
 * - `noop()` — no-op (swallows trigger without emitting output)
 * - `actHere()` — in-place context action spec
 * - `appHistory()` — navigate app history stack
 *
 * @param cases - Cases, case arrays, or `CaseBuilder` instances to include.
 * @returns A `ToWrapper` container holding all flattened cases.
 *
 * @example
 * ```ts
 * to(press(key("a", ["cmd"])))
 * to(press(app("com.apple.finder")), release(key("b")))
 * to(press(noop()))
 * ```
 */
export function to(...cases: (Case | Case[])[]): ToWrapper {
  return {
    kind: "to",
    cases: cases.flat(),
  };
}

/**
 * Creates an action spec to open or switch to an application.
 *
 * @param ref - Target application spec, bundle identifier, or name.
 * @param mode - Optional launch mode ("open" using macOS `open` or "shell" execution).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "app".
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
 * Creates an action spec to open a URL in the browser.
 *
 * `background` resolves via 3-tier precedence, highest first:
 * 1. This call's own `background` argument, when explicitly passed.
 * 2. `ref.background`, when `ref` is a `UrlSpec` that sets it (see registry
 *    factories in `data/registries/urls.ts` — non-Hammerspoon categories pin
 *    `false` there to preserve foreground `open -u` behavior).
 * 3. `true` (background, `open -g`) — the safe default when neither the call
 *    site nor the registry entry specifies a preference.
 *
 * The resolved value is always written onto the returned `ActionSpec`
 * (never conditionally omitted), so `action-handlers.ts`'s `url` handler
 * never needs to apply its own fallback.
 *
 * @param ref - URL string or `UrlSpec` reference.
 * @param background - Whether to open URL in background without bringing application to focus.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "url".
 *
 * @example
 * ```ts
 * url("https://github.com")               // background: true (default fallback)
 * url(URLS.rectDisplayNext)                // background: false (registry pins foreground)
 * url(URLS.rectDisplayNext, false)         // explicit override, same result here
 * url(URL_ID.docs, true, "Open documentation in background")
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
 * Configuration options for key and mouse press actions.
 *
 * Re-exported from the action vocabulary so the wrapper layer and the spec it
 * produces cannot drift apart.
 */
/**
 * Configuration options for key, consumer key, and mouse button output events.
 *
 * Re-exported from {@link ActionEventOptions}.
 *
 * ### Available Options:
 * - `repeat` (`boolean`): Whether the key repeats while held down. (Default `false` in Snaplink; Karabiner native default is `true`). Set `false` on the last event of a sequence to prevent stuck repeating keys.
 * - `halt` (`boolean`): In `to_if_alone` or `to_if_held_down`, cancels subsequent `to_after_key_up` and `to_delayed_action` channels when this action fires.
 * - `lazy` (`boolean`): Suppresses the modifier key's events until another non-modifier key is pressed with it.
 * - `hold_down_milliseconds` (`number`): Gap in ms between key_down and key_up when sent together. `caps_lock` tap events need ~200ms to register.
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
 * Creates an action spec for a consumer-control key press event — media,
 * volume, and brightness keys (`to.consumer_key_code`), a namespace distinct
 * from `to.key_code` and not covered by {@link key}'s alias table.
 *
 * @param keyName - Consumer key code name (e.g. `"volume_increment"`, `"mute"`, `"play_or_pause"`) or a raw usage integer.
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift", "opt"]`, `VM.COCS`) OR a {@link KeyOptions} configuration object (`{ repeat?: boolean, halt?: boolean, lazy?: boolean, hold_down_milliseconds?: number }`).
 * @param options - Additional {@link KeyOptions} configuration (`{ repeat?, halt?, lazy?, hold_down_milliseconds? }`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for documentation/logs.
 * @returns An {@link ActionSpec} of type "consumerKey".
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
 * Creates an action spec for a key press event.
 *
 * @param keyName - Target key code or alias (e.g. `"a"`, `"spacebar"`, `"left_command"`, `"escape"`, `"f12"`).
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift", "opt"]`, `VM.COCS`) OR a {@link KeyOptions} configuration object (`{ repeat?: boolean, halt?: boolean, lazy?: boolean, hold_down_milliseconds?: number }`).
 * @param options - Additional {@link KeyOptions} configuration (`{ repeat?, halt?, lazy?, hold_down_milliseconds? }`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for documentation/logs.
 * @returns An {@link ActionSpec} of type "key".
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
 * Move the pointer while the key is held, in directions rather than signs.
 *
 * Values are Karabiner mouse-key units, not pixels, and the actual speed also
 * depends on System Settings > Mouse (gotcha 6.10).
 *
 * @param opts - Movement distances in Karabiner units (`left`, `right`, `up`, `down`, `speedMultiplier`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "mouseKey".
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
 * Scroll while the key is held, in directions rather than signs.
 *
 * The sign conventions are the trap this wrapper exists to remove:
 * `vertical_wheel > 0` scrolls **down** but `horizontal_wheel > 0` scrolls
 * **left** — the horizontal axis is inverted relative to the vertical one
 * (gotcha 6.10). Scroll direction also follows System Settings > Mouse.
 *
 * @param opts - Scroll distances (`up`, `down`, `left`, `right`, `speedMultiplier`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "mouseKey".
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

/** Raw `to.mouse_key`. Prefer {@link mouseMove} / {@link mouseScroll}. */
export function mouseKey(spec: ToMouseKey, actionDesc?: string): ActionSpec {
  return { type: "mouseKey", mouseKey: spec, ...(actionDesc ? { actionDesc } : {}) };
}

/**
 * Creates an action spec for a mouse button press event.
 *
 * @param buttonName - Target mouse button name or alias (e.g. `"button1"`, `"button2"`, `"button4"`, `"left"`, `"right"`).
 * @param modifiersOrOptions - Optional array of modifier keys (`["cmd"]`, `["shift"]`) OR a {@link KeyOptions} configuration object.
 * @param options - Additional {@link KeyOptions} (`repeat`, `halt`, `lazy`, `hold_down_milliseconds`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "button".
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
 * Creates an action spec for a map reference.
 *
 * @param ref - `MapSpec` target reference (e.g. `COMBOS.focusWinRight`, `COMBOS.showPopclip`).
 * @param options - Optional {@link KeyOptions} (`repeat`, `halt`, `lazy`, `hold_down_milliseconds`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "map".
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
 * Creates an in-place context action spec.
 *
 * @param action - Action identifier string (e.g. `"kitty"`, `"qspace"`, `"copy"`).
 * @returns An {@link ActionSpec} of type "actHere".
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
 * Creates an action spec to navigate application history.
 *
 * @param index - Delta index in the app history stack (1 = previous app, 2 = 2nd previous app).
 * @param exclude - Optional {@link AppHistoryExclude} or {@link AppHistoryOptions} specifying bundle IDs or file paths to exclude.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "appHistory".
 *
 * @example
 * ```ts
 * appHistory(1)
 * appHistory(1, ["^com\\.apple\\.Safari$", "^com\\.apple\\.Preview$"])
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
 * Creates an action spec to open a folder path in Finder or replacement file manager.
 *
 * @param ref - {@link PathSpec} (e.g. `PATHS.downloads`) or directory path string.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "folder".
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
 * Creates an action spec from a registered command reference.
 *
 * @param ref - {@link CommandSpec} reference (e.g. `CMDS.neruHints`, `CMDS.wordPrint`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "command".
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
 * Creates an action spec to run a shell command.
 *
 * @param command - Shell command string or {@link CommandSpec}.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "shell".
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
 * Creates an action spec to execute a Python script.
 *
 * @param scriptPath - File path to the Python script.
 * @param options - Argument array (`["--verbose"]`) or configuration object containing `venv` (virtualenv path), `args` (cli arguments), or `actionDesc`.
 * @param actionDesc - Optional human-readable description when `options` is passed as an argument array.
 * @returns An {@link ActionSpec} of type "python".
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
 * Creates an action spec to execute an AppleScript or JOSA script (`osascript`).
 *
 * @param scriptPath - Path to the script file.
 * @param args - Optional positional command line arguments.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "osascript".
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
 * Creates a no-op (no operation) action spec. Swallows the trigger without emitting output.
 *
 * @returns An {@link ActionSpec} of type "noop".
 *
 * @example
 * ```ts
 * noop()
 * ```
 */
export function noop(): ActionSpec {
  return { type: "noop" };
}

/**
 * Creates an action spec that toggles a modifier key sticky — it stays "held"
 * until pressed again or cleared, rather than releasing with the key event
 * (`to.sticky_modifier`). Karabiner does not accept booleans here (6.9); use
 * `"on"` / `"off"` / `"toggle"`.
 *
 * @param flag - Which modifier goes sticky (e.g. `"left_shift"`, `"left_command"`, `"fn"`).
 * @param toggle - `"on"`, `"off"`, or `"toggle"` (default).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "sticky".
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
 * Creates an action spec that puts the Mac to sleep
 * (`software_function.iokit_power_management_sleep_system`).
 *
 * @param delayMilliseconds - Delay before sleeping. Karabiner defaults to 500ms.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "sleepSystem".
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
 * Creates an action spec to set or toggle a Karabiner variable.
 *
 * @param varSpec - Variable specification target (e.g. `VARS.rButtonDown`, `VARS.myMode`).
 * @param value - Value to set for the variable (defaults to 1). Strict types (`1 != true`).
 * @param toggle - If true, toggles variable between 0 and 1.
 * @returns An {@link ActionSpec} of type "setVar".
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
 * @returns An {@link ActionSpec} of type "cut".
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
 * Creates an action spec that moves the mouse cursor to an absolute or
 * screen-relative position (`software_function.set_mouse_cursor_position`).
 *
 * @param x - Points (`100`) or percent (`"50%"`).
 * @param y - Points (`100`) or percent (`"50%"`).
 * @param opts - Screen index and relative-positioning options (`screen`, `relativeTo`, `fallbackTo`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "cursorTo".
 *
 * @example
 * ```ts
 * cursorTo(100, 100)
 * cursorTo("50%", "50%", { screen: 1 })
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
 * Creates an action spec that simulates a mouse double-click via the OS event
 * system (`software_function.cg_event_double_click`) rather than two hardware
 * clicks. Laggier than `sequence([button(...), button(...)])` and needs
 * Accessibility permission for `karabiner_console_user_server` — prefer two
 * real clicks unless this is specifically required.
 *
 * @param button - CGMouseButton: 0 left (default), 1 right, 2 middle, 3+ other.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An {@link ActionSpec} of type "doubleClick".
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
 * @returns An {@link ActionSpec} of type "copy".
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
 * @returns An {@link ActionSpec} of type "paste".
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
 * Creates an action spec that executes multiple action specs in sequential order.
 *
 * @param actions - Sequence of action specs to run.
 * @returns An `ActionSpec` of type "sequence".
 *
 * @example
 * ```ts
 * sequence(copy(), app("Notes"), paste())
 * ```
 */
export function sequence(...actions: ActionSpec[]): ActionSpec {
  return { type: "sequence", actions };
}
