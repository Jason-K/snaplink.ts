import type {
  Binding,
  Case,
  Condition,
  KeyCode,
  Phase,
  PointerButtonAlias,
  PointerMotionToScroll,
  PointerMotionTrigger,
  PointerTransform,
  TriggerKey,
  TriggerModifiers,
  VarSpec,
} from "../../data";
import { isTimingProfileName, TIMING_PROFILES, type TimingProfileName } from "../../data";
import type { AcceptUndefined } from "../../types/util";
import type { PointerAxis } from "../../types/karabiner";
import { when, type StateItem, type WhenWrapper } from "./condition-wrappers";
import { conditionKind } from "../resolve-conditions";
import { isPointerButton } from "../utils";
import { from, type FromInput, triggerKeys, triggerPointer } from "./from-action-wrappers";
import { button, CaseBuilder, hold, key, release, to, type ActionInput, type ToWrapper } from "./to-action-wrappers";

// Type-only imports to enable IDE IntelliSense {@link ...} symbol resolution in JSDoc comments.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  Action,
  BindingEventOptions,
  BindingMultiTap,
  BindingOtherKeyPressedEntry,
  BindingRuleGroup,
  BindingTiming,
} from "../../data";
import type {
  condApp,
  condDevice,
  condDeviceExists,
  condEventChanged,
  condInputSource,
  condKeyboardType,
  condNotApp,
  condNotVar,
  condState,
  condUnless,
  ifApp,
  ifDevice,
  ifDeviceExists,
  ifEventChanged,
  ifInputSource,
  ifKeyboardType,
  ifKeVar,
  ifState,
  ifUserVar,
  ifVar,
  state,
  unless,
  unlessApp,
  unlessKeVar,
  unlessUserVar,
} from "./condition-wrappers";
import type {
  anyInput,
  chord,
  simultaneous,
  trigger,
} from "./from-action-wrappers";
import type {
  actHere,
  app,
  appHistory,
  cmd,
  consumerKey,
  copy,
  cursorTo,
  cut,
  delayedSingleTap,
  doubleClick,
  doubleTap,
  doubleTapHold,
  folder,
  guard,
  map,
  mouseMove,
  mouseScroll,
  noop,
  osascript,
  paste,
  press,
  python,
  sequence,
  setVar,
  shell,
  sleepSystem,
  sticky,
  tap,
  tapAndHold,
  url,
} from "./to-action-wrappers";
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Configuration options for a Karabiner `Binding` (excluding trigger and cases).
 *
 * Use when specifying rule descriptions, timing thresholds, condition gates, processing flags, or event hooks for a binding.
 * All properties are optional and can be passed to {@link bind}, {@link options}, or via {@link BindingOptions}.
 *
 * ### Available Options:
 * - `description` (`string`): Human-readable rule label in Karabiner Settings GUI and output JSON.
 * - `timing` ({@link BindingTiming}): Millisecond thresholds (`aloneMs`, `holdMs`, `heldThresholdMs`, `delayedMs`, `simultaneousMs`). Configured via {@link timing}.
 * - `conditions` ({@link Condition}[]): Hoisted conditions applied across all manipulators in this binding (from {@link when}, {@link condApp}, {@link ifApp}, {@link ifDevice}, etc.).
 * - `eventOptions` ({@link BindingEventOptions}): Processing flags (`halt: true`, `repeat: true`).
 * - `multiTap` ({@link BindingMultiTap}): Multi-tap configuration (`allowPassThrough`, `mods`, `firstTapPendingVar`).
 * - `afterKeyUp` ({@link Action}[]): Actions executed after key release (`to_after_key_up`).
 * - `otherKeyPressed` ({@link BindingOtherKeyPressedEntry}[]): Chords that rewrite this held key (`to_if_other_key_pressed`).
 * - `whileHoldVar` ({@link VarSpec}): Variable set to 1 while held and 0 on release.
 * - `suppress` (`boolean`): Suppress trigger fallback across the entire binding.
 * - `suppressCancelFallback` (`boolean`): Clear `to_if_canceled` fallback channel on delayed actions.
 * - `modWhileDown` (`boolean`): Assert modifier while held down without hold threshold delay.
 * - `guardVar` (`string`): Variable name override for double-tap guard.
 * - `guardMs` (`number`): Timeout for double-tap guard in milliseconds.
 * - `ruleGroup` ({@link BindingRuleGroup}): Group ID and description to merge distinct triggers into one shared rule in UI.
 *
 * @example
 * ```ts
 * {
 *   description: "Cmd+J -> Down Arrow",
 *   timing: { aloneMs: 200, holdMs: 250 },
 *   conditions: [condApp(APPS.finder)],
 *   suppress: true,
 *   ruleGroup: { id: "caps_layer", description: "Caps Lock Layer" },
 * }
 * ```
 */
export type BindingOptionsSpec = Partial<Omit<Binding, "trigger" | "cases">>;

/**
 * Container wrapping binding options to be merged into a `Binding`.
 * Created via {@link options} or {@link timing}.
 */
export type OptionsWrapper = {
  kind: "options";
  opts: BindingOptionsSpec;
};

/**
 * Wraps binding options into an {@link OptionsWrapper} container for consumption by {@link bind}.
 *
 * Use when passing metadata (`description`), timing thresholds, processing flags (`halt`, `repeat`),
 * multi-tap configurations, or lifecycle hooks to a {@link bind} call.
 *
 * @param opts - Partial binding options object matching {@link BindingOptionsSpec}.
 * @returns An {@link OptionsWrapper} object.
 *
 * @example
 * ```ts
 * options({ description: "Toggle app window", suppress: true, timing: { aloneMs: 200 } })
 * ```
 */
export function options(opts: BindingOptionsSpec): OptionsWrapper {
  return {
    kind: "options",
    opts,
  };
}

