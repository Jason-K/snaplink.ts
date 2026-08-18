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
  TriggerModifiers,
  VarSpec,
} from "../../data";
import type { AcceptUndefined } from "../../types/util";
import type { PointerAxis } from "../../types/karabiner";
import { when, type StateItem, type WhenWrapper } from "./condition-wrappers";
import { conditionKind } from "../resolve-conditions";
import { from, type FromInput, triggerKeys, triggerPointer } from "./from-action-wrappers";
import { CaseBuilder, type ActionInput, type ToWrapper } from "./to-action-wrappers";

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
 * @param opts - Partial binding options (e.g. `description`, `timing`, `suppress`, `ruleGroup`).
 * @returns An `OptionsWrapper` object.
 *
 * @example
 * ```ts
 * options({ description: "Toggle app window", suppress: true })
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
 * @param opts - Timing configuration object specifying delays, hold thresholds, and repeat parameters.
 * @returns An `OptionsWrapper` containing the timing configuration.
 *
 * @example
 * ```ts
 * timing({ holdMs: 200, tapMs: 150 })
 * ```
 */
export function timing(opts: AcceptUndefined<NonNullable<Binding["timing"]>>): OptionsWrapper {
  return options({ timing: opts });
}

/**
 * Binding options specification combined with optional trigger modifiers.
 */
export type BindingOptions = BindingOptionsSpec & {
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
 * Supports action wrappers (`ToWrapper`), condition wrappers (`WhenWrapper`),
 * option wrappers (`OptionsWrapper`), single or array of `Case` items,
 * single or array of `Condition` items, and inline `BindingOptionsSpec` objects.
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
 * - Action wrappers: `to(...)` containing case wrappers (`press()`, `release()`, `tap()`, `hold()`, `doubleTap()`, `doubleTapHold()`, `delayedSingleTap()`, `guard()`) and action builders (`key()`, `button()`, `app()`, `url()`, `folder()`, `cmd()`, `shell()`, `python()`, `osascript()`, `setVar()`, `cut()`, `copy()`, `paste()`, `sequence()`, `map()`, `noop()`, `actHere()`, `appHistory()`)
 * - Condition wrappers: `when(...)` containing condition builders (`state()`, `unless()`, `ifApp()`, `condApp()`, `unlessApp()`, `ifDevice()`, `ifUserVar()`, `unlessUserVar()`, etc.)
 * - Option wrappers: `options(...)` and `timing(...)` (or inline object literal options matching `BindingOptionsSpec`)
 *
 * @param trigger - The input trigger specification (key code, pointer button, trigger object, or array of inputs).
 * @param args - Combination of action cases (`press()`, `to()`), conditions (`when()`, `ifApp()`), and options (`options()`, `timing()`, or object literal options).
 * @returns A fully constructed `Binding` object.
 *
 * @example
 * ```ts
 * bind(
 *   from("a"),
 *   to(press(key("b", ["cmd"]))),
 *   when(ifApp("com.apple.finder")),
 *   options({ description: "Map 'a' to Cmd+B in Finder" })
 * );
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
 * @param keys - Key code or array of key codes acting as the trigger.
 * @param cases - Action case or array of cases to execute when triggered.
 * @param modifiersOrOptions - Optional trigger modifiers (e.g. `["cmd", "opt"]`) or `BindingOptions`.
 * @param options - Additional binding options if modifiers were supplied as the 3rd argument.
 * @returns A fully constructed `Binding` object for key triggers.
 *
 * @example
 * ```ts
 * bindKeys(
 *   "j",
 *   press(key("down_arrow")),
 *   ["cmd"],
 *   { description: "Cmd+J triggers Down Arrow" }
 * );
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
 * @param pointer - Pointer button alias (e.g. `"button1"`, `"right"`, `"left"`).
 * @param cases - Action case or array of cases to execute when triggered.
 * @param modifiersOrOptions - Optional trigger modifiers or `BindingOptions`.
 * @param options - Additional binding options if modifiers were supplied as the 3rd argument.
 * @returns A fully constructed `Binding` object for pointer button triggers.
 *
 * @example
 * ```ts
 * bindPointer(
 *   "button4",
 *   press(key("bracket_left", ["cmd"])),
 *   undefined,
 *   { description: "Mouse button 4 triggers Cmd+[" }
 * );
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
 * Creates one `Binding` per table entry, all sharing the same trigger phase,
 * modifiers, and options — the case where a whole family of keys wraps one
 * action the same way (`focusWinRight`/`focusWinLeft`/`focusWinTop`/...).
 *
 * A table value is either an action — auto-normalized the same way
 * `press()`/`release()`/`hold()`/`tap()` normalize registry primitives (see
 * {@link ActionInput}) — wrapped in `phase` for that entry, or an
 * already-built `Case`/`Case[]` (from `press()`, `hold()`, `.when(...)`,
 * `tapAndHold()`, etc.) used as-is. That escape hatch means one entry needing
 * its own condition, or a different phase than the rest of the table, does
 * not force the whole table back to individual `bind()` calls.
 *
 * @param phase - Trigger phase applied to every entry that is a bare action rather than a pre-built `Case`.
 * @param table - Map of key code to action(s) or pre-built case(s).
 * @param modifiersOrOptions - Optional trigger modifiers, shared by every entry, or `BindingOptions`.
 * @param options - Additional binding options, shared by every entry, if modifiers were supplied as the 3rd argument.
 * Inherited from `bindKeys()`: to skip modifiers and pass options, pass
 * `options` as the 3rd argument, not the 4th — an explicit `undefined` 3rd
 * argument is not equivalent to omitting it, and the 4th argument is
 * silently dropped in that case.
 * @returns One `Binding` per table entry. Order follows JavaScript's own
 * object-key iteration — ascending numeric-string keys (`"0"`-`"9"`, etc.)
 * first, then the rest in declaration order — not necessarily literal table
 * order when the two are mixed. Harmless for these bindings since each entry
 * targets a distinct key trigger, but worth knowing if diffing exact array
 * position (e.g. against a golden-output fixture).
 *
 * @example
 * ```ts
 * // Before:
 * bind(from("e", VM.COCS), to(release(map(COMBOS.focusWinRight)))),
 * bind(from("f", VM.COCS), to(release(map(COMBOS.focusWinBottom)))),
 * bind(from("q", VM.COCS), to(release(map(COMBOS.focusWinLeft)))),
 * bind(from("r", VM.COCS), to(release(map(COMBOS.focusWinTop)))),
 * // After:
 * bindTable("release", {
 *   e: COMBOS.focusWinRight,
 *   f: COMBOS.focusWinBottom,
 *   q: COMBOS.focusWinLeft,
 *   r: COMBOS.focusWinTop,
 * }, VM.COCS)
 *
 * // A pre-built Case overrides the table's phase/conditions for one entry:
 * bindTable("hold", {
 *   n: shell(CMDS.neruHints),
 *   p: hold(map(COMBOS.showPopclip)).when(condApp(APPS.finder)),
 * })
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



