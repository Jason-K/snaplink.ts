import {
  type KeyCode,
  type PointerButtonAlias,
  type TriggerKey,
  type SimOrder,
  type Trigger,
  type TriggerModifiers,
} from "../../data";
import { isPointerButton, resolveKeyAlias } from "../utils";
import type { SimultaneousOptions } from "../resolve-trigger/simultaneous-rules";

export type { TriggerKey };

/**
 * Normalizes user-facing simultaneous options or order specs into Karabiner `SimOrder`.
 */
export function normalizeSimOrder(
  order?:
    | SimOrder
    | SimultaneousOptions
    | "insensitive"
    | "strict"
    | "strict_inverse",
): SimOrder | undefined {
  if (!order) return undefined;
  if (typeof order === "string") return { down: order };
  const o: SimOrder = {};
  if ("down" in order && order.down) o.down = order.down;
  if ("key_down_order" in order && order.key_down_order) o.down = order.key_down_order;
  if ("up" in order && order.up) o.up = order.up;
  if ("key_up_order" in order && order.key_up_order) o.up = order.key_up_order;
  if ("upWhen" in order && order.upWhen) o.upWhen = order.upWhen;
  if ("key_up_when" in order && order.key_up_when) o.upWhen = order.key_up_when;
  if ("detectUninterrupted" in order && order.detectUninterrupted !== undefined)
    o.detectUninterrupted = order.detectUninterrupted;
  if ("detect_key_down_uninterruptedly" in order && order.detect_key_down_uninterruptedly !== undefined)
    o.detectUninterrupted = order.detect_key_down_uninterruptedly;
  return Object.keys(o).length ? o : undefined;
}

/**
 * Unified trigger builder for both key codes and pointer buttons.
 *
 * @param input - Single key code, array of key codes for simultaneous triggers, or pointer button alias.
 * @param modifiers - Optional mandatory/optional modifier requirements.
 * @param order - Optional simultaneous key press order constraint ("insensitive" or "strict").
 * @returns A normalized `Trigger` object.
 *
 * @example
 * ```ts
 * trigger("a", ["cmd"])
 * trigger(["j", "k"], { mandatory: ["ctrl"] }, "insensitive")
 * ```
 */
export function trigger(
  input: TriggerKey | TriggerKey[],
  modifiers?: TriggerModifiers,
  order?: SimOrder | "insensitive" | "strict" | "strict_inverse",
): Trigger {
  if (typeof input === "string" && isPointerButton(input)) {
    return {
      pointer: input,
      ...(modifiers ? { modifiers } : {}),
    };
  }
  const keysArray = (Array.isArray(input) ? input : [input as KeyCode]).map(
    (k) => resolveKeyAlias(k as string),
  );
  const resolvedOrder = normalizeSimOrder(order);
  return {
    keys: keysArray,
    ...(modifiers ? { modifiers } : {}),
    ...(resolvedOrder ? { order: resolvedOrder } : {}),
  };
}

/**
 * Construct a key-based trigger object.
 *
 * @param keys - Key code or array of key codes.
 * @param modifiers - Optional trigger modifiers.
 * @param order - Optional simultaneous key ordering rule.
 * @returns A `Trigger` specification for keys.
 *
 * @example
 * ```ts
 * triggerKeys("space", ["cmd", "shift"])
 * ```
 */
export function triggerKeys(
  keys: TriggerKey | TriggerKey[],
  modifiers?: TriggerModifiers,
  order?: SimOrder | "insensitive" | "strict" | "strict_inverse",
): Trigger {
  const keysArray = (Array.isArray(keys) ? keys : [keys]).map((k) =>
    resolveKeyAlias(k as string),
  );
  const resolvedOrder = normalizeSimOrder(order);
  return {
    keys: keysArray,
    ...(modifiers ? { modifiers } : {}),
    ...(resolvedOrder ? { order: resolvedOrder } : {}),
  };
}

/**
 * Construct a pointer button-based trigger object.
 *
 * @param pointer - Pointer button alias (e.g. `"button1"`, `"left"`, `"right"`).
 * @param modifiers - Optional trigger modifiers.
 * @returns A `Trigger` specification for pointer buttons.
 *
 * @example
 * ```ts
 * triggerPointer("button4", ["cmd"])
 * ```
 */
