import type { Manipulator, Rule } from "../../types/karabiner";
import { rule } from "../karabiner-helpers";
import type { Binding } from "../../data";

import { groupByConditions, resolveCases } from "../resolve-cases";
import { synthesizeRuleDescription } from "../resolve-description/description-synthesizer";
import { fromModifiersObj, triggerToFrom } from "../resolve-trigger";
import { getTriggerKeys, isPointerButton } from "../utils";

import {
  buildGuard,
  buildMultiTap,
  buildRemap,
  buildSimultaneousTapHold,
  buildTapHold,
  stampDeviceScope,
  stampOtherKeyPressed,
} from "./binding";

export type {
  Binding,
  Case,
  Condition,
  Phase,
  SimOrder,
  Trigger,
  TriggerModifiers,
} from "../../data";
export {
  getTriggerKeys,
  normalizeModifier,
  resolveKeyAlias,
  resolveModifiers,
} from "../utils";
export { resolveCondition } from "../resolve-conditions";
export { fromModifiersObj, triggerToFrom };

export function buildManipulators(b: Binding): Manipulator[] {
  const resolved = resolveCases(b.cases, b.conditions);
  if (resolved.some((c) => c.guard)) {
    const manipulators = buildGuard(b, resolved);
    stampDeviceScope(manipulators, b.trigger);
    if (b.otherKeyPressed?.length) {
      throw new Error(
        `otherKeyPressed is not supported on a guard binding ("${b.description ?? "unnamed"}")`,
      );
    }
    return manipulators;
  }
  const hasMultiTap =
    resolved.some((c) => c.tapCount >= 2) || b.multiTap !== undefined;
  const keys = getTriggerKeys(b.trigger);
  const isSim = keys.length > 1;
  const isPointer = keys.length === 1 && isPointerButton(keys[0]!);
  let manipulators: Manipulator[];
  if (hasMultiTap) manipulators = buildMultiTap(b, resolved, isSim);
  else if (isSim) manipulators = buildSimultaneousTapHold(b, resolved);
  else {
    manipulators = groupByConditions(resolved).flatMap((g) =>
      g.hasRelease || g.hasHold
        ? buildTapHold(b, g)
        : buildRemap(b, g, isPointer),
    );
  }
  stampDeviceScope(manipulators, b.trigger);
  stampOtherKeyPressed(manipulators, b);
  return manipulators;
}

export function defineBindings(bindings: Binding[]): Rule[] {
  return bindings.map((b) =>
    rule(b.description ?? synthesizeRuleDescription(b))
      .manipulators(buildManipulators(b))
      .build(),
  );
}
