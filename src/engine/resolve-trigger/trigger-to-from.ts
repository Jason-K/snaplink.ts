import type {
  FromEvent,
  FromKeyType,
  FromModifiers,
  Modifier,
} from "../../types/karabiner";
import type { Trigger } from "../../data";
import { resolveSimOrder } from "./simultaneous-core";
import {
  getTriggerKeys,
  isPointerButton,
  resolveButton,
  resolveKeyAlias,
  resolveModifiers,
} from "../utils";

/**
 * Build the `from.modifiers` object for a manipulator's `from` event from a
 * trigger's resolved modifiers.
 */
export function fromModifiersObj(trigger: Trigger): FromModifiers {
  const { mandatory, optional } = resolveModifiers(trigger.modifiers);
  const modifiersObj: FromModifiers = {};
  if (mandatory.length) modifiersObj.mandatory = mandatory as Modifier[];
  if (optional.length) modifiersObj.optional = optional as Modifier[];
  return modifiersObj;
}

/** Map one trigger key (or pointer alias) to its `from` key matcher. */
function triggerKeyToFromKey(key: string): FromKeyType {
  return isPointerButton(key)
    ? { pointing_button: resolveButton(key).button }
    : { key_code: resolveKeyAlias(key) };
}

/**
 * Convert a high-level Trigger specification into a Karabiner `FromEvent` matcher object.
 */
export function triggerToFrom(trigger: Trigger): FromEvent {
  const mods = fromModifiersObj(trigger);
  const hasMods = Object.keys(mods).length > 0;
  if ("any" in trigger) {
    return {
      any: trigger.any,
      ...(hasMods ? { modifiers: mods } : {}),
    };
  }
  const keys = getTriggerKeys(trigger);
  if (keys.length > 1) {
    const options = resolveSimOrder(
      "order" in trigger ? trigger.order : undefined,
    );
    return {
      simultaneous: keys.map(triggerKeyToFromKey),
      ...(options ? { simultaneous_options: options } : {}),
      modifiers: { optional: ["any"] },
    };
  }
  return {
    ...triggerKeyToFromKey(keys[0]!),
    ...(hasMods ? { modifiers: mods } : {}),
  };
}
