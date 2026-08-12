import type { Trigger } from "../../data";
import type { PointingButton } from "../../types/karabiner";
import type { PointerButtonAlias } from "../../data/constants/mouse";
import { BUTTONS, BUTTON_DESCS, type ButtonSpec } from "../../data/constants/mouse";
import { resolveModifiers } from "./modifier-utils";

export function getTriggerKeys(trigger: Trigger): string[] {
  // A catch-all trigger names no key, so it contributes none.
  if ("any" in trigger) return [];
  return "keys" in trigger ? trigger.keys : [trigger.pointer];
}


/**
 * Generate a deterministic signature string for an I/O trigger or action chord.
 */
export function ioSignature(t: Trigger): string {
  const { mandatory, optional } = resolveModifiers(t.modifiers);
  const mandStr = [...mandatory].sort().join(",");
  const optStr = [...optional].sort().join(",");
  const mods = `mandatory:[${mandStr}]|optional:[${optStr}]`;
  const keys = getTriggerKeys(t);
  const order = "order" in t && t.order ? JSON.stringify(t.order) : "";
  return `keys:${[...keys].sort().join(",")}|mods:${mods}|order:${order}`;
}

/** Legacy alias for ioSignature */
export const triggerSignature = ioSignature;

/** Resolve a pointer alias (or raw button id) → button + nameScope + label. */
export function resolveButton(pointer: string): {
  button: PointingButton;
  nameScope?: ButtonSpec["nameScope"];
  desc: string;
} {
  const spec = (BUTTONS as Record<string, ButtonSpec>)[pointer];
  if (spec)
    return { button: spec.button, nameScope: spec.nameScope, desc: spec.desc };
  // `button1`..`button255` only; anything else fails schema validation.
  const button = pointer as PointingButton;
  return { button, desc: BUTTON_DESCS[button] ?? pointer };
}

export function isPointerButton(pointer: string): pointer is PointerButtonAlias {
  return pointer in BUTTONS || /^button\d+$/.test(pointer);
}