/**
 * Creates an {@link OptionsWrapper} specifying timing parameters for a binding.
 *
 * Use when customizing tap/hold thresholds, multi-tap delays, or chord detection windows using a named
 * {@link TimingProfileName} (`"instant"`, `"snappy"`, `"balanced"`, `"relaxed"`, `"deliberate"`) or explicit millisecond thresholds.
 *
 * Two ways to call it:
 *
 * **1. By profile** — `timing("snappy")` names a *feel* and expands to a complete, internally coherent {@link TIMING_PROFILES} entry.
 * Every profile sets `aloneMs === holdMs`, which eliminates dead zones and double-fire zones.
 * Overrides can be passed as a 2nd argument — `timing("snappy", { delayedMs: 400 })`.
 *
 * **2. By explicit thresholds** — for custom cases where no profile fits:
 * - `aloneMs`: Max duration key can be held and still trigger `to_if_alone` upon release (`basic.to_if_alone_timeout_milliseconds`, default 1000ms).
 * - `holdMs`: Hold duration threshold in milliseconds.
 * - `heldThresholdMs`: Duration key must remain pressed before `to_if_held_down` fires (`basic.to_if_held_down_threshold_milliseconds`, default 500ms).
 * - `delayedMs`: Delay before `to_delayed_action` triggers (`basic.to_delayed_action_delay_milliseconds`, default 500ms).
 * - `simultaneousMs`: Time window for simultaneous chords (`basic.simultaneous_threshold_milliseconds`, default 50ms).
 *
 * @param optsOrProfile - A {@link TimingProfileName} (`"instant"`, `"snappy"`, `"balanced"`, `"relaxed"`, `"deliberate"`) or an explicit timing object.
 * @param overrides - Field overrides applied on top of a named profile. Ignored when the first argument is already an object.
 * @returns An {@link OptionsWrapper} containing the timing configuration.
 *
 * @example
 * ```ts
 * timing("snappy")                          // aloneMs 200 / holdMs 200 / delayedMs 250
 * timing("deliberate", { delayedMs: 300 })  // profile, one field overridden
 * timing({ aloneMs: 200, holdMs: 200 })     // explicit, still fine
 * ```
 */
export function timing(
  optsOrProfile: TimingProfileName | AcceptUndefined<NonNullable<Binding["timing"]>>,
  overrides?: AcceptUndefined<NonNullable<Binding["timing"]>>,
): OptionsWrapper {
  if (isTimingProfileName(optsOrProfile)) {
    return options({ timing: { ...TIMING_PROFILES[optsOrProfile], ...(overrides ?? {}) } });
  }
  return options({ timing: optsOrProfile });
}

/**
 * Complete binding options specification, combining {@link BindingOptionsSpec} with optional trigger modifiers.
 *
 * Use when passing options and/or modifiers as the trailing argument to helper functions:
 * - {@link bindKeys}(keys, cases, modifiersOrOptions?, options?)
 * - {@link bindPointer}(pointer, cases, modifiersOrOptions?, options?)
 * - {@link bindSimultaneous}(keys, cases, modifiersOrOptions?, options?) / {@link bindChord}(...)
 * - {@link bindTable}(phase, table, modifiersOrOptions?, options?)
 *
 * ### Accepted Properties:
 * - `modifiers` ({@link TriggerModifiers}): Trigger modifier keys (`["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`).
 * - `description` (`string`): Rule label in Karabiner Settings GUI and output JSON.
 * - `timing` ({@link BindingTiming}): Millisecond thresholds (`aloneMs`, `holdMs`, `heldThresholdMs`, `delayedMs`, `simultaneousMs`). Configured via {@link timing}.
 * - `conditions` ({@link Condition}[]): Hoisted conditions applied across all manipulators in this binding (from {@link when}, {@link condApp}, {@link ifApp}, etc.).
 * - `eventOptions` ({@link BindingEventOptions}): Processing flags (`halt: true`, `repeat: true`).
 * - `multiTap` ({@link BindingMultiTap}): Multi-tap options (`allowPassThrough`, `mods`, `firstTapPendingVar`).
 * - `afterKeyUp` ({@link Action}[]): Actions executed on key release (`to_after_key_up`).
 * - `otherKeyPressed` ({@link BindingOtherKeyPressedEntry}[]): Chords that rewrite this held key (`to_if_other_key_pressed`).
 * - `whileHoldVar` ({@link VarSpec}): Variable set to 1 while held and 0 on release.
 * - `suppress` (`boolean`): Suppress trigger fallback across the entire binding.
 * - `suppressCancelFallback` (`boolean`): Clear `to_if_canceled` fallback channel.
 * - `modWhileDown` (`boolean`): Assert modifier while held down without hold threshold delay.
 * - `guardVar` (`string`): Variable name override for double-tap guard.
 * - `guardMs` (`number`): Timeout for double-tap guard in milliseconds.
 * - `ruleGroup` ({@link BindingRuleGroup}): Group ID and description to merge distinct triggers into one shared rule in UI.
 *
 * @example
 * ```ts
 * // 1. As a modifiers array:
 * bindKeys("j", press(key("down_arrow")), ["cmd", "opt"])
 *
 * // 2. As an options object with modifiers and timing:
 * bindKeys("j", press(key("down_arrow")), {
 *   modifiers: ["cmd"],
 *   description: "Cmd+J triggers Down Arrow",
 *   timing: { aloneMs: 200 },
 *   suppress: true,
 * })
 *
 * // 3. Modifiers as 3rd arg, options as 4th arg:
 * bindKeys("j", press(key("down_arrow")), ["cmd"], {
 *   description: "Cmd+J triggers Down Arrow",
 *   timing: { aloneMs: 200 },
 * })
 * ```
 */
export type BindingOptions = BindingOptionsSpec & {
  /**
   * Modifier key requirements for the trigger.
   *
   * Accepts:
   * - Array of modifier names: `["command", "option"]`, `["cmd", "opt"]`, `["shift"]`, `["L.cmd"]`, `["R.opt"]`
   * - Virtual modifier aliases: `VM.COCS`, `VM.COC_`, `VM.C__S`
   * - Object with mandatory and optional modifiers: `{ mandatory: ["cmd"], optional: ["any"] }`
   *
   * @example ["cmd", "shift"]
   * @example VM.COCS
   * @example { mandatory: ["control"], optional: ["any"] }
   */
  modifiers?: TriggerModifiers;
};

/**
 * Every key `BindingOptionsSpec` accepts.
 *
 * `satisfies Record<keyof BindingOptionsSpec, true>` makes this exhaustive: add
 * a field to `Binding` and the compiler demands it be listed here. That is what
 * lets {@link bind} reject a misspelled option instead of silently dropping it —
 * `BindingOptionsSpec` is fully optional, so *any* object literal satisfies it
 * and the type system alone cannot catch `timings:` for `timing:`.
 */
const BINDING_OPTION_KEYS = {
  description: true,
  timing: true,
  conditions: true,
  eventOptions: true,
  multiTap: true,
  afterKeyUp: true,
  otherKeyPressed: true,
  whileHoldVar: true,
  suppress: true,
  suppressCancelFallback: true,
  modWhileDown: true,
  guardVar: true,
  guardMs: true,
  ruleGroup: true,
} satisfies Record<keyof BindingOptionsSpec, true>;

function isCase(val: unknown): val is Case {
  return typeof val === "object" && val !== null && ("do" in val || "phase" in val || val instanceof CaseBuilder);
}

