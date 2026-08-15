import type {
  AppSpec,
  Condition,
  DeviceSpec,
  PathSpec,
  VarSpec,
  VarValueSpec,
} from "../../data";
import type { InputSourceSpecifier, KeyboardType } from "../../types/karabiner";
import { STATES, VARS } from "../../data";

/**
 * Container wrapping one or more `Condition` objects created by {@link when}.
 */
export type WhenWrapper = {
  kind: "when";
  conditions: Condition[];
};

/**
 * Wraps one or more conditions into a `WhenWrapper` container for consumption by `bind()`.
 *
 * Accepts already-built `Condition`s (and arrays of them, as before) or bare
 * state specs — registry keys, apps, devices, vars, `[target, value]` tuples,
 * or `{ app/var, ... }` objects — resolved through the same machinery as
 * `state()`, so `when(APPS.word)` and `when(condApp(APPS.word))` produce an
 * identical condition. Each rest argument is resolved independently, so a
 * bare spec, a pre-built `Condition`, and an array of either can be mixed
 * freely in one call.
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
 * @param items - Conditions, condition arrays, bare state specs, or state spec arrays to combine.
 * @returns A `WhenWrapper` object.
 *
 * @example
 * ```ts
 * when(ifApp("com.apple.finder"), state("rButtonDown"))
 * when(unless(VARS.wheelDown), state(APPS.zen))
 * when(APPS.word)                 // bare spec, inferred via state()
 * when(APPS.word, VARS.wheelDown) // multiple bare specs
 * ```
 */
export function when(
  ...items: (StateItem | readonly StateItem[])[]
): WhenWrapper {
  const conditions = items.flatMap((item) => {
    const resolved = state(item as any) as Condition | Condition[];
    return Array.isArray(resolved) ? resolved : [resolved];
  });
  return { kind: "when", conditions };
}

function isAppSpec(val: unknown): val is AppSpec {
  return (
    typeof val === "object" &&
    val !== null &&
    ("bundleId" in val || "path" in val || (val as { type?: string }).type === "app")
  );
}

function isDeviceSpec(val: unknown): val is DeviceSpec {
  return (
    typeof val === "object" &&
    val !== null &&
    ("vendor_id" in val || "product_id" in val || "deviceDesc" in val || (val as { type?: string }).type === "device")
  );
}

function isAppSpecArray(val: unknown): val is (AppSpec | PathSpec | string)[] {
  if (!Array.isArray(val)) return false;
  return val.length > 0 && val.every(
    (v) =>
      isAppSpec(v) ||
      typeof v === "string" ||
      (typeof v === "object" && v !== null && "path" in v)
  );
}

function isDeviceSpecArray(val: unknown): val is DeviceSpec[] {
  if (!Array.isArray(val)) return false;
  return val.length > 0 && val.every((v) => isDeviceSpec(v));
}


function isVarValueSpec(val: unknown): val is VarValueSpec {
  return (
    typeof val === "object" &&
    val !== null &&
    "ref" in val &&
    "value" in val
  );
}

function isVarSpec(val: unknown): val is VarSpec {
  return (
    typeof val === "object" &&
    val !== null &&
    "name" in val &&
    "varDesc" in val
  );
}

function isCondition(val: unknown): val is Condition {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    "app" in obj ||
    "var" in obj ||
    "device" in obj ||
    (typeof obj.type === "string" && obj.type.startsWith("expression_"))
  );
}

function isSpecOrItem(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (Array.isArray(val)) return true;
  if (typeof val === "object") {
    return (
      isAppSpec(val) ||
      isDeviceSpec(val) ||
      isVarSpec(val) ||
      isVarValueSpec(val) ||
      isCondition(val) ||
      "var" in val ||
      "app" in val
    );
  }
  if (typeof val === "string") {
    return val in STATES || val in VARS;
  }
  return false;
}

/**
 * Creates a variable condition matching a `VarSpec` or `VarValueSpec`.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equalsOrUnless - Value to match, boolean for `unless`, or `{ unless?: boolean }` options.
 * @param unlessOrOpts - Optional boolean for `unless`, or `{ unless?: boolean }` options.
 * @returns A `Condition` object.
 *
 * @example
 * ```ts
 * ifUserVar(VARS.rButtonDown, 1)
 * ifUserVar(STATES.rButtonDown)
 * ```
 */