export function triggerPointer(
  pointer: PointerButtonAlias,
  modifiers?: TriggerModifiers,
): Trigger {
  return {
    pointer,
    ...(modifiers ? { modifiers } : {}),
  };
}

/**
 * Options object for defining a simultaneous key chord trigger.
 */
export type SimultaneousTriggerOptions = {
  /**
   * Keys involved in the chord: array of key codes or aliases.
   *
   * @example ["j", "k"]
   * @example ["left_option", "right_option"]
   */
  keys?: TriggerKey | TriggerKey[];

  /**
   * Alias for `keys`.
   *
   * @example ["d", "f"]
   */
  simultaneous?: TriggerKey | TriggerKey[];

  /**
   * Alias for `keys`.
   *
   * @example ["spacebar", "j"]
   */
  chord?: TriggerKey | TriggerKey[];

  /**
   * Modifier key requirements for the chord (e.g. `["shift"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`).
   *
   * @example ["shift"]
   * @example { mandatory: ["command"], optional: ["any"] }
   */
  modifiers?: TriggerModifiers;

  /**
   * Key press down/up ordering constraint (`"insensitive"`, `"strict"`, `"strict_inverse"`, or full {@link SimOrder}).
   *
   * @example "strict"
   * @example { down: "strict", up: "insensitive" }
   */
  order?: SimOrder | "insensitive" | "strict" | "strict_inverse";

  /**
   * Karabiner-native simultaneous options (e.g. `detect_key_down_uninterruptedly`, `key_down_order`, `to_after_key_up`).
   */
  simultaneous_options?: SimultaneousOptions;
};

/**
 * Helper to test if a value looks like a TriggerModifiers specification.
 */
function isModifiersArg(val: unknown): val is TriggerModifiers {
  if (Array.isArray(val)) return true;
  if (typeof val === "object" && val !== null) {
    return "mandatory" in val || "optional" in val;
  }
  return false;
}

/**
 * Helper to test if a value is an order specification.
 */
function isOrderArg(val: unknown): val is SimOrder | "insensitive" | "strict" | "strict_inverse" {
  if (typeof val === "string") {
    return val === "insensitive" || val === "strict" || val === "strict_inverse";
  }
  if (typeof val === "object" && val !== null) {
    return (
      "down" in val ||
      "up" in val ||
      "upWhen" in val ||
      "detectUninterrupted" in val ||
      "key_down_order" in val ||
      "key_up_order" in val ||
      "key_up_when" in val ||
      "detect_key_down_uninterruptedly" in val
    );
  }
  return false;
}

/**
 * Construct a simultaneous key chord trigger.
 *
 * Supports:
 * - Variadic keys: `simultaneous("left_option", "right_option")`
 * - Array of keys: `simultaneous(["j", "k"])`
 * - Array of keys + modifiers: `simultaneous(["j", "k"], ["shift"])`
 * - Array of keys + modifiers + order: `simultaneous(["j", "k"], ["shift"], { down: "strict" })`
 * - Configuration object: `simultaneous({ keys: ["j", "k"], modifiers: { optional: ["any"] } })`
 *
 * @param first - First key code, array of key codes, or a {@link SimultaneousTriggerOptions} configuration object.
 * @param rest - Remaining key codes, modifier array/object, or order constraint.
 * @returns A normalized `Trigger` specification representing the simultaneous chord.
 *
 * @example
 * ```ts
 * simultaneous("left_option", "right_option")
 * simultaneous(["j", "k"], ["shift"], "strict")
 * simultaneous({ simultaneous: ["j", "k"], simultaneous_options: { key_down_order: "strict" } })
 * ```
 */