/** `true` for a single `Case`/`CaseBuilder`, or a non-empty array of them. */
function isCaseOrCaseArray(val: unknown): val is Case | Case[] {
  if (Array.isArray(val)) return val.length > 0 && isCase(val[0]);
  return isCase(val);
}

/**
 * Validate a bare options object, which is the one `BindArg` variant the type
 * system cannot check. Throws naming the offending key.
 */
function assertKnownOptions(value: object): BindingOptionsSpec {
  const unknown = Object.keys(value).filter((k) => !(k in BINDING_OPTION_KEYS));
  if (unknown.length) {
    throw new Error(
      `bind(): unknown option${unknown.length > 1 ? "s" : ""} ${unknown
        .map((k) => `"${k}"`)
        .join(", ")}. Valid options: ${Object.keys(BINDING_OPTION_KEYS).sort().join(", ")}.`,
    );
  }
  return value as BindingOptionsSpec;
}

function isCondition(val: unknown): val is Condition {
  if (typeof val !== "object" || val === null) return false;
  try {
    conditionKind(val as Condition);
    return true;
  } catch {
    return false;
  }
}

function isTriggerModifiers(val: unknown): val is TriggerModifiers {
  return Array.isArray(val) || (typeof val === "object" && val !== null && ("mandatory" in val || "optional" in val));
}

/**
 * Flexible argument types accepted by {@link bind}.
 *
 * Supports:
 * - Action wrappers: {@link to}(...) containing action cases
 * - Condition wrappers: {@link when}(...) containing conditions or state items
 * - Option wrappers: {@link options}(...) and {@link timing}(...)
 * - Individual {@link Case} or `Case[]` items (from {@link press}, {@link release}, {@link tap}, {@link hold}, {@link tapAndHold}, {@link doubleTap}, etc.)
 * - Individual {@link Condition} or `Condition[]` items (from {@link ifApp}, {@link ifDevice}, {@link ifUserVar}, {@link state}, {@link unless}, etc.)
 * - Inline {@link BindingOptionsSpec} configuration objects
 */
export type BindArg =
  | ToWrapper
  | WhenWrapper
  | OptionsWrapper
  | Case
  | Case[]
  | Condition
  | Condition[]
  | BindingOptionsSpec;