export function ifUserVar(
  varOrValueSpec: VarSpec | VarValueSpec,
  equalsOrUnless?: string | number | boolean | VarValueSpec | { unless?: boolean },
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  if (isVarValueSpec(varOrValueSpec)) {
    const unless =
      typeof equalsOrUnless === "boolean"
        ? equalsOrUnless
        : typeof equalsOrUnless === "object" && equalsOrUnless !== null && "unless" in equalsOrUnless
          ? Boolean(equalsOrUnless.unless)
          : typeof unlessOrOpts === "boolean"
            ? unlessOrOpts
            : Boolean(unlessOrOpts?.unless);
    return {
      var: varOrValueSpec.ref,
      equals: varOrValueSpec.value,
      ...(unless ? { unless: true } : {}),
      ...(varOrValueSpec.varDesc ? { description: varOrValueSpec.varDesc } : {}),
    };
  }

  let equals: string | number | boolean =
    typeof equalsOrUnless === "string" || typeof equalsOrUnless === "number" || typeof equalsOrUnless === "boolean"
      ? equalsOrUnless
      : 1;

  if (isVarValueSpec(equalsOrUnless)) {
    equals = equalsOrUnless.value;
  }

  const unless =
    typeof unlessOrOpts === "boolean"
      ? unlessOrOpts
      : Boolean(unlessOrOpts?.unless);

  return {
    var: varOrValueSpec,
    equals,
    ...(unless ? { unless: true } : {}),
  };
}

/**
 * Creates a negated variable condition matching a `VarSpec` or `VarValueSpec`.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equals - Optional value expected NOT to match.
 * @returns A `Condition` object with `unless: true`.
 *
 * @example
 * ```ts
 * unlessUserVar(VARS.rButtonDown, 1)
 * unlessUserVar(STATES.rButtonDown)
 * ```
 */
export function unlessUserVar(
  varOrValueSpec: VarSpec | VarValueSpec,
  equals?: string | number | boolean | VarValueSpec,
): Condition {
  if (isVarValueSpec(varOrValueSpec)) {
    return ifUserVar(varOrValueSpec, true);
  }
  return ifUserVar(varOrValueSpec, equals, true);
}

/**
 * Creates a condition for a Karabiner-Elements variable. Alias for `ifUserVar`.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equalsOrUnless - Value to match, boolean for `unless`, or options.
 * @param unlessOrOpts - Optional boolean for `unless`, or options.
 * @returns A `Condition` object.
 *
 * @example
 * ```ts
 * ifKeVar(STATES.isTextField)
 * ```
 */
export function ifKeVar(
  varOrValueSpec: VarSpec | VarValueSpec,
  equalsOrUnless?: string | number | boolean | VarValueSpec | { unless?: boolean },
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  return ifUserVar(varOrValueSpec, equalsOrUnless, unlessOrOpts);
}

/**
 * Creates a negated condition for a Karabiner-Elements variable. Alias for `unlessUserVar`.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equals - Optional value expected NOT to match.
 * @returns A `Condition` object with `unless: true`.
 *
 * @example
 * ```ts
 * unlessKeVar(STATES.isSecureInputSubrole)
 * ```
 */
export function unlessKeVar(
  varOrValueSpec: VarSpec | VarValueSpec,
  equals?: string | number | boolean | VarValueSpec,
): Condition {
  return unlessUserVar(varOrValueSpec, equals);
}

/** Alias for {@link ifUserVar}. */
export const condVar = ifUserVar;
/** Alias for {@link ifUserVar}. */
export const ifVar = ifUserVar;
/** Alias for {@link unlessUserVar}. */
export const condNotVar = unlessUserVar;

/**
 * Creates an application condition.
 *
 * @param app - AppSpec, PathSpec, string bundle ID/path, or list of apps.
 * @param isForemost - True for frontmost application matching; false for unless (not frontmost).
 * @returns A `Condition` object.
 *
 * @example
 * ```ts
 * condApp("com.apple.finder")
 * ```
 */
export function condApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
  isForemost = true,
): Condition {
  return {
    app,
    ...(!isForemost ? { unless: true } : {}),
  };
}

/** Alias for {@link condApp}. */
export const ifApp = condApp;