export function simultaneous(
  first: TriggerKey | TriggerKey[] | SimultaneousTriggerOptions,
  ...rest: (TriggerKey | TriggerModifiers | SimOrder | SimultaneousOptions | "insensitive" | "strict" | "strict_inverse" | SimultaneousTriggerOptions)[]
): Trigger {
  // Case 1: Configuration object
  if (typeof first === "object" && !Array.isArray(first)) {
    const rawKeys = first.simultaneous ?? first.chord ?? first.keys;
    if (!rawKeys) {
      throw new Error("simultaneous(): configuration object must specify 'keys' or 'simultaneous'.");
    }
    const keysArray = (Array.isArray(rawKeys) ? rawKeys : [rawKeys]).map((k) =>
      resolveKeyAlias(k as string),
    );
    const resolvedOrder = normalizeSimOrder(first.simultaneous_options ?? first.order);
    return {
      keys: keysArray,
      ...(first.modifiers ? { modifiers: first.modifiers } : {}),
      ...(resolvedOrder ? { order: resolvedOrder } : {}),
    };
  }

  // Case 2: Array of keys
  if (Array.isArray(first)) {
    const keysArray = first.map((k) => resolveKeyAlias(k as string));
    let modifiers: TriggerModifiers | undefined;
    let order: SimOrder | undefined;

    for (const arg of rest) {
      if (isModifiersArg(arg)) {
        modifiers = arg;
      } else if (isOrderArg(arg)) {
        order = normalizeSimOrder(arg);
      } else if (typeof arg === "object" && arg !== null) {
        const opts = arg as SimultaneousTriggerOptions;
        if (opts.modifiers) modifiers = opts.modifiers;
        if (opts.order || opts.simultaneous_options) {
          order = normalizeSimOrder(opts.simultaneous_options ?? opts.order);
        }
      }
    }

    return {
      keys: keysArray,
      ...(modifiers ? { modifiers } : {}),
      ...(order ? { order } : {}),
    };
  }

  // Case 3: Variadic key strings (e.g. simultaneous("left_option", "right_option", ...))
  const keyStrings: TriggerKey[] = [first];
  let modifiers: TriggerModifiers | undefined;
  let order: SimOrder | undefined;

  for (const arg of rest) {
    if (typeof arg === "string" && !isOrderArg(arg)) {
      keyStrings.push(arg as TriggerKey);
    } else if (isModifiersArg(arg)) {
      modifiers = arg;
    } else if (isOrderArg(arg)) {
      order = normalizeSimOrder(arg);
    } else if (typeof arg === "object" && arg !== null) {
      const opts = arg as SimultaneousTriggerOptions;
      if (opts.modifiers) modifiers = opts.modifiers;
      if (opts.order || opts.simultaneous_options) {
        order = normalizeSimOrder(opts.simultaneous_options ?? opts.order);
      }
    }
  }

  const keysArray = keyStrings.map((k) => resolveKeyAlias(k as string));
  return {
    keys: keysArray,
    ...(modifiers ? { modifiers } : {}),
    ...(order ? { order } : {}),
  };
}

/**
 * Alias for {@link simultaneous}.
 */
export const chord = simultaneous;

/**
 * Matches any input event of a given kind — maps to Karabiner's `from.any`.
 *
 * Claims the event before any later rule sees it, so pair it with a condition
 * and let {@link compareTriggerSortKeys} put it last in its rule.
 *
 * @param kind - Input kind ("key_code", "consumer_key_code", or "pointing_button"). Defaults to "key_code".
 * @param modifiers - Optional modifier requirements. Defaults to `{ optional: ["any"] }`.
 * @returns A wild-card `Trigger` specification matching any event of the specified kind.
 *
 * @example
 * ```ts
 * anyInput("key_code")
 * anyInput("pointing_button", { mandatory: ["fn"] })
 * ```
 */
export function anyInput(
  kind: "key_code" | "consumer_key_code" | "pointing_button" = "key_code",
  modifiers: TriggerModifiers = { optional: ["any"] },
): Trigger {
  return { any: kind, modifiers };
}

/**
 * Flexible input type accepted by {@link from} to create trigger specifications.
 *
 * Accepts:
 * - A pre-built {@link Trigger} object
 * - A single key code string: `"a"`, `"spacebar"`, `"escape"`, `"f12"`
 * - A pointer button alias: `"button1"`, `"button4"`, `"left"`, `"right"`
 * - An array of keys for simultaneous chords: `["j", "k"]`, `["d", "f"]`
 * - Single-key configuration object: `{ key: "a", modifiers: ["cmd"] }`
 * - Simultaneous key configuration objects:
 *   - `{ keys: ["j", "k"], order: "strict" }`
 *   - `{ simultaneous: ["j", "k"], simultaneous_options: { ... } }`
 *   - `{ chord: ["left_option", "right_option"] }`
 * - Pointer configuration object: `{ pointer: "button4", modifiers: ["cmd"] }`
 */
