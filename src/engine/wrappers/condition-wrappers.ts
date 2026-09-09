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

// Type-only imports to enable IDE IntelliSense {@link ...} symbol resolution in JSDoc comments.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { APPS, DEVICES } from "../../data";
import type { bind, bindKeys } from "./binding-wrappers";
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Container wrapping one or more {@link Condition} objects created by {@link when}.
 * Consumed by {@link bind} or passed to case wrappers (`.when(...)`).
 */
export type WhenWrapper = {
  kind: "when";
  conditions: Condition[];
};

/**
 * Groups one or more conditions into a hoisted {@link WhenWrapper} container for consumption by {@link bind} or case builders.
 *
 * Use when gating bindings or action cases to activate only when specific conditions are met (such as frontmost applications,
 * connected devices, active input sources, or Karabiner variable states).
 *
 * Accepts pre-built {@link Condition}s (e.g. from {@link ifApp}, {@link ifDevice}, {@link ifUserVar}, {@link state}, {@link unless})
 * or bare state specs (`APPS.*`, `DEVICES.*`, `STATES.*`, `VARS.*`, `[target, value]` tuples) that are automatically resolved via {@link state}.
 *
 * ### Recognized condition wrappers:
 * - {@link state} / {@link condState} / {@link ifState} — evaluates state specs, registry keys (`STATES`, `VARS`), apps, devices, or `[target, value]` tuples
 * - {@link unless} / {@link condUnless} — enforces state specs, registry keys, apps, or devices to be false/negated
 * - {@link ifApp} / {@link condApp} — matches frontmost application(s)
 * - {@link unlessApp} / {@link condNotApp} — matches when application(s) are NOT frontmost
 * - {@link ifDevice} / {@link condDevice} — matches physical hardware event source devices
 * - {@link ifDeviceExists} / {@link condDeviceExists} — matches connected devices regardless of event source
 * - {@link ifUserVar} / {@link ifKeVar} / {@link condVar} / {@link ifVar} — matches Karabiner variable values
 * - {@link unlessUserVar} / {@link unlessKeVar} / {@link condNotVar} — matches when variable values do NOT match
 * - {@link ifKeyboardType} / {@link condKeyboardType} — matches virtual keyboard type (`"ansi"`, `"iso"`, `"jis"`)
 * - {@link ifInputSource} / {@link condInputSource} — matches active keyboard input source language/layout
 * - {@link ifEventChanged} / {@link condEventChanged} — matches whether event was rewritten by Simple Modifications
 *
 * @param items - Conditions, condition arrays, bare state specs, or state spec arrays to combine.
 * @returns A {@link WhenWrapper} object containing the resolved condition list.
 *
 * @example
 * ```ts
 * // 1. Pre-built condition helpers:
 * when(ifApp("com.apple.finder"), ifUserVar(VARS.rButtonDown, 1))
 *
 * // 2. Negated conditions:
 * when(unlessApp(APPS.excel), unless(VARS.wheelDown))
 *
 * // 3. Bare state specs (automatically inferred via state()):
 * when(APPS.word, VARS.wheelDown)
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
 * Creates a condition matching a Karabiner state variable (`VarSpec` or `VarValueSpec`).
 *
 * Use when restricting a binding or action case to trigger only when a specific Karabiner variable equals an expected value
 * (e.g. tracking layer state, modifier holds, or mode toggles).
 *
 * @param varOrValueSpec - Variable spec (e.g. `VARS.rButtonDown`, `STATES.isTextField`) or variable value spec reference.
 * @param equalsOrUnless - Expected value to match (defaults to `1`), boolean for `unless`, or `{ unless?: boolean }` options.
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * // 1. Variable equals 1:
 * ifUserVar(VARS.rButtonDown)
 *
 * // 2. Variable equals specific numeric or string value:
 * ifUserVar(VARS.layerMode, 2)
 *
 * // 3. From pre-defined state spec:
 * ifUserVar(STATES.isTextField)
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
 * Creates a negated condition for a Karabiner state variable (`VarSpec` or `VarValueSpec`).
 *
 * Use when restricting a binding or action case to trigger only when a specific Karabiner variable does NOT equal a given value.
 *
 * @param varOrValueSpec - Variable spec (e.g. `VARS.rButtonDown`, `STATES.isSecureInputSubrole`) or variable value spec reference.
 * @param equals - Expected value NOT to match (defaults to `1`).
 * @returns A {@link Condition} object with `unless: true`.
 *
 * @example
 * ```ts
 * // 1. Variable is NOT set to 1:
 * unlessUserVar(VARS.rButtonDown)
 *
 * // 2. State is NOT active:
 * unlessUserVar(STATES.isSecureInputSubrole)
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
 * Creates a condition for a Karabiner-Elements variable. Alias for {@link ifUserVar}.
 *
 * Use when gating bindings on Karabiner variable states.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equalsOrUnless - Value to match, boolean for `unless`, or options.
 * @param unlessOrOpts - Optional boolean for `unless`, or options.
 * @returns A {@link Condition} object.
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
 * Creates a negated condition for a Karabiner-Elements variable. Alias for {@link unlessUserVar}.
 *
 * Use when gating bindings to activate only when a variable does not match a value.
 *
 * @param varOrValueSpec - Variable spec or variable value spec reference.
 * @param equals - Optional value expected NOT to match.
 * @returns A {@link Condition} object with `unless: true`.
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

/** Alias for {@link ifUserVar}. Creates a variable condition matching a Karabiner state variable. */
export const condVar = ifUserVar;
/** Alias for {@link ifUserVar}. Creates a variable condition matching a Karabiner state variable. */
export const ifVar = ifUserVar;
/** Alias for {@link unlessUserVar}. Creates a negated variable condition matching a Karabiner state variable. */
export const condNotVar = unlessUserVar;