/**
 * Constructs a Karabiner `Binding` from a trigger and a flexible list of cases, conditions, and options.
 *
 * Recognized wrappers & primitives accepted by `bind()`:
 * - Trigger builders - {@link from}(...), taking the following shapes:
 *    - Single key trigger: {@link from}(key, modifiers?) — Use when triggering on a single physical key press with optional modifier requirements.
 *    - Pointer button trigger: {@link from}(pointer, modifiers?) — Use when triggering on a mouse button press with optional modifiers.
 *    - Simultaneous key trigger: {@link from}(keys, modifiers?, order?) or {@link from}({ keys, order, modifiers }) — Use when triggering on simultaneous multi-key chords.
 *    - Chords & wildcards: {@link simultaneous}(first, ...rest) / {@link chord}(...) / {@link anyInput}(kind?, modifiers?) — Use when defining explicit key chords or intercepting wildcard input events.
 * - Action wrappers - 1+ case wrapper ({@link to}(...) or direct case builders), containing a combination of:
 *    (1) Phase
 *      - {@link press}(actions, conditions?) — Use when you want actions to execute immediately upon pressing the key down.
 *      - {@link release}(actions, conditions?) — Use when you want actions to execute upon key release.
 *      - {@link tap}(actions, conditions?) — Use as an alias for {@link release} when defining tap-triggered actions.
 *      - {@link hold}(actions, conditions?) — Use when you want actions to execute when the key is held down past the hold threshold.
 *      - {@link tapAndHold}(tapAction, holdAction, conditions?) — Use when defining both tap (on release) and hold behaviors sharing identical conditions in a single concise call.
 *      - {@link doubleTap}(actions, conditions?) — Use when mapping secondary actions to rapid double taps on the same key.
 *      - {@link doubleTapHold}(actions, conditions?) — Use when defining actions that trigger when a key is tapped once and then held down on the second press.
 *      - {@link delayedSingleTap}(actions, conditions?) — Use when defining single-tap actions that must wait for the multi-tap detection window to expire to prevent conflicts with double taps.
 *      - {@link guard}(actions?, conditions?) — Use when protecting destructive or critical actions with a double-tap confirmation requirement.
 *    (2) Actions
 *      - Remaps:
 *          - {@link key}(keyName, modifiersOrOptions?, options?, actionDesc?) — Use when remapping the trigger to emit a keyboard key event with optional modifiers and flags.
 *          - {@link consumerKey}(keyName, modifiersOrOptions?, options?, actionDesc?) — Use when emitting consumer-control key events like media playback, volume, or display brightness.
 *          - {@link map}(ref, options?, actionDesc?) — Use when triggering a pre-registered combo/mapping reference from the combos registry (`COMBOS.*`).
 *          - {@link button}(buttonName, modifiersOrOptions?, options?, actionDesc?) — Use when remapping the trigger to emit a mouse button click with optional modifiers.
 *          - {@link noop}() — Use when you want to silence or swallow a key event without emitting any output action.
 *      - Open:
 *          - {@link app}(ref, mode?, actionDesc?) — Use when mapping a hotkey to launch, switch to, or focus a specific application (`APPS.*`, bundle ID, or name).
 *          - {@link url}(ref, background?, actionDesc?) — Use when opening a URL in the browser either in the foreground or silently in the background (`URLS.*` or URL string).
 *          - {@link folder}(ref, actionDesc?) — Use when opening a directory path in Finder or the default file manager (`PATHS.*` or directory path string).
 *      - Call scripts:
 *          - {@link shell}(command, actionDesc?) — Use when executing a shell command string or registered command spec (`CMDS.*`).
 *          - {@link python}(scriptPath, options?, actionDesc?) — Use when executing a Python script with optional arguments and virtual environment settings.
 *          - {@link osascript}(scriptPath, args?, actionDesc?) — Use when executing an AppleScript or JOSA script file with optional arguments.
 *      - Clipboard:
 *          - {@link cut}() — Use when creating a dedicated shortcut that emits a clipboard cut event (⌘+X).
 *          - {@link copy}() — Use when creating a dedicated shortcut that emits a clipboard copy event (⌘+C).
 *          - {@link paste}() — Use when creating a dedicated shortcut that emits a clipboard paste event (⌘+V).
 *      - Internal / System:
 *          - {@link setVar}(varSpec, value?, toggle?) — Use when setting, clearing, or toggling a Karabiner state variable (`VARS.*`) during key events.
 *          - {@link cmd}(ref, actionDesc?) — Use when executing a pre-registered command spec from the commands registry (`CMDS.*`).
 *          - {@link appHistory}(index, exclude?, actionDesc?) — Use when navigating through recent application history (e.g., switching to the previous app).
 *          - {@link actHere}(action) — Use when triggering context-sensitive actions bound to the current window or cursor context.
 *          - {@link sticky}(flag, toggle?, actionDesc?) — Use when making a modifier key sticky ("on", "off", or "toggle") so it remains held after release.
 *          - {@link mouseMove}(opts, actionDesc?) — Use when building keyboard-driven mouse cursor navigation (mouse keys) in cardinal directions.
 *          - {@link mouseScroll}(opts, actionDesc?) — Use when building keyboard-driven mouse wheel scrolling in cardinal directions.
 *          - {@link cursorTo}(x, y, opts?, actionDesc?) — Use when warping the mouse cursor to absolute screen positions or focused window coordinates.
 *          - {@link doubleClick}(button?, actionDesc?) — Use when simulating an OS-level mouse double-click at the current pointer position.
 *          - {@link sleepSystem}(delayMilliseconds?, actionDesc?) — Use when binding a shortcut to put the macOS system to sleep with an optional delay.
 *      - Meta-actions:
 *          - {@link sequence}(...actions) — Use when executing multiple action specs in sequential order on a single trigger event.
 * - Condition wrappers (optional) - `when(...)` containing 1+ conditions:
 *      - {@link when}(...items) — Use when grouping multiple conditions or state items into a hoisted condition wrapper for `bind()`.
 *      - {@link state}(item, value?) / {@link state}(tuple) / {@link state}(...items) — Use when gating bindings to activate only when specified variables, apps, devices, or state tuples are active.
 *      - {@link unless}(item) / {@link unless}(...items) — Use when gating bindings to activate only when specified variables, apps, or states are inactive/false.
 *      - {@link condApp}(app, isForemost?) / {@link ifApp}(app) — Use when restricting a binding to activate only when specified applications (`APPS.*`, bundle ID, or path) are frontmost.
 *      - {@link unlessApp}(app) / {@link condNotApp}(app) — Use when excluding a binding from activating when specified applications are frontmost.
 *      - {@link ifDevice}(device, unlessOrOpts?) / {@link condDevice}(device) — Use when restricting a binding to events originating from a specific hardware device (`DEVICES.*`).
 *      - {@link ifDeviceExists}(deviceExists, unlessOrOpts?) / {@link condDeviceExists}(...) — Use when activating a binding only while a specific hardware device is currently connected to the system.
 *      - {@link ifUserVar}(varOrValueSpec, equalsOrUnless?, unlessOrOpts?) / {@link ifVar}(...) — Use when gating a binding on a specific Karabiner variable value (`VARS.*`, `STATES.*`).
 *      - {@link unlessUserVar}(varOrValueSpec, equals?) / {@link condNotVar}(...) — Use when gating a binding to activate only when a Karabiner variable does NOT equal a specific value.
 *      - {@link ifKeyboardType}(keyboardType, unlessOrOpts?) / {@link condKeyboardType}(...) — Use when restricting a binding to a specific virtual keyboard layout type (`"ansi"`, `"iso"`, `"jis"`).
 *      - {@link ifInputSource}(inputSource, unlessOrOpts?) / {@link condInputSource}(...) — Use when restricting a binding to specific active keyboard input source languages or layout IDs.
 *      - {@link ifEventChanged}(eventChanged, unlessOrOpts?) / {@link condEventChanged}(...) — Use when filtering bindings based on whether the event was already rewritten by Simple Modifications.
 * - Option wrappers (optional):
 *      - {@link to}(...cases) — Use when explicitly wrapping multiple action cases into a case container.
 *      - {@link options}(opts) — Use when configuring binding metadata (`description`), rule grouping (`ruleGroup`), processing flags (`halt`, `repeat`), and lifecycle hooks (`afterKeyUp`).
 *      - {@link timing}(profileOrOpts, overrides?) — Use when setting timing thresholds via preset profile (`"snappy"`, `"instant"`, `"balanced"`, `"relaxed"`, `"deliberate"`) or explicit millisecond thresholds.
 *      - or inline object literal options matching {@link BindingOptionsSpec} — Use when passing configuration options directly as an inline object without a wrapper function.
 *
 * @param trigger - The input trigger specification (key code, pointer button, trigger object, or array of inputs).
 * @param args - Combination of action cases (`to()`, `press()`), conditions (`when()`, `ifApp()`), and options (`options()`, `timing()`, or object literal options).
 * @returns A fully constructed `Binding` object.
 *
 * @example
 * ```ts
 * // Basic key remapping:
 * bind(from("a", ["cmd"]), to(press(key("b"))))
 *
 * // Tap vs hold with app condition and options:
 * bind(
 *   from("p", ["cmd"]),
 *   to(
 *     release(cmd(CMDS.wordPrint)).when(ifApp("com.microsoft.Word")),
 *     hold(map(COMBOS.showPopclip)),
 *   ),
 *   options({ description: "Cmd+P: Print in Word / PopClip elsewhere", timing: { aloneMs: 200 } })
 * )
 *
 * // Simultaneous key chord:
 * bind(
 *   from({ keys: ["j", "k"], order: "strict" }),
 *   to(press(key("escape"))),
 *   when(ifApp("com.apple.Terminal"))
 * )
 * ```
 */
export function bind(trigger: FromInput, ...args: BindArg[]): Binding {
  const trg = from(trigger);
  const cases: Case[] = [];
  const hoistedConditions: Condition[] = [];
  let mergedOptions: BindingOptionsSpec = {};

  for (const arg of args) {
    if (!arg) continue;

    if (typeof arg === "object" && "kind" in arg) {
      const wrapper = arg as ToWrapper | WhenWrapper | OptionsWrapper;
      if (wrapper.kind === "to") {
        cases.push(...wrapper.cases);
        continue;
      }
      if (wrapper.kind === "when") {
        hoistedConditions.push(...wrapper.conditions);
        continue;
      }
      if (wrapper.kind === "options") {
        mergedOptions = { ...mergedOptions, ...wrapper.opts };
        continue;
      }
    }

    if (Array.isArray(arg)) {
      // Classify every element, not just the first: a mixed array would
      // otherwise be silently filed under whatever `arg[0]` happened to be.
      const conditions = arg.filter(isCondition);
      const caseItems = arg.filter(isCase);
      if (conditions.length + caseItems.length !== arg.length) {
        throw new Error(
          `bind(): array argument contains ${arg.length - conditions.length - caseItems.length} ` +
            "entr(y|ies) that are neither a case nor a condition.",
        );
      }
      hoistedConditions.push(...conditions);
      cases.push(...caseItems);
      continue;
    }

    if (isCase(arg)) {
      cases.push(arg);
      continue;
    }

    if (isCondition(arg)) {
      hoistedConditions.push(arg);
      continue;
    }

    mergedOptions = { ...mergedOptions, ...assertKnownOptions(arg) };
  }

  const finalConditions = [...(hoistedConditions.length ? hoistedConditions : []), ...(mergedOptions.conditions ?? [])];

  return {
    trigger: trg,
    cases,
    ...mergedOptions,
    ...(finalConditions.length ? { conditions: finalConditions } : {}),
  };
}