/**
 * Creates a negated application condition (unless application is frontmost).
 *
 * @param app - AppSpec, PathSpec, string bundle ID/path, or list of apps.
 * @returns A `Condition` object with `unless: true`.
 *
 * @example
 * ```ts
 * condNotApp("com.apple.finder")
 * ```
 */
export function condNotApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
): Condition {
  return condApp(app, false);
}

/** Alias for {@link condNotApp}. */
export const unlessApp = condNotApp;

/**
 * Creates a hardware device condition.
 *
 * @param device - Target `DeviceSpec`.
 * @param unlessOrOpts - Optional boolean for `unless`, or `{ unless?: boolean }` options.
 * @returns A `Condition` object.
 *
 * @example
 * ```ts
 * condDevice(DEVICES.appleKeyboard)
 * ```
 */
export function condDevice(
  device: DeviceSpec,
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  const unless =
    typeof unlessOrOpts === "boolean"
      ? unlessOrOpts
      : Boolean(unlessOrOpts?.unless);
  return {
    device,
    ...(unless ? { unless } : {}),
  };
}

/** Alias for {@link condDevice}. */
export const ifDevice = condDevice;

/**
 * Whether a device is **connected**, regardless of what produced the event.
 *
 * `condDevice` tests the event's own source, so it cannot express "while the
 * mouse is plugged in" for a keystroke typed on the built-in keyboard — that is
 * what this is for (KE 14.8.4+, gotcha 8.5).
 *
 * @example
 * ```ts
 * when(condDeviceExists(DEVICES.g502X))
 * ```
 */
export function condDeviceExists(
  deviceExists: DeviceSpec,
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  const unless =
    typeof unlessOrOpts === "boolean" ? unlessOrOpts : Boolean(unlessOrOpts?.unless);
  return { deviceExists, ...(unless ? { unless } : {}) };
}

/** Alias for {@link condDeviceExists}. */
export const ifDeviceExists = condDeviceExists;

/**
 * The **virtual** keyboard type configured in Karabiner, not the physical
 * device (gotcha 8.6). Note `[` is `close_bracket` on JIS.
 *
 * @example
 * ```ts
 * when(condKeyboardType("jis"))
 * ```
 */
export function condKeyboardType(
  keyboardType: KeyboardType | KeyboardType[],
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  const unless =
    typeof unlessOrOpts === "boolean" ? unlessOrOpts : Boolean(unlessOrOpts?.unless);
  return { keyboardType, ...(unless ? { unless } : {}) };
}

/** Alias for {@link condKeyboardType}. */
export const ifKeyboardType = condKeyboardType;

/**
 * Active input source. Every field is a regular expression; entries are ORed
 * and keys within one entry are ANDed (gotchas 8.1, 8.2).
 *
 * @example
 * ```ts
 * when(condInputSource({ language: "^en$" }))
 * ```
 */
export function condInputSource(
  inputSource: InputSourceSpecifier | InputSourceSpecifier[],
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  const unless =
    typeof unlessOrOpts === "boolean" ? unlessOrOpts : Boolean(unlessOrOpts?.unless);
  return { inputSource, ...(unless ? { unless } : {}) };
}

/** Alias for {@link condInputSource}. */
export const ifInputSource = condInputSource;

/**
 * Whether Simple Modifications already rewrote this event (gotcha 2.5).
 *
 * Simple Modifications run *before* Complex Modifications, so a remapped key
 * arrives here as the new key. This is how Function Keys Modifications are
 * stopped from re-changing an fx key that a complex rule already handled.
 *
 * @example
 * ```ts
 * when(condEventChanged(false))   // only untouched events
 * ```
 */
export function condEventChanged(
  eventChanged: boolean,
  unlessOrOpts?: boolean | { unless?: boolean },
): Condition {
  const unless =
    typeof unlessOrOpts === "boolean" ? unlessOrOpts : Boolean(unlessOrOpts?.unless);
  return { eventChanged, ...(unless ? { unless } : {}) };
}

/** Alias for {@link condEventChanged}. */
export const ifEventChanged = condEventChanged;

