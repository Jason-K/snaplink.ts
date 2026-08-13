import type {
  Action,
  ActionEventOptions,
  ActionKeyModifier,
  ActionSpec,
  AppTarget,
  Case,
  CommandSpec,
  Condition,
  KeyCode,
  MapSpec,
  PathSpec,
  Phase,
  UrlSpec,
  VarSpec,
} from "../../data";
import type { ToMouseKey } from "../../types/karabiner";
import { resolveKeyAlias } from "../utils";

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
  constructor(
    phase: Phase,
    actions: Action | Action[],
    conditions?: Condition | Condition[],
  ) {
    this.phase = phase;
    this.do = Array.isArray(actions) ? actions : [actions];
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
   * Recognized condition wrappers & builders:
   * - `state(...)` / `condState(...)` / `ifState(...)` — evaluates state specs, registry keys (`STATES`, `VARS`), apps, devices, or `[target, value]` tuples
   * - `unless(...)` / `condUnless(...)` — enforces state specs, registry keys, apps, or devices to be false/negated
   * - `ifApp(...)` / `condApp(...)` — matches frontmost application(s)
   * - `unlessApp(...)` / `condNotApp(...)` — matches when application(s) are NOT frontmost
   * - `ifDevice(...)` / `condDevice(...)` — matches hardware device specifications
   * - `ifUserVar(...)` / `ifKeVar(...)` / `condVar(...)` / `ifVar(...)` — matches Karabiner variable values
   * - `unlessUserVar(...)` / `unlessKeVar(...)` / `condNotVar(...)` — matches when variable values do NOT match
   *
   * @param conditions - Conditions or condition arrays to attach to this case.
   * @returns `this` for method chaining.
   *
   * @example
   * ```ts
   * press(key("a")).when(ifApp("com.apple.finder"))
   * press(key("b")).when(state(VARS.rButtonDown))
   * ```
   */
  when(...conditions: (Condition | Condition[])[]): this {
    const flat = conditions.flat();
    if (flat.length > 0) {
      this.conditions = this.conditions ? [...this.conditions, ...flat] : flat;
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
 * @param actions - Action or list of actions to execute on press.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * press(key("a"))
 * press([key("c", ["cmd"])], { app: "com.apple.finder" })
 * ```
 */
export function press(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
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
 * @param actions - Action or list of actions to execute on release.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * release(key("b"))
 * ```
 */
export function release(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  return new CaseBuilder("release", actions, conditions);
}

/**
 * Alias for `release()`. Creates a case for key tap (release).
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 *
 * @param actions - Action or list of actions to execute on tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * tap(key("space"))
 * ```
 */
export function tap(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
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
 * @param actions - Action or list of actions to execute when held down.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` for chaining options.
 *
 * @example
 * ```ts
 * hold(key("left_shift"))
 * ```
 */
export function hold(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  return new CaseBuilder("hold", actions, conditions);
}

/**
 * Creates a double-tap press case.
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 *
 * @param actions - Action or list of actions to execute on double tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with tap count 2.
 *
 * @example
 * ```ts
 * doubleTap(app("Terminal"))
 * ```
 */
export function doubleTap(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  return press(actions, conditions).withTapCount(2);
}

/**
 * Creates a double-tap hold case.
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 *
 * @param actions - Action or list of actions to execute on double tap and hold.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with hold phase and tap count 2.
 *
 * @example
 * ```ts
 * doubleTapHold(key("tab", ["cmd"]))
 * ```
 */
export function doubleTapHold(
  actions: Action | Action[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  return hold(actions, conditions).withTapCount(2);
}

/**
 * Creates a delayed single tap case (useful in multi-tap configurations).
 *
 * Recognized action builders:
 * - `key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`,
 *   `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`,
 *   `map()`, `noop()`, `actHere()`, `appHistory()`
 *
 * @param actions - Action or list of actions to execute on delayed single tap.
 * @param conditions - Optional condition or list of conditions.
 * @returns A `CaseBuilder` initialized with release phase and delayed true.
 *
 * @example
 * ```ts
 * delayedSingleTap(key("escape"))
 * ```
 */
export function delayedSingleTap(
  actions: Action | Action[],
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
    (typeof obj.type === "string" &&
      (obj.type.endsWith("_if") || obj.type.endsWith("_unless")))
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
  actionsOrConditions?: Action | Action[] | Condition | Condition[],
  conditions?: Condition | Condition[],
): CaseBuilder {
  if (isConditionLike(actionsOrConditions)) {
    return press([], actionsOrConditions as Condition | Condition[]).guardProtection(true);
  }
  return press((actionsOrConditions as Action | Action[]) ?? [], conditions).guardProtection(true);
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
export function app(
  ref: AppTarget,
  mode?: "open" | "shell",
  actionDesc?: string,
): ActionSpec {
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
 * @param url - URL string or `UrlSpec` reference.
 * @param background - Whether to open URL in background without bringing application to focus.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "url".
 *
 * @example
 * ```ts
 * url("https://github.com")
 * url(URL_ID.docs, true, "Open documentation in background")
 * ```
 */
export function url(
  ref: UrlSpec | string,
  background?: boolean,
  actionDesc?: string,
): ActionSpec {
  return {
    type: "url",
    url: ref,
    ...(background !== undefined ? { background } : {}),
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Configuration options for key and mouse press actions.
 *
 * Re-exported from the action vocabulary so the wrapper layer and the spec it
 * produces cannot drift apart.
 */
export type KeyOptions = ActionEventOptions;


/**
 * Creates an action spec for a key press event.
 *
 * @param keyName - Target key code or alias (e.g. "a", "spacebar", "left_command").
 * @param modifiersOrOptions - Optional array of modifier keys or a `KeyOptions` configuration.
 * @param options - Key options (`repeat`, `halt`, `lazy`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "key".
 *
 * @example
 * ```ts
 * key("c", ["cmd"])
 * key("spacebar", { repeat: false })
 * key("tab", ["cmd", "shift"], { lazy: true }, "Switch reverse tab")
 * ```
 */
export function key(
  keyName: KeyCode,
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
 * @param buttonName - Target mouse button name or alias (e.g. "button1", "button2").
 * @param modifiersOrOptions - Optional array of modifier keys or a `KeyOptions` configuration.
 * @param options - Key options (`repeat`, `halt`, `lazy`) when modifiers are provided as 2nd parameter.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "button".
 *
 * @example
 * ```ts
 * button("button1")
 * button("button2", ["cmd"])
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
 * @param ref - `MapSpec` target reference.
 * @param options - Optional key options (`repeat`, `halt`, `lazy`).
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "map".
 *
 * @example
 * ```ts
 * map(MAP_ID.navigation, { repeat: true })
 * ```
 */
export function map(
  ref: MapSpec,
  options?: KeyOptions,
  actionDesc?: string,
): ActionSpec {
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
 * @param action - Action identifier string.
 * @returns An `ActionSpec` of type "actHere".
 *
 * @example
 * ```ts
 * actHere("toggle_sidebar")
 * ```
 */
export function actHere(action: string): ActionSpec {
  return { type: "actHere", action };
}

/**
 * Creates an action spec to navigate application history.
 *
 * @param index - Delta index in the app history stack.
 * @returns An `ActionSpec` of type "appHistory".
 *
 * @example
 * ```ts
 * appHistory(-1)
 * ```
 */
export function appHistory(index: number): ActionSpec {
  return { type: "appHistory", index };
}

/**
 * Creates an action spec to open a folder path.
 *
 * @param ref - `PathSpec` or directory path string.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "folder".
 *
 * @example
 * ```ts
 * folder(PATH_ID.downloads)
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
 * @param ref - `CommandSpec` reference.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "command".
 *
 * @example
 * ```ts
 * cmd(COMMAND_ID.raycastClipboard)
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
 * @param command - Shell command string or `CommandSpec`.
 * @param actionDesc - Optional human-readable description for the action.
 * @returns An `ActionSpec` of type "shell".
 *
 * @example
 * ```ts
 * shell("echo 'Hello World'")
 * shell("open -a Terminal .", "Open terminal in current dir")
 * ```
 */
export function shell(
  command: string | CommandSpec,
  actionDesc?: string,
): ActionSpec {
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
 * @param options - Argument array or configuration object containing `venv`, `args`, or `actionDesc`.
 * @param actionDesc - Optional human-readable description when `options` is passed as an argument array.
 * @returns An `ActionSpec` of type "python".
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
 * @returns An `ActionSpec` of type "osascript".
 *
 * @example
 * ```ts
 * osascript("~/scripts/dialog.scpt", ["Hello"])
 * ```
 */
export function osascript(
  scriptPath: string,
  args?: string[],
  actionDesc?: string,
): ActionSpec {
  return {
    type: "osascript",
    scriptPath,
    ...(args?.length ? { args } : {}),
    ...(actionDesc ? { actionDesc } : {}),
  };
}

/**
 * Creates a no-op (no operation) action spec.
 *
 * @returns An `ActionSpec` of type "noop".
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
 * Creates an action spec to set or toggle a Karabiner variable.
 *
 * @param varSpec - Variable specification target.
 * @param value - Value to set for the variable (defaults to 1).
 * @param toggle - If true, toggles variable between 0 and 1.
 * @returns An `ActionSpec` of type "setVar".
 *
 * @example
 * ```ts
 * setVar(VARS.rButtonDown, 1)
 * setVar(VAR_ID.leaderActive, 1, true)
 * ```
 */
export function setVar(
  varSpec: VarSpec,
  value: number | string | boolean = 1,
  toggle = false,
): ActionSpec {
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
 * @returns An `ActionSpec` of type "cut".
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
 * Creates a clipboard copy action spec (⌘+C).
 *
 * @returns An `ActionSpec` of type "copy".
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
 * @returns An `ActionSpec` of type "paste".
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