/**
 * Creates a key-triggered Karabiner `Binding`.
 *
 * Use when creating a binding triggered by a physical keyboard key or key array (with optional modifiers)
 * and dispatching to one or more action phases (tap, hold, press, etc.).
 *
 * @param keys - Key code or array of key codes acting as the trigger (e.g. `"j"`, `["j", "k"]`).
 * @param cases - Action case or array of cases to execute when triggered (from {@link press}, {@link release}, {@link tap}, {@link hold}, {@link tapAndHold}, {@link doubleTap}, etc.).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["cmd", "opt"]`, `VM.COCS`) OR a full {@link BindingOptions} configuration object.
 * @param options - Additional {@link BindingOptions} or {@link OptionsWrapper} if a modifier array/object was passed as the 3rd argument (`modifiersOrOptions`).
 * @returns A fully constructed {@link Binding} object for key triggers.
 *
 * @example
 * ```ts
 * // 1. With modifiers array:
 * bindKeys("j", press(key("down_arrow")), ["cmd"])
 *
 * // 2. With modifiers and options:
 * bindKeys(
 *   "j",
 *   press(key("down_arrow")),
 *   ["cmd"],
 *   { description: "Cmd+J triggers Down Arrow", timing: { aloneMs: 200 } }
 * )
 *
 * // 3. With full options object as 3rd arg:
 * bindKeys("j", press(key("down_arrow")), {
 *   modifiers: ["cmd"],
 *   description: "Cmd+J triggers Down Arrow",
 *   suppress: true,
 * })
 * ```
 */
export function bindKeys(
  keys: KeyCode | KeyCode[],
  cases: Case | Case[],
  modifiersOrOptions?: TriggerModifiers | BindingOptions | OptionsWrapper,
  options?: BindingOptions | OptionsWrapper,
): Binding {
  let modifiers: TriggerModifiers | undefined;
  let opts: BindingOptions | undefined;

  const normalizeOpts = (o: BindingOptions | OptionsWrapper | undefined): BindingOptions | undefined => {
    if (!o) return undefined;
    if (typeof o === "object" && "kind" in o && (o as OptionsWrapper).kind === "options") {
      return (o as OptionsWrapper).opts as BindingOptions;
    }
    return o as BindingOptions;
  };

  if (isTriggerModifiers(modifiersOrOptions)) {
    modifiers = modifiersOrOptions;
    opts = normalizeOpts(options);
  } else {
    opts = normalizeOpts(modifiersOrOptions);
    modifiers = opts?.modifiers;
  }

  const { modifiers: _m, ...restOpts } = opts ?? {};
  return bind(triggerKeys(keys, modifiers), cases, restOpts);
}

/**
 * Creates a pointer button-triggered Karabiner `Binding`.
 *
 * Use when creating a binding triggered by a mouse button click or hold (e.g. `"button4"`, `"button5"`, `"right"`)
 * and mapping to keystrokes, shortcuts, apps, or scripts.
 *
 * @param pointer - Pointer button alias (e.g. `"button1"`, `"button4"`, `"right"`, `"left"`).
 * @param cases - Action case or array of cases to execute when triggered (from {@link press}, {@link release}, {@link tap}, {@link hold}, {@link tapAndHold}, etc.).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["cmd", "opt"]`, `VM.COCS`) OR a full {@link BindingOptions} configuration object.
 * @param options - Additional {@link BindingOptions} or {@link OptionsWrapper} if a modifier array/object was passed as the 3rd argument (`modifiersOrOptions`).
 * @returns A fully constructed {@link Binding} object for pointer button triggers.
 *
 * @example
 * ```ts
 * // 1. Mouse button tap and hold:
 * bindPointer("button4", tapAndHold(key("bracket_left", ["cmd"]), key("bracket_right", ["cmd"])))
 *
 * // 2. With modifiers and description:
 * bindPointer(
 *   "button4",
 *   press(key("bracket_left", ["cmd"])),
 *   ["cmd"],
 *   { description: "Cmd+Mouse Button 4 -> Back" }
 * )
 * ```
 */
export function bindPointer(
  pointer: PointerButtonAlias,
  cases: Case | Case[],
  modifiersOrOptions?: TriggerModifiers | BindingOptions | OptionsWrapper,
  options?: BindingOptions | OptionsWrapper,
): Binding {
  let modifiers: TriggerModifiers | undefined;
  let opts: BindingOptions | undefined;

  const normalizeOpts = (o: BindingOptions | OptionsWrapper | undefined): BindingOptions | undefined => {
    if (!o) return undefined;
    if (typeof o === "object" && "kind" in o && (o as OptionsWrapper).kind === "options") {
      return (o as OptionsWrapper).opts as BindingOptions;
    }
    return o as BindingOptions;
  };

  if (isTriggerModifiers(modifiersOrOptions)) {
    modifiers = modifiersOrOptions;
    opts = normalizeOpts(options);
  } else {
    opts = normalizeOpts(modifiersOrOptions);
    modifiers = opts?.modifiers;
  }

  const { modifiers: _m, ...restOpts } = opts ?? {};
  return bind(triggerPointer(pointer, modifiers), cases, restOpts);
}

/**
 * Creates a simultaneous key chord-triggered Karabiner `Binding`.
 *
 * Use when defining a binding that triggers when two or more keys are pressed at the same time
 * within the simultaneous threshold window.
 *
 * @param keys - Key code, pointer button, or array of keys acting as the simultaneous chord (e.g. `["j", "k"]`, `["left_option", "right_option"]`).
 * @param cases - Action case or array of cases to execute when chord is pressed (from {@link press}, {@link hold}, {@link tapAndHold}, etc.).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["shift"]`, `VM.COCS`) OR a full {@link BindingOptions} configuration object.
 * @param options - Additional {@link BindingOptions} if modifiers were supplied as the 3rd argument.
 * @returns A fully constructed {@link Binding} object for simultaneous triggers.
 *
 * @example
 * ```ts
 * // 1. Basic simultaneous chord:
 * bindSimultaneous(["left_option", "right_option"], press(key("slash", ["right_control"])))
 *
 * // 2. Chord with modifiers and options:
 * bindSimultaneous(["j", "k"], hold(app(APPS.finder)), ["shift"], {
 *   description: "Shift+J+K chord opens Finder",
 *   timing: { simultaneousMs: 60 },
 * })
 * ```
 */
