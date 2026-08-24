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
import type { AcceptUndefined } from "../../types/util";
import type { PointerAxis } from "../../types/karabiner";
import { when, type StateItem, type WhenWrapper } from "./condition-wrappers";
import { conditionKind } from "../resolve-conditions";
import { from, type FromInput, triggerKeys, triggerPointer } from "./from-action-wrappers";
import { CaseBuilder, type ActionInput, type ToWrapper } from "./to-action-wrappers";

/**
 * Configuration options for a Karabiner `Binding` (excluding trigger and cases).
 *
 * All properties are optional and can be passed to `bind()`, `options()`, or via `BindingOptions`.
 *
 * ### Available Options:
 * - `description` (`string`): Human-readable rule label in Karabiner Settings GUI and output JSON.
 * - `timing` ({@link BindingTiming}): Millisecond thresholds (`aloneMs`, `holdMs`, `heldThresholdMs`, `delayedMs`, `simultaneousMs`).
 * - `conditions` ({@link Condition}[]): Hoisted conditions applied across all manipulators in this binding.
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
 */
export type OptionsWrapper = {
  kind: "options";
  opts: BindingOptionsSpec;
};

/**
 * Wraps binding options into an `OptionsWrapper` for consumption by `bind()`.
 *
 * @param opts - Partial binding options object. Supports:
 * - `description`: Rule label in Karabiner Settings GUI.
 * - `timing`: Timing parameters (`aloneMs`, `holdMs`, `heldThresholdMs`, `delayedMs`, `simultaneousMs`).
 * - `conditions`: Hoisted conditions applied across all manipulators in this binding.
 * - `eventOptions`: Processing flags (`halt`, `repeat`).
 * - `multiTap`: Multi-tap configuration (`allowPassThrough`, `mods`, `firstTapPendingVar`).
 * - `afterKeyUp`: Actions executed on key release (`to_after_key_up`).
 * - `otherKeyPressed`: Key rewrites while held (`to_if_other_key_pressed`).
 * - `whileHoldVar`: Variable set to 1 while held and 0 on release.
 * - `suppress`: Suppress trigger fallback across binding.
 * - `suppressCancelFallback`: Clear `to_if_canceled` fallback channel.
 * - `modWhileDown`: Assert modifier while key is held down without hold threshold delay.
 * - `guardVar` / `guardMs`: Double-tap guard variable and timeout (ms).
 * - `ruleGroup`: Group ID and description to merge distinct triggers into one rule.
 * @returns An `OptionsWrapper` object.
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
 * Creates an `OptionsWrapper` specifying custom timing parameters for a binding.
 *
 * @param opts - Timing configuration object:
 * - `aloneMs`: `basic.to_if_alone_timeout_milliseconds` (default 1000ms). Max duration key can be held and still trigger `to_if_alone` upon release.
 * - `holdMs`: Hold duration threshold in milliseconds.
 * - `heldThresholdMs`: `basic.to_if_held_down_threshold_milliseconds` (default 500ms). Duration key must remain pressed before `to_if_held_down` fires.
 * - `delayedMs`: `basic.to_delayed_action_delay_milliseconds` (default 500ms). Delay before `to_delayed_action` triggers (for double-tap / multi-tap).
 * - `simultaneousMs`: `basic.simultaneous_threshold_milliseconds` (default 50ms). Time window for simultaneous chords.
 * @returns An `OptionsWrapper` containing the timing configuration.
 *
 * @example
 * ```ts
 * timing({ aloneMs: 200, holdMs: 200 })
 * timing({ heldThresholdMs: 300, delayedMs: 250 })
 * ```
 */
export function timing(opts: AcceptUndefined<NonNullable<Binding["timing"]>>): OptionsWrapper {
  return options({ timing: opts });
}