/**
 * Creates an application condition restricting a binding to when specified apps are frontmost.
 *
 * Use when scoping bindings or shortcuts to specific macOS applications (e.g. Finder, Xcode, Safari, VS Code).
 *
 * @param app - {@link AppSpec} (e.g. `APPS.finder`), {@link PathSpec}, bundle ID string (e.g. `"com.apple.finder"`), or array of apps.
 * @param isForemost - True for frontmost application matching; false for unless (not frontmost). Defaults to `true`.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * // 1. Single app spec:
 * condApp(APPS.finder)
 *
 * // 2. String bundle ID:
 * condApp("com.apple.finder")
 *
 * // 3. Multiple apps:
 * condApp([APPS.safari, APPS.zen])
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

/** Alias for {@link condApp}. Creates an application condition restricting a binding to frontmost apps. */
export const ifApp = condApp;

/**
 * Creates a negated application condition restricting a binding to when specified apps are NOT frontmost.
 *
 * Use when excluding bindings or shortcuts from activating in specific macOS applications (e.g. avoiding conflicts in games or IDEs).
 *
 * @param app - {@link AppSpec} (e.g. `APPS.excel`), {@link PathSpec}, bundle ID string, or array of apps.
 * @returns A {@link Condition} object with `unless: true`.
 *
 * @example
 * ```ts
 * // 1. Single app exclusion:
 * unlessApp(APPS.excel)
 *
 * // 2. Multiple app exclusions:
 * condNotApp([APPS.figma, APPS.photoshop])
 * ```
 */
export function condNotApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
): Condition {
  return condApp(app, false);
}

/** Alias for {@link condNotApp}. Creates a negated application condition. */
export const unlessApp = condNotApp;

/**
 * Creates a hardware device condition matching the physical event source device.
 *
 * Use when restricting a binding or hotkey to events originating from a specific physical keyboard, mouse, or trackball.
 *
 * @param device - Target {@link DeviceSpec} (e.g. `DEVICES.g502X`, `DEVICES.appleKeyboard`).
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * condDevice(DEVICES.g502X)
 * ifDevice(DEVICES.appleKeyboard)
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

/** Alias for {@link condDevice}. Creates a hardware event source device condition. */
export const ifDevice = condDevice;

/**
 * Creates a condition testing whether a hardware device is currently connected to the system.
 *
 * Use when activating bindings only while a specific external keyboard, mouse, or accessory is plugged in / paired,
 * regardless of which device produced the input event.
 *
 * @param deviceExists - Target {@link DeviceSpec} to check connection status.
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * // 1. Active while external mouse is connected:
 * condDeviceExists(DEVICES.g502X)
 *
 * // 2. Active only on internal keyboard when external keyboard is disconnected:
 * ifDeviceExists(DEVICES.externalKeyboard, true)
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

/** Alias for {@link condDeviceExists}. Creates a condition testing whether a device is connected. */
export const ifDeviceExists = condDeviceExists;