export function bindSimultaneous(
  keys: TriggerKey | TriggerKey[],
  cases: Case | Case[],
  modifiersOrOptions?: TriggerModifiers | BindingOptions,
  options?: BindingOptions,
): Binding {
  let modifiers: TriggerModifiers | undefined;
  let opts: BindingOptions | undefined;

  if (isTriggerModifiers(modifiersOrOptions)) {
    modifiers = modifiersOrOptions;
    opts = options;
  } else {
    opts = modifiersOrOptions;
    modifiers = opts?.modifiers;
  }

  const { modifiers: _m, ...restOpts } = opts ?? {};
  const keysArray = Array.isArray(keys) ? keys : [keys];
  return bind(triggerKeys(keysArray, modifiers), cases, restOpts);
}

/**
 * Alias for {@link bindSimultaneous}. Creates a simultaneous key chord-triggered Karabiner `Binding`.
 */
export const bindChord = bindSimultaneous;

/**
 * Creates an array of Karabiner `Binding`s from a key-value mapping table sharing a common phase, modifiers, and options.
 *
 * Use when defining a cohesive family of single-key bindings (such as window management hotkeys, app launchers, or keypad remaps)
 * that all share the same modifier requirements and execution phase.
 *
 * A table value is either:
 * - A bare action or registry primitive (e.g. `URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) — auto-normalized and wrapped in `phase`.
 * - An action array `[action1, action2]`.
 * - A pre-built {@link Case} / `Case[]` (from {@link press}, {@link hold}, {@link tapAndHold}, or with `.when(...)` overrides) used as-is.
 *
 * @param phase - Trigger phase (`"press"`, `"release"`, `"hold"`) applied to bare action entries.
 * @param table - Map of key codes to actions or pre-built cases: `Partial<Record<KeyCode, ActionInput | ActionInput[] | Case | Case[]>>`.
 * @param modifiersOrOptions - Optional trigger modifiers shared by every entry (e.g. `["cmd", "opt"]`, `VM.COCS`) OR a full {@link BindingOptions} configuration object.
 * @param options - Additional {@link BindingOptions} shared by every entry if modifiers were supplied as the 3rd argument.
 * @returns An array of {@link Binding} objects, one per table entry.
 *
 * @example
 * ```ts
 * // 1. Table with shared phase and modifiers:
 * bindTable("release", {
 *   e: COMBOS.focusWinRight,
 *   f: COMBOS.focusWinBottom,
 *   q: COMBOS.focusWinLeft,
 *   r: COMBOS.focusWinTop,
 * }, VM.COCS)
 *
 * // 2. Table with options object as 3rd arg:
 * bindTable("hold", {
 *   "8": APPS.ringCentral,
 *   keypad_5: url(URLS.winsUnstash, true),
 * }, {
 *   modifiers: ["shift"],
 *   timing: { holdMs: 200 },
 *   description: "Numeric keypad window stash bindings",
 * })
 *
 * // 3. Pre-built Case overrides for specific entries:
 * bindTable("hold", {
 *   n: shell(CMDS.neruHints),
 *   p: hold(COMBOS.showPopclip).when(condApp(APPS.finder)),
 *   s: press(URLS.hsFormatSelection),
 * }, VM.COCS)
 * ```
 */
export function bindTable(
  phase: Phase,
  table: Partial<Record<KeyCode, ActionInput | ActionInput[] | Case | Case[]>>,
  modifiersOrOptions?: TriggerModifiers | BindingOptions | OptionsWrapper,
  options?: BindingOptions | OptionsWrapper,
): Binding[] {
  return (Object.keys(table) as KeyCode[]).map((keyCode) => {
    const value = table[keyCode] as ActionInput | ActionInput[] | Case | Case[];
    const cases = isCaseOrCaseArray(value) ? value : new CaseBuilder(phase, value as ActionInput | ActionInput[]);
    return bindKeys(keyCode, cases, modifiersOrOptions, options);
  });
}

/**
 * Configuration options for {@link motionToScroll} pointer tweaks.
 */
export type MotionToScrollOptions = {
  /**
   * Human-readable label for this rule in Karabiner Settings GUI and logs.
   *
   * @example "Hold right button to scroll"
   */
  description: string;

  /**
   * Trigger input that activates scroll mode while held (mouse button, key, chord, or modifier).
   *
   * @example "button4"
   * @example "fn"
   * @example ["d", "f"]
   * @example from("button4")
   */
  trigger?: PointerMotionTrigger;

  /**
   * Modifier keys that activate scroll mode, or optional modifiers to allow through.
   *
   * @example ["fn"]
   * @example { mandatory: ["fn"], optional: ["any"] }
   */
  modifiers?: TriggerModifiers;

  /**
   * Conditions or {@link WhenWrapper} gating scroll mode (e.g. apps, devices, variable states).
   *
   * @example VARS.rButtonDown
   * @example [VARS.rButtonDown, DEVICES.g502X]
   * @example when(VARS.rButtonDown)
   */
  when?: WhenWrapper | Condition | Condition[] | StateItem | readonly StateItem[] | unknown;

  /**
   * Explicit condition list gating scroll mode.
   *
   * @example [ifUserVar(VARS.rButtonDown)]
   */
  conditions?: (Condition | WhenWrapper)[];

  /**
   * Optional custom variable identifier or {@link VarSpec} used to signal scroll mode for non-modifier triggers.
   */
  variable?: VarSpec | string;

  /**
   * Whether momentum / inertial scrolling is enabled after pointer movement stops.
   *
   * @default true
   */
  momentumScroll?: boolean;

  /**
   * Multiplier applied to scroll speed. Higher values scroll faster.
   *
   * @default 1.0
   * @example 1.5
   */
  speedMultiplier?: number;
};

