import type { Manipulator } from "../../../types/karabiner";
import { ifDevice } from "../../karabiner-helpers";
import { DEVICES, type Binding, type Condition, type Trigger } from "../../../data";

import type { ResolvedCase } from "../../resolve-cases";
import { synthesizeManipulatorLabel } from "../../resolve-description/description-synthesizer";
import { karabinerDeviceId } from "../../resolve-trigger/device-config";
import { getTriggerKeys, isPointerButton, resolveButton } from "../../utils";
import { resolveActionToEvents } from "../../resolve-to-action";

export function deviceLast(conds: unknown[]): unknown[] {
  if (!conds.length) return conds;
  const rest: unknown[] = [];
  const device: unknown[] = [];
  for (const c of conds) {
    if (
      c &&
      typeof c === "object" &&
      (c as { type?: string }).type === "device_if"
    )
      device.push(c);
    else rest.push(c);
  }
  return device.length ? [...rest, ...device] : rest;
}

/** For a device-specific button alias, add a `device_if` condition to every manipulator. */
export function stampDeviceScope(
  manipulators: Manipulator[],
  trigger: Trigger,
): void {
  const keys = getTriggerKeys(trigger);
  const nameScopes: string[] = [];
  for (const k of keys) {
    if (isPointerButton(k)) {
      const { nameScope } = resolveButton(k);
      if (nameScope && nameScope !== "global") {
        nameScopes.push(...nameScope);
      }
    }
  }
  if (!nameScopes.length) return;
  const ids = nameScopes.map((n) =>
    karabinerDeviceId(DEVICES[n as keyof typeof DEVICES]),
  );
  const cond = ifDevice(ids).build();
  manipulators.forEach((m: any) => {
    m.conditions = [...(m.conditions ?? []), cond];
  });
}

export function attachConditions(
  manipulators: Manipulator[],
  cases: ResolvedCase[],
): void {
  const conds = deviceLast(cases.flatMap((c) => c.conditions));
  if (!conds.length) return;
  manipulators.forEach((m: any) => {
    m.conditions = m.conditions || [];
    m.conditions.push(...conds);
  });
}

export function stampLabel(
  manipulators: Manipulator[],
  conditions: Condition[] | undefined,
): void {
  const label = synthesizeManipulatorLabel(conditions);
  if (!label) return;
  manipulators.forEach((m: any) => {
    m.description = label;
  });
}

/**
 * Attach a binding's `otherKeyPressed` entries to the manipulators it produced.
 *
 * Applied to every `basic` manipulator the binding emitted, because the channel
 * describes what happens when the held key is *combined* with another and that
 * is independent of which condition group matched.
 *
 * Rejected on multi-tap and guard bindings: those emit extra state-detection
 * manipulators whose interaction with this channel is unvalidated, and a wrong
 * guess here is silent at runtime. Failing the build is the cheaper error.
 */
export function stampOtherKeyPressed(manipulators: Manipulator[], b: Binding): void {
  const entries = b.otherKeyPressed;
  if (!entries?.length) return;

  if (b.multiTap !== undefined || b.cases.some((c) => (c.tapCount ?? 1) >= 2)) {
    throw new Error(
      `otherKeyPressed is not supported on a multi-tap binding ("${b.description ?? "unnamed"}")`,
    );
  }

  const compiled = entries.map((entry) => {
    const otherKeys = Array.isArray(entry.otherKeys) ? entry.otherKeys : [entry.otherKeys];
    if (!otherKeys.length) {
      throw new Error(
        `otherKeyPressed entry names no keys in "${b.description ?? "unnamed"}"`,
      );
    }
    const to = entry.do.flatMap((a) => resolveActionToEvents(a));
    if (!to.length) {
      throw new Error(
        `otherKeyPressed entry emits nothing in "${b.description ?? "unnamed"}"`,
      );
    }
    return { other_keys: otherKeys, to };
  });

  for (const m of manipulators) {
    if (m.type !== "basic") continue;
    m.to_if_other_key_pressed = [...(m.to_if_other_key_pressed ?? []), ...compiled];
  }
}
