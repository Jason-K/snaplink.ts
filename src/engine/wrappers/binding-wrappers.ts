import type {
  Binding,
  Case,
  Condition,
  KeyCode,
  PointerButtonAlias,
  TriggerModifiers,
} from "../../data";
import type { AcceptUndefined } from "../../types/util";
import type { WhenWrapper } from "./condition-wrappers";
import { conditionKind } from "../resolve-conditions";
import { from, type FromInput, triggerKeys, triggerPointer } from "./from-action-wrappers";
import { CaseBuilder, type ToWrapper } from "./to-action-wrappers";

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