/**
 * Constructs a `motionToScroll` pointer tweak that turns mouse movement into mouse wheel scrolling while a trigger is held.
 *
 * Use when creating trackball or mouse drag-to-scroll features (e.g. hold right click or button4 to scroll by moving the mouse).
 *
 * Supports both structured {@link MotionToScrollOptions} objects and fluent variadic syntax:
 * - Structured object: `motionToScroll({ description, when, speedMultiplier, ... })`
 * - Variadic syntax: `motionToScroll("description", VARS.rButtonDown, ...)`
 *
 * @param options - Full {@link MotionToScrollOptions} configuration object.
 * @returns A validated {@link PointerMotionToScroll} tweak definition.
 *
 * @example
 * ```ts
 * // 1. Scoped by variable state (e.g. while right button is held):
 * motionToScroll({
 *   description: "Hold right click to scroll",
 *   when: VARS.rButtonDown,
 *   speedMultiplier: 1.0,
 * })
 *
 * // 2. Fluent variadic syntax:
 * motionToScroll("Hold right click to scroll", VARS.rButtonDown)
 * motionToScroll("Hold right click in Zen", when(VARS.rButtonDown, APPS.zen))
 *
 * // 3. Scoped by mouse button:
 * motionToScroll({
 *   description: "Hold button4 to scroll",
 *   trigger: "button4",
 *   speedMultiplier: 1.5,
 * })
 *
 * // 4. Scoped by modifier key:
 * motionToScroll({
 *   description: "Hold fn to scroll",
 *   trigger: "fn",
 * })
 *
 * // 5. Scoped by key chord:
 * motionToScroll({
 *   description: "Hold d+f to scroll",
 *   trigger: ["d", "f"],
 * })
 * ```
 */
export function motionToScroll(options: MotionToScrollOptions): PointerMotionToScroll;
export function motionToScroll(description: string, ...args: unknown[]): PointerMotionToScroll;
export function motionToScroll(
  optionsOrDescription: PointerMotionToScroll | MotionToScrollOptions | string,
  ...args: unknown[]
): PointerMotionToScroll {
  if (typeof optionsOrDescription === "string") {
    const description = optionsOrDescription;
    let trigger: PointerMotionTrigger | undefined;
    let modifiers: TriggerModifiers | undefined;
    const rawConditions: Condition[] = [];
    let variable: VarSpec | string | undefined;
    let momentumScroll: boolean | undefined;
    let speedMultiplier: number | undefined;

    for (const arg of args) {
      if (!arg) continue;
      if (typeof arg === "object" && arg !== null) {
        if ("kind" in arg && (arg as { kind: string }).kind === "when") {
          rawConditions.push(...(arg as WhenWrapper).conditions);
          continue;
        }
        if ("speedMultiplier" in arg || "momentumScroll" in arg || "variable" in arg || "modifiers" in arg) {
          const opts = arg as {
            speedMultiplier?: number;
            momentumScroll?: boolean;
            variable?: VarSpec | string;
            modifiers?: TriggerModifiers;
          };
          if (opts.speedMultiplier !== undefined) speedMultiplier = opts.speedMultiplier;
          if (opts.momentumScroll !== undefined) momentumScroll = opts.momentumScroll;
          if (opts.variable !== undefined) variable = opts.variable;
          if (opts.modifiers !== undefined) modifiers = opts.modifiers;
          continue;
        }
        if ("keys" in arg || "pointer" in arg || "any" in arg) {
          trigger = arg as PointerMotionTrigger;
          continue;
        }
      }
      if (typeof arg === "string") {
        trigger = arg as PointerMotionTrigger;
        continue;
      }
      const resolved = when(arg as StateItem);
      rawConditions.push(...resolved.conditions);
    }

    const conditions = rawConditions.length > 0 ? (rawConditions as [Condition, ...Condition[]]) : undefined;
    return {
      kind: "motionToScroll",
      description,
      ...(trigger !== undefined ? { trigger } : {}),
      ...(modifiers !== undefined ? { modifiers } : {}),
      ...(conditions !== undefined ? { conditions } : {}),
      ...(variable !== undefined ? { variable } : {}),
      ...(momentumScroll !== undefined ? { momentumScroll } : {}),
      ...(speedMultiplier !== undefined ? { speedMultiplier } : {}),
    } as PointerMotionToScroll;
  }

  const opts = optionsOrDescription as MotionToScrollOptions;
  const conditions: Condition[] = [];
  if (opts.conditions) {
    for (const c of opts.conditions) {
      if ("kind" in c && (c as { kind: string }).kind === "when") {
        conditions.push(...(c as WhenWrapper).conditions);
      } else {
        conditions.push(c as Condition);
      }
    }
  }
  if (opts.when) {
    if (
      typeof opts.when === "object" &&
      opts.when !== null &&
      "kind" in opts.when &&
      (opts.when as { kind: string }).kind === "when"
    ) {
      conditions.push(...(opts.when as WhenWrapper).conditions);
    } else {
      const resolved = when(opts.when as StateItem);
      conditions.push(...resolved.conditions);
    }
  }

  const condsTuple = conditions.length > 0 ? (conditions as [Condition, ...Condition[]]) : undefined;

  return {
    kind: "motionToScroll",
    description: opts.description,
    ...(opts.trigger !== undefined ? { trigger: opts.trigger } : {}),
    ...(opts.modifiers !== undefined ? { modifiers: opts.modifiers } : {}),
    ...(condsTuple !== undefined ? { conditions: condsTuple } : {}),
    ...(opts.variable !== undefined ? { variable: opts.variable } : {}),
    ...(opts.momentumScroll !== undefined ? { momentumScroll: opts.momentumScroll } : {}),
    ...(opts.speedMultiplier !== undefined ? { speedMultiplier: opts.speedMultiplier } : {}),
  } as PointerMotionToScroll;
}

/**
 * Configuration options for {@link pointerTransform} pointer tweaks.
 */
export type PointerTransformOptions = {
  /**
   * Human-readable label for this rule in Karabiner Settings GUI and logs.
   *
   * @example "Invert vertical scroll"
   */
  description: string;

  /**
   * Axes to flip / invert direction (e.g. `["vertical_wheel"]`, `["x", "y"]`).
   */
  flip?: PointerTransform["flip"];

  /**
   * Axes to swap (e.g. swap horizontal and vertical axes).
   */
  swap?: PointerTransform["swap"];

  /**
   * Conditions gating the pointer transform (e.g. specific apps or devices).
   */
  conditions?: Condition[];

  /**
   * Axes whose movement events are discarded / suppressed.
   */
  discard?: [PointerAxis, ...PointerAxis[]];
};

/**
 * Constructs a `transform` pointer tweak to flip, swap, or discard pointer movement and scroll axes.
 *
 * Use when inverting scroll directions on specific devices, swapping mouse axes, or disabling specific wheel axes.
 *
 * @param options - Configuration object matching {@link PointerTransformOptions} or pre-built {@link PointerTransform}.
 * @returns A validated {@link PointerTransform} tweak definition.
 *
 * @example
 * ```ts
 * // 1. Invert vertical scroll wheel:
 * pointerTransform({
 *   description: "Invert vertical scroll",
 *   flip: ["vertical_wheel"],
 * })
 *
 * // 2. Discard horizontal scroll on external mouse:
 * pointerTransform({
 *   description: "Disable horizontal scroll on trackball",
 *   discard: ["horizontal_wheel"],
 *   conditions: [ifDevice(DEVICES.trackball)],
 * })
 * ```
 */