/**
 * Complete binding options specification, combining {@link BindingOptionsSpec} with optional trigger modifiers.
 *
 * Can be passed as the 3rd argument (`modifiersOrOptions`) or 4th argument (`options`) to:
 * - `bindKeys(keys, cases, modifiersOrOptions?, options?)`
 * - `bindPointer(pointer, cases, modifiersOrOptions?, options?)`
 * - `bindSimultaneous(keys, cases, modifiersOrOptions?, options?)` / `bindChord(...)`
 * - `bindTable(phase, table, modifiersOrOptions?, options?)`
 *
 * ### Accepted Properties:
 * - `modifiers` ({@link TriggerModifiers}): Trigger modifier keys (`["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`).
 * - `description` (`string`): Rule label in Karabiner Settings GUI and output JSON.
 * - `timing` ({@link BindingTiming}): Millisecond thresholds (`aloneMs`, `holdMs`, `heldThresholdMs`, `delayedMs`, `simultaneousMs`).
 * - `conditions` ({@link Condition}[]): Hoisted conditions applied across all manipulators in this binding.
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
  return (
    typeof val === "object" &&
    val !== null &&
    ("do" in val || "phase" in val || val instanceof CaseBuilder)
  );
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
  const unknown = Object.keys(value).filter(
    (k) => !(k in BINDING_OPTION_KEYS),
  );
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
  return (
    Array.isArray(val) ||
    (typeof val === "object" &&
      val !== null &&
      ("mandatory" in val || "optional" in val))
  );
}

/**
 * Flexible argument types accepted by {@link bind}.
 *
 * Supports:
 * - Action wrappers: `to(...)` containing cases
 * - Condition wrappers: `when(...)` containing conditions / state items
 * - Option wrappers: `options(...)` and `timing(...)`
 * - Individual `Case` or `Case[]` items (from `press()`, `release()`, `hold()`, `tapAndHold()`, etc.)
 * - Individual `Condition` or `Condition[]` items (from `ifApp()`, `ifDevice()`, `ifVar()`, etc.)
 * - Inline `BindingOptionsSpec` configuration objects
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
 * - Trigger builders: `from("a")`, `from("a", ["cmd"])`, `from({ keys: ["j", "k"], order: "strict" })`
 * - Action wrappers: `to(...)` containing case wrappers (`press()`, `release()`, `tap()`, `hold()`, `doubleTap()`, `doubleTapHold()`, `delayedSingleTap()`, `guard()`) and action builders (`key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`, `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`, `map()`, `noop()`, `actHere()`, `appHistory()`)
 * - Condition wrappers: `when(...)` containing condition builders (`state()`, `unless()`, `ifApp()`, `condApp()`, `unlessApp()`, `ifDevice()`, `ifUserVar()`, `unlessUserVar()`, etc.)
 * - Option wrappers: `options(...)` and `timing(...)` (or inline object literal options matching {@link BindingOptionsSpec})
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
export function bind(
  trigger: FromInput,
  ...args: BindArg[]
): Binding {
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

  const finalConditions = [
    ...(hoistedConditions.length ? hoistedConditions : []),
    ...(mergedOptions.conditions ?? []),
  ];

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
 * @param keys - Key code or array of key codes acting as the trigger (e.g. `"j"`, `["j", "k"]`).
 * @param cases - Action case or array of cases to execute when triggered (e.g. `press(...)`, `hold(...)`, `tapAndHold(...)`).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`) OR a full `BindingOptions` configuration object (with `description`, `timing`, `conditions`, `eventOptions`, `multiTap`, `suppress`, `ruleGroup`, etc.).
 * @param options - Additional `BindingOptions` if a modifier array/object was passed as the 3rd argument (`modifiersOrOptions`).
 * @returns A fully constructed `Binding` object for key triggers.
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
  return bind(triggerKeys(keys, modifiers), cases, restOpts);
}

/**
 * Creates a pointer button-triggered Karabiner `Binding`.
 *
 * @param pointer - Pointer button alias (e.g. `"button1"`, `"button4"`, `"right"`, `"left"`).
 * @param cases - Action case or array of cases to execute when triggered (e.g. `press(...)`, `hold(...)`, `tapAndHold(...)`).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`) OR a full `BindingOptions` configuration object (with `description`, `timing`, `conditions`, `eventOptions`, `multiTap`, `suppress`, `ruleGroup`, etc.).
 * @param options - Additional `BindingOptions` if a modifier array/object was passed as the 3rd argument (`modifiersOrOptions`).
 * @returns A fully constructed `Binding` object for pointer button triggers.
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
  return bind(triggerPointer(pointer, modifiers), cases, restOpts);
}

/**
 * Creates a simultaneous key chord-triggered Karabiner `Binding`.
 *
 * @param keys - Key code, pointer button, or array of keys acting as the simultaneous chord (e.g. `["j", "k"]`, `["left_option", "right_option"]`).
 * @param cases - Action case or array of cases to execute when chord is pressed (e.g. `press(...)`, `hold(...)`, `tapAndHold(...)`).
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["shift"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`) OR a full `BindingOptions` configuration object (with `description`, `timing`, `conditions`, `eventOptions`, `multiTap`, `suppress`, `ruleGroup`, etc.).
 * @param options - Additional `BindingOptions` if modifiers were supplied as the 3rd argument.
 * @returns A fully constructed `Binding` object for simultaneous triggers.
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
 * Alias for {@link bindSimultaneous}.
 */