export type FromInput =
  | Trigger
  | TriggerKey
  | TriggerKey[]
  | { key: TriggerKey; modifiers?: TriggerModifiers }
  | { keys: TriggerKey | TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder | "insensitive" | "strict" | "strict_inverse"; simultaneous_options?: SimultaneousOptions }
  | { simultaneous: TriggerKey | TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder | "insensitive" | "strict" | "strict_inverse"; simultaneous_options?: SimultaneousOptions }
  | { chord: TriggerKey | TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder | "insensitive" | "strict" | "strict_inverse"; simultaneous_options?: SimultaneousOptions }
  | { pointer: PointerButtonAlias; modifiers?: TriggerModifiers };

/**
 * Coerces a flexible {@link FromInput} into a standardized `Trigger` object.
 *
 * @param input - Key code, pointer button, trigger object, input array, or configuration object.
 * @param modifiers - Optional trigger modifiers (e.g. `["cmd", "opt"]`, `VM.COCS`, `{ mandatory: ["cmd"], optional: ["any"] }`).
 * @param order - Optional simultaneous key press order constraint ("insensitive", "strict", "strict_inverse", or {@link SimOrder}).
 * @returns A resolved `Trigger` object.
 *
 * @example
 * ```ts
 * // 1. Single key with modifiers:
 * from("a", ["cmd"])
 * from("spacebar", VM.COCS)
 *
 * // 2. Mouse button:
 * from("button4")
 * from("button4", ["cmd"])
 *
 * // 3. Simultaneous key chord:
 * from(["j", "k"])
 * from(["j", "k"], ["shift"], "strict")
 * from({ keys: ["j", "k"], order: "strict" })
 * from({ simultaneous: ["left_option", "right_option"] })
 * ```
 */
export function from(
  input: FromInput,
  modifiers?: TriggerModifiers,
  order?: SimOrder | "insensitive" | "strict" | "strict_inverse",
): Trigger {
  if (typeof input === "string" || Array.isArray(input)) {
    return trigger(input as TriggerKey | TriggerKey[], modifiers, order);
  }

  if (typeof input === "object" && input !== null) {
    if ("pointer" in input) {
      return triggerPointer(input.pointer, input.modifiers ?? modifiers);
    }
    if ("key" in input) {
      return triggerKeys(input.key, input.modifiers ?? modifiers);
    }
    if ("simultaneous" in input) {
      const simOpts = "simultaneous_options" in input ? (input as any).simultaneous_options : undefined;
      const rawOrder = "order" in input ? (input as any).order : order;
      const resolvedOrder = normalizeSimOrder(simOpts ?? rawOrder);
      return triggerKeys(
        input.simultaneous as TriggerKey | TriggerKey[],
        input.modifiers ?? modifiers,
        resolvedOrder,
      );
    }
    if ("chord" in input) {
      const simOpts = "simultaneous_options" in input ? (input as any).simultaneous_options : undefined;
      const rawOrder = "order" in input ? (input as any).order : order;
      const resolvedOrder = normalizeSimOrder(simOpts ?? rawOrder);
      return triggerKeys(
        input.chord as TriggerKey | TriggerKey[],
        input.modifiers ?? modifiers,
        resolvedOrder,
      );
    }
    if ("keys" in input) {
      const simOpts = "simultaneous_options" in input ? (input as any).simultaneous_options : undefined;
      const rawOrder = "order" in input ? (input as any).order : order;
      const resolvedOrder = normalizeSimOrder(simOpts ?? rawOrder);
      return triggerKeys(
        input.keys as TriggerKey | TriggerKey[],
        input.modifiers ?? modifiers,
        resolvedOrder,
      );
    }
    if (modifiers || order) {
      const copy: Trigger = { ...(input as Trigger) };
      if (modifiers) copy.modifiers = modifiers;
      const resolvedOrder = normalizeSimOrder(order);
      if (resolvedOrder && "keys" in copy) (copy as { order?: SimOrder }).order = resolvedOrder;
      return copy;
    }
    return input as Trigger;
  }

  throw new Error(`Invalid trigger input passed to from(): ${JSON.stringify(input)}`);
}