/**
 * Creates a condition matching the virtual keyboard layout type configured in Karabiner.
 *
 * Use when restricting key bindings to specific physical virtual layout types (`"ansi"`, `"iso"`, `"jis"`).
 *
 * @param keyboardType - {@link KeyboardType} or array of types (`"ansi"`, `"iso"`, or `"jis"`).
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * condKeyboardType("jis")
 * ifKeyboardType(["ansi", "iso"])
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

/** Alias for {@link condKeyboardType}. Creates a virtual keyboard layout type condition. */
export const ifKeyboardType = condKeyboardType;

/**
 * Creates a condition matching the active keyboard input source language or layout ID.
 *
 * Use when restricting key mappings to specific language input methods (e.g. English, Japanese, French).
 * Every field is a regular expression; multiple criteria are evaluated according to Karabiner regex matching rules.
 *
 * @param inputSource - {@link InputSourceSpecifier} or array of specifiers (language regex, input source ID regex).
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * // 1. English language input source:
 * condInputSource({ language: "^en$" })
 *
 * // 2. Specific layout ID:
 * ifInputSource({ input_source_id: "^com\\.apple\\.keylayout\\.US$" })
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

/** Alias for {@link condInputSource}. Creates an active input source condition. */
export const ifInputSource = condInputSource;

/**
 * Creates a condition checking whether Simple Modifications already rewrote this event.
 *
 * Use when differentiating between untouched raw hardware events and events previously modified by Simple Modifications
 * or Function Keys Modifications.
 *
 * @param eventChanged - Boolean indicating whether the event has been modified (`true` for modified, `false` for untouched).
 * @param unlessOrOpts - Optional boolean for `unless` (negation), or `{ unless?: boolean }` options.
 * @returns A {@link Condition} object.
 *
 * @example
 * ```ts
 * condEventChanged(false) // Only activate on untouched events
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

/** Alias for {@link condEventChanged}. Creates an event changed status condition. */
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
 * Tuple representation `[target, value]` for overriding expected state values in {@link state} and {@link when}.
 */
export type StateTuple =
  | [StateSpecInput, string | number | boolean]
  | readonly [StateSpecInput, string | number | boolean]
  | (StateSpecInput | string | number | boolean)[];

/**
 * Explicit variable or app condition specification object for {@link state} and {@link when}.
 */
export type StateObject =
  | { var: StateSpecInput; value?: string | number | boolean; equals?: string | number | boolean; unless?: boolean }
  | { app: StateSpecInput; value?: string | number | boolean; unless?: boolean };

/**
 * Supported state items accepted by {@link state}, {@link unless}, and {@link when}.
 */
export type StateItem =
  | StateSpecInput
  | StateTuple
  | StateObject;

/**
 * Flexible condition builder evaluating state specifications (`STATES`, `VARS`, apps, devices, or `[target, value]` tuples).
 *
 * Use when constructing conditions from mixed inputs (registry specs, variable targets, app definitions, or value override tuples).
 * Assumes specified items are required to be true/active unless explicitly overridden (e.g. `[VARS.wheelDown, 0]`).
 *
 * @param tuple - A `[target, value]` tuple pair override.
 * @returns A single {@link Condition} object.
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
 * @returns A single {@link Condition} object.
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
 * @returns An array of {@link Condition} objects.
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
 * @returns An array of {@link Condition} objects.
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

/** Alias for {@link state}. Flexible condition builder evaluating state specifications. */
export const condState = state;
/** Alias for {@link state}. Flexible condition builder evaluating state specifications. */
export const ifState = state;

/**
 * Condition builder enforcing that all specified state items must be false / inactive / negated.
 *
 * Use when gating bindings to activate only when one or more variables, apps, or states are NOT active.
 *
 * @param items - Array of state items to require as false/negated.
 * @returns An array of negated {@link Condition} objects.
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
 * @returns An array of negated {@link Condition} objects.
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
 * @returns A single negated {@link Condition} object.
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

/** Alias for {@link unless}. Condition builder enforcing that all specified items are false/negated. */
export const condUnless = unless;

