import {
  type KeyCode,
  type PointerButtonAlias,
  type TriggerKey,
  type SimOrder,
  type Trigger,
  type TriggerModifiers,
} from "../../data";
import { isPointerButton, resolveKeyAlias } from "../utils";

export type { TriggerKey };


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
  order?: SimOrder,
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
  return {
    keys: keysArray,
    ...(modifiers ? { modifiers } : {}),
    ...(order ? { order } : {}),
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
  order?: SimOrder,
): Trigger {
  const keysArray = (Array.isArray(keys) ? keys : [keys]).map((k) =>
    resolveKeyAlias(k as string),
  );
  return {
    keys: keysArray,
    ...(modifiers ? { modifiers } : {}),
    ...(order ? { order } : {}),
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
 * Accepts existing `Trigger` objects, key codes, pointer button aliases, arrays of inputs, or trigger configuration objects.
 */
export type FromInput =
  | Trigger
  | TriggerKey
  | TriggerKey[]
  | { key: TriggerKey; modifiers?: TriggerModifiers }
  | { keys: TriggerKey | TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder }
  | { pointer: PointerButtonAlias; modifiers?: TriggerModifiers };

/**
 * Coerces a flexible {@link FromInput} into a standardized `Trigger` object.
 *
 * @param input - Key code, pointer button, trigger object, or input array.
 * @param modifiers - Optional fallback/override trigger modifiers.
 * @param order - Optional fallback/override simultaneous order rule.
 * @returns A resolved `Trigger` object.
 *
 * @example
 * ```ts
 * from("a", ["cmd"])
 * from({ keys: ["j", "k"], order: "strict" })
 * ```
 */
export function from(
  input: FromInput,
  modifiers?: TriggerModifiers,
  order?: SimOrder,
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
    if ("keys" in input) {
      return triggerKeys(
        input.keys as TriggerKey | TriggerKey[],
        input.modifiers ?? modifiers,
        input.order ?? order,
      );
    }
    if (modifiers || order) {
      const copy: Trigger = { ...(input as Trigger) };
      if (modifiers) copy.modifiers = modifiers;
      if (order && "keys" in copy) (copy as { order?: SimOrder }).order = order;
      return copy;
    }
    return input as Trigger;
  }

  throw new Error(`Invalid trigger input passed to from(): ${JSON.stringify(input)}`);
}