function resolveSingleState(target: unknown, valOverride?: unknown): Condition {
  const isBoolNegated =
    valOverride === false ||
    (typeof valOverride === "object" && valOverride !== null && Boolean((valOverride as { unless?: boolean }).unless));

  if (isAppSpec(target) || isAppSpecArray(target)) {
    const isForemost = !(valOverride === false || valOverride === 0 || isBoolNegated);
    return condApp(target as any, isForemost);
  }

  if (isDeviceSpec(target) || isDeviceSpecArray(target)) {
    const unless = valOverride === false || valOverride === 0 || isBoolNegated;
    return condDevice(target as any, unless);
  }

  if (isCondition(target)) {
    const cond = target as Condition;
    return isBoolNegated ? { ...cond, unless: true } : cond;
  }

  if (typeof target === "string" && target in STATES) {
    const spec = STATES[target as keyof typeof STATES];
    if (isBoolNegated) {
      return ifUserVar(spec, true);
    }
    if (valOverride !== undefined && typeof valOverride !== "boolean") {
      return ifUserVar(spec.ref, valOverride as string | number);
    }
    return ifUserVar(spec);
  }

  if (isVarValueSpec(target)) {
    if (isBoolNegated) {
      return ifUserVar(target, true);
    }
    if (valOverride !== undefined && typeof valOverride !== "boolean") {
      return ifUserVar(target.ref, valOverride as string | number);
    }
    return ifUserVar(target);
  }

  if (typeof target === "string" && target in VARS) {
    const spec = VARS[target as keyof typeof VARS];
    if (isBoolNegated) {
      return ifUserVar(spec, 1, true);
    }
    const val = valOverride !== undefined ? (valOverride as string | number | boolean) : 1;
    return ifUserVar(spec, val);
  }

  if (isVarSpec(target)) {
    if (isBoolNegated) {
      return ifUserVar(target, 1, true);
    }
    const val = valOverride !== undefined ? (valOverride as string | number | boolean) : 1;
    return ifUserVar(target, val);
  }

  if (typeof target === "string") {
    return condApp(target, !isBoolNegated);
  }

  throw new Error(`Invalid state specification: ${JSON.stringify(target)}`);
}

function resolveStateItem(item: unknown): Condition {
  if (Array.isArray(item)) {
    if (isAppSpecArray(item) || isDeviceSpecArray(item)) {
      return resolveSingleState(item, undefined);
    }
    const [target, valOverride] = item;
    return resolveSingleState(target, valOverride);
  }

  if (
    typeof item === "object" &&
    item !== null &&
    !isAppSpec(item) &&
    !isDeviceSpec(item) &&
    !isVarValueSpec(item) &&
    !isVarSpec(item) &&
    !isCondition(item)
  ) {
    const obj = item as Record<string, unknown>;
    if ("var" in obj) {
      const val = obj.value ?? obj.equals ?? (obj.unless ? false : 1);
      return resolveSingleState(obj.var, val);
    }
    if ("app" in obj) {
      const val = obj.value ?? (obj.unless ? false : true);
      return resolveSingleState(obj.app, val);
    }
  }

  return resolveSingleState(item, undefined);
}

/**
 * Inputs accepted as targets for state conditions (registry keys, specs, app/device/path specs, or raw strings).
 */
export type StateSpecInput =
  | keyof typeof STATES
  | keyof typeof VARS
  | VarValueSpec
  | VarSpec
  | AppSpec
  | DeviceSpec
  | PathSpec
  | Condition
  | string;

/**
 * Tuple representation `[target, value]` for overriding expected state values.
 */
export type StateTuple =
  | [StateSpecInput, string | number | boolean]
  | readonly [StateSpecInput, string | number | boolean]
  | (StateSpecInput | string | number | boolean)[];

/**
 * Explicit variable or app condition specification object.
 */
export type StateObject =
  | { var: StateSpecInput; value?: string | number | boolean; equals?: string | number | boolean; unless?: boolean }
  | { app: StateSpecInput; value?: string | number | boolean; unless?: boolean };

/**
 * Supported state items in {@link state} and {@link unless} conditions.
 */
export type StateItem =
  | StateSpecInput
  | StateTuple
  | StateObject;

/**
 * Flexible condition builder evaluating state specifications (`STATES`, `VARS`, apps, devices, or tuple overrides).
 * Assumes specified items are required to be true/active unless explicitly overridden (e.g. `[VARS.wheelDown, 0]`).
 *
 * @param tuple - A `[target, value]` tuple pair override.
 * @returns A single `Condition` object.
 *
 * @example
 * ```ts
 * state([VARS.wheelDown, 0])
 * state([APPS.zen, false])
 * ```
 */