export const bindChord = bindSimultaneous;

/**
 * Creates one `Binding` per table entry, all sharing the same trigger phase,
 * modifiers, and options — the case where a whole family of keys wraps one
 * action the same way (`focusWinRight`/`focusWinLeft`/`focusWinTop`/...).
 *
 * A table value is either:
 * - A bare action or registry primitive (`URLS.*`, `COMBOS.*`, `CMDS.*`, `APPS.*`) — auto-normalized and wrapped in `phase`.
 * - An action array `[action1, action2]`.
 * - A pre-built `Case` / `Case[]` (from `press()`, `hold()`, `.when(...)`, `tapAndHold()`, etc.) used as-is.
 *   This escape hatch allows individual entries to carry custom conditions or different phases.
 *
 * @param phase - Trigger phase (`"press"`, `"release"`, `"hold"`) applied to bare action entries.
 * @param table - Map of key codes to actions or pre-built cases: `Partial<Record<KeyCode, ActionInput | ActionInput[] | Case | Case[]>>`.
 * @param modifiersOrOptions - Optional trigger modifiers shared by every entry (e.g. `["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`) OR a full `BindingOptions` configuration object.
 * @param options - Additional `BindingOptions` shared by every entry, if modifiers were supplied as the 3rd argument.
 * @returns An array of `Binding` objects, one per table entry.
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
  modifiersOrOptions?: TriggerModifiers | BindingOptions,
  options?: BindingOptions,
): Binding[] {
  return (Object.keys(table) as KeyCode[]).map((keyCode) => {
    const value = table[keyCode] as ActionInput | ActionInput[] | Case | Case[];
    const cases = isCaseOrCaseArray(value)
      ? value
      : new CaseBuilder(phase, value as ActionInput | ActionInput[]);
    return bindKeys(keyCode, cases, modifiersOrOptions, options);
  });
}

/**
 * Options accepted by {@link motionToScroll} in the Snaplink DSL.
 */
export type MotionToScrollOptions = {
  /**
   * Human-readable label for this rule in Karabiner Settings and logs.
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
   * @example when: VARS.rButtonDown
   * @example when: [VARS.rButtonDown, DEVICES.g502X]
   * @example when: when(VARS.rButtonDown)
   */
  when?: WhenWrapper | Condition | Condition[] | StateItem | readonly StateItem[] | unknown;

  /**
   * Explicit condition list gating scroll mode.
   *
   * @example [condVar(VARS.rButtonDown)]
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
 * Construct a `motionToScroll` pointer tweak with full intellisense and type validation.
 *
 * Supports both object-based options (with `when: VARS.rButtonDown`, `trigger: "button4"`, etc.)
 * and fluent variadic syntax (`motionToScroll("description", VARS.rButtonDown, ...)`).
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
        if ("kind" in arg && (arg as any).kind === "when") {
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
      const resolved = when(arg as any);
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
      if ("kind" in c && (c as any).kind === "when") {
        conditions.push(...(c as WhenWrapper).conditions);
      } else {
        conditions.push(c as Condition);
      }
    }
  }
  if (opts.when) {
    if (typeof opts.when === "object" && opts.when !== null && "kind" in opts.when && (opts.when as any).kind === "when") {
      conditions.push(...(opts.when as WhenWrapper).conditions);
    } else {
      const resolved = when(opts.when as any);
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

export type PointerTransformOptions = {
  description: string;
  flip?: PointerTransform["flip"];
  swap?: PointerTransform["swap"];
  conditions?: Condition[];
  discard?: [PointerAxis, ...PointerAxis[]];
};

/**
 * Construct a `transform` pointer tweak to flip, swap, or discard pointer axes.
 *
 * @param options - Pointer transform configuration (flip, swap, discard, conditions).
 * @returns A validated {@link PointerTransform} tweak definition.
 *
 * @example
 * ```ts
 * pointerTransform({
 *   description: "Invert vertical scroll",
 *   flip: ["vertical_wheel"],
 * })
 * ```
 */
export function pointerTransform(options: PointerTransformOptions | PointerTransform): PointerTransform {
  return {
    kind: "transform",
    ...options,
  } as PointerTransform;
}