export function pointerTransform(options: PointerTransformOptions | PointerTransform): PointerTransform {
  return {
    kind: "transform",
    ...options,
  } as PointerTransform;
}

/**
 * Configuration options for {@link holdLayer}.
 */
export type HoldLayerOptions = {
  /**
   * The trigger input that activates the layer while held down (e.g. `"R.cmd"`, `"caps_lock"`, `"button2"`).
   */
  trigger: FromInput;

  /**
   * State variable tracking whether the trigger is held down.
   * If provided, this variable is set to 1 while held and reset to 0 on release (`to_after_key_up`).
   * If omitted, a variable name is synthesized from the trigger identifier.
   */
  variable?: VarSpec | string;

  /**
   * Action(s) or key emitted if the trigger is tapped and released alone (without pressing any chord key).
   * If not specified, defaults to emitting the trigger key itself with `{ repeat: false }`.
   */
  tapAlone?: ActionInput | ActionInput[] | Case | Case[];

  /**
   * Optional timing parameters for the hold trigger (e.g. `aloneMs`, `holdMs`).
   */
  timing?: {
    aloneMs?: number;
    holdMs?: number;
    heldThresholdMs?: number;
    delayedMs?: number;
  };

  /**
   * Optional condition or conditions gating the entire layer (e.g. specific device or frontmost app).
   */
  when?: WhenWrapper | Condition | Condition[] | StateItem | readonly StateItem[] | unknown;

  /**
   * Optional rule description for the layer in Karabiner Settings GUI.
   */
  description?: string;

  /**
   * Quick-launch / chord bindings table mapped while the trigger is held down.
   * Values can be action inputs (which default to {@link press} phase) or explicit {@link Case} items.
   */
  bindings: Partial<Record<KeyCode, ActionInput | ActionInput[] | Case | Case[]>>;
};

/**
 * Constructs a momentary dual-role hold layer (space-cadet / hyper layer) from a trigger key and a table of chords.
 *
 * Use when creating a custom modifier or layer key (e.g. Caps Lock, Right Command, or a mouse button) that acts as a modifier
 * while held to activate a sub-layer of quick shortcuts, while emitting a clean single tap when tapped alone.
 *
 * The constructed layer automatically:
 * 1. Tracks hold state via a Karabiner variable (`whileHoldVar`), setting it to 1 on press and 0 on release.
 * 2. Emits {@link HoldLayerOptions.tapAlone} on release if tapped alone, with `suppressCancelFallback: true` to prevent key leakage when chords are pressed.
 * 3. Maps the chord bindings table with phase `"press"` gated by the layer's variable condition.
 *
 * @param config - Hold layer configuration options matching {@link HoldLayerOptions}.
 * @returns An array of {@link Binding} objects containing the base trigger binding and all gated chord bindings.
 *
 * @example
 * ```ts
 * // 1. Right Command hold layer for app launchers:
 * holdLayer({
 *   trigger: "R.cmd",
 *   variable: VARS.rCmdDown,
 *   tapAlone: key("R.cmd", { repeat: false }),
 *   description: "Right Command Layer",
 *   bindings: {
 *     a: APPS.antinote,
 *     b: APPS.brave,
 *     o: APPS.outlook,
 *     t: APPS.teams,
 *   },
 * })
 * ```
 */
export function holdLayer(config: HoldLayerOptions): Binding[] {
  let varSpec: VarSpec;
  if (typeof config.variable === "string") {
    varSpec = { name: config.variable, varDesc: `${config.variable} held` };
  } else if (config.variable && typeof config.variable === "object" && "name" in config.variable) {
    varSpec = config.variable;
  } else {
    const rawTrigger = typeof config.trigger === "string" ? config.trigger : "layer";
    const name = `layer_${String(rawTrigger).replace(/[^a-zA-Z0-9_]/g, "_")}_pressed`;
    varSpec = { name, varDesc: `Layer ${String(rawTrigger)} held` };
  }

  let defaultTapAction: ActionInput | ActionInput[];
  if (typeof config.trigger === "string" && isPointerButton(config.trigger)) {
    defaultTapAction = button(config.trigger as PointerButtonAlias, { repeat: false });
  } else if (typeof config.trigger === "string") {
    defaultTapAction = key(config.trigger as KeyCode, { repeat: false });
  } else {
    defaultTapAction = [];
  }

  const tapActionInput = config.tapAlone !== undefined ? config.tapAlone : defaultTapAction;
  const triggerCases: Case[] = isCaseOrCaseArray(tapActionInput)
    ? Array.isArray(tapActionInput)
      ? tapActionInput
      : [tapActionInput]
    : [release(tapActionInput as ActionInput | ActionInput[]), hold([])];

  const triggerArgs: BindArg[] = [
    to(...triggerCases),
    options({
      whileHoldVar: varSpec,
      suppressCancelFallback: true,
      ...(config.timing ? { timing: config.timing } : {}),
      ...(config.description ? { description: config.description } : {}),
    }),
  ];

  if (config.when !== undefined) {
    if (
      typeof config.when === "object" &&
      config.when !== null &&
      "kind" in config.when &&
      (config.when as { kind: string }).kind === "when"
    ) {
      triggerArgs.push(config.when as WhenWrapper);
    } else {
      triggerArgs.push(when(config.when as StateItem));
    }
  }

  const triggerBinding = bind(config.trigger, ...triggerArgs);

  const chordConditions: (WhenWrapper | Condition)[] = [when(varSpec)];
  if (config.when !== undefined) {
    if (
      typeof config.when === "object" &&
      config.when !== null &&
      "kind" in config.when &&
      (config.when as { kind: string }).kind === "when"
    ) {
      chordConditions.push(config.when as WhenWrapper);
    } else {
      chordConditions.push(when(config.when as StateItem));
    }
  }

  const chordBindings = (Object.keys(config.bindings) as KeyCode[]).map((keyCode) => {
    const value = config.bindings[keyCode] as ActionInput | ActionInput[] | Case | Case[];
    const cases = isCaseOrCaseArray(value) ? value : new CaseBuilder("press", value as ActionInput | ActionInput[]);
    return bind(from(keyCode), to(cases), ...chordConditions);
  });

  return [triggerBinding, ...chordBindings];
}