export function state(
  tuple: [StateSpecInput, string | number | boolean] | readonly [StateSpecInput, string | number | boolean],
): Condition;
/**
 * Evaluates a single state, variable, app, or device specification.
 *
 * @param item - Target specification or registry key.
 * @param value - Optional expected comparison value or boolean options.
 * @returns A single `Condition` object.
 *
 * @example
 * ```ts
 * state(APPS.zen)
 * state("rButtonDown")
 * state(VARS.rButtonDown, 1)
 * ```
 */
export function state(
  item: StateSpecInput,
  value?: string | number | boolean | { unless?: boolean },
): Condition;
/**
 * Evaluates an array of state specifications.
 *
 * @param items - Array of state items or tuple overrides.
 * @returns An array of `Condition` objects.
 *
 * @example
 * ```ts
 * state([APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0]])
 * ```
 */
export function state(
  items: readonly (StateItem | [StateSpecInput, string | number | boolean])[],
): Condition[];
/**
 * Evaluates multiple state specifications as rest parameters.
 *
 * @param first - First state specification or tuple override.
 * @param second - Second state specification or tuple override.
 * @param rest - Additional state specifications.
 * @returns An array of `Condition` objects.
 *
 * @example
 * ```ts
 * state(APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0])
 * ```
 */
export function state(
  first: StateItem,
  second: StateItem,
  ...rest: StateItem[]
): Condition[];
export function state(
  arg1: unknown,
  ...rest: unknown[]
): Condition | Condition[] {
  if (Array.isArray(arg1) && rest.length === 0) {
    if (
      arg1.length === 2 &&
      !Array.isArray(arg1[0]) &&
      isSpecOrItem(arg1[0]) &&
      !isSpecOrItem(arg1[1])
    ) {
      return resolveStateItem(arg1);
    }
    return (arg1 as unknown[]).map((item) => resolveStateItem(item));
  }

  if (rest.length === 1 && !isSpecOrItem(rest[0])) {
    return resolveSingleState(arg1, rest[0]);
  }

  if (rest.length > 0) {
    return [arg1, ...rest].map((item) => resolveStateItem(item));
  }

  return resolveStateItem(arg1);
}

/** Alias for {@link state}. */
export const condState = state;
/** Alias for {@link state}. */
export const ifState = state;

/**
 * Condition builder enforcing that all specified items must be false/inactive/negated.
 *
 * @param items - Array of state items to require as false/negated.
 * @returns An array of negated `Condition` objects.
 *
 * @example
 * ```ts
 * unless([VARS.rButtonDown, VARS.wheelDown])
 * ```
 */
export function unless(
  items: readonly (StateItem | [StateSpecInput, string | number | boolean])[],
): Condition[];
/**
 * Enforces multiple state specifications to be false/inactive/negated as rest parameters.
 *
 * @param first - First state item to require false.
 * @param second - Second state item to require false.
 * @param rest - Additional state items to require false.
 * @returns An array of negated `Condition` objects.
 *
 * @example
 * ```ts
 * unless(VARS.rButtonDown, VARS.wheelDown, APPS.zen)
 * ```
 */
export function unless(
  first: StateItem,
  second: StateItem,
  ...rest: StateItem[]
): Condition[];
/**
 * Enforces a single state specification to be false/inactive/negated.
 *
 * @param item - Target state item to require false.
 * @returns A single negated `Condition` object.
 *
 * @example
 * ```ts
 * unless("rButtonDown")
 * unless(APPS.zen)
 * ```
 */
export function unless(
  item: StateSpecInput,
): Condition;
export function unless(
  arg1: unknown,
  ...rest: unknown[]
): Condition | Condition[] {
  if (Array.isArray(arg1) && rest.length === 0) {
    return (arg1 as unknown[]).map((item) => resolveSingleState(item, false));
  }
  if (rest.length > 0) {
    return [arg1, ...rest].map((item) => resolveSingleState(item, false));
  }
  return resolveSingleState(arg1, false);
}

/** Alias for {@link unless}. */
export const condUnless = unless;

