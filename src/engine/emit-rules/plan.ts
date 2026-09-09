/**
 * Bindings → rules.
 *
 * A rule is the unit the Karabiner-Elements GUI shows and the user enables or
 * disables; a manipulator is the unit that actually fires. One binding per rule
 * — the previous behaviour — put the same physical trigger in several GUI rows
 * (`⌘+H` twice, the caps lock layer several hundred times) and left the user
 * guessing which row owned the key.
 *
 * So: every binding that resolves to the same trigger is emitted into one rule,
 * conditioned manipulators above unconditional ones, and the rules themselves
 * come out in {@link compareTriggerSortKeys} order.
 */

import type { Binding } from "../../data";
import type { Rule } from "../../types/karabiner";
import { buildManipulators } from "../emit-manipulators/compile-binding";
import { rule } from "../karabiner-helpers";
import {
  synthesizeMergedRuleDescription,
  synthesizeRuleDescription,
} from "../resolve-description/description-synthesizer";
import {
  compareTriggerSortKeys,
  ruleGroupSignature,
  triggerSortKey,
} from "./trigger-order";

/** A named list of bindings, as declared in `src/definitions/`. */
export type BindingSet = { name: string; bindings: readonly Binding[] };

/** A binding tagged with where it was declared, for diagnostics. */
export type PlannedBinding = {
  /** Name of the binding set, e.g. `"tap-hold"` or `"disabled-hotkeys"`. */
  set: string;
  /** Position within that set. */
  index: number;
  binding: Binding;
};

export type RulePlan = {
  /** Grouping key: an explicit `binding.ruleGroup.id`, else a trigger signature. */
  id: string;
  /** Every binding emitted into this rule, in evaluation order. */
  bindings: PlannedBinding[];
  /** The rule description — the only label the GUI shows. */
  description: string;
};

/**
 * Whether a binding declares conditions of its own.
 *
 * Deliberately the *declared* conditions rather than the compiled
 * manipulators': it is the same notion the description synthesizer renders as
 * `In Skim:` versus `Always:`, so what the GUI shows and what gets ordered
 * first stay in agreement.
 */
function isConditional(binding: Binding): boolean {
  return (
    Boolean(binding.conditions?.length) ||
    binding.cases.some((c) => c.conditions?.length)
  );
}

/**
 * Order the bindings inside one rule.
 *
 * Trigger order first, so a merged group (caps lock) still evaluates its most
 * qualified variant first; then conditional before unconditional, because an
 * unconditional manipulator on the same trigger would otherwise swallow every
 * event before the conditional one is reached.
 *
 * The sort is stable and works on whole bindings, never on individual
 * manipulators: the engine emits a binding's manipulators in an order Karabiner
 * requires (a multi-tap's second-tap manipulator has to precede its first-tap
 * manipulator), and splitting that block apart would break it.
 */
function orderWithinRule(members: readonly PlannedBinding[]): PlannedBinding[] {
  return [...members].sort(
    (a, b) =>
      compareTriggerSortKeys(
        triggerSortKey(a.binding.trigger),
        triggerSortKey(b.binding.trigger),
      ) ||
      Number(isConditional(b.binding)) - Number(isConditional(a.binding)),
  );
}

function describeRule(members: readonly PlannedBinding[]): string {
  const grouped = members.find((m) => m.binding.ruleGroup?.description);
  if (grouped) return grouped.binding.ruleGroup!.description;

  const bindings = members.map((m) => m.binding);
  const only = bindings.length === 1 ? bindings[0]! : undefined;
  if (only) return only.description ?? synthesizeRuleDescription(only);

  // A hand-written `description` is a whole rule label, not a section of one,
  // so it cannot be folded into the synthesized layout — stack them instead.
  if (bindings.some((b) => b.description !== undefined)) {
    return bindings
      .map((b) => b.description ?? synthesizeRuleDescription(b))
      .join("\n\n");
  }
  return synthesizeMergedRuleDescription(bindings);
}

/**
 * Group every binding into the rule it will be emitted as, and order both the
 * rules and the bindings inside each one.
 *
 * The returned order is the order Karabiner evaluates, so it is also what
 * conflict analysis has to run over.
 */
export function planRules(sets: readonly BindingSet[]): RulePlan[] {
  const groups = new Map<string, PlannedBinding[]>();

  for (const { name, bindings } of sets) {
    bindings.forEach((binding, index) => {
      const id =
        binding.ruleGroup?.id ?? `trigger:${ruleGroupSignature(binding.trigger)}`;
      const member: PlannedBinding = { set: name, index, binding };
      const bucket = groups.get(id);
      if (bucket) bucket.push(member);
      else groups.set(id, [member]);
    });
  }

  const plans = [...groups].map(([id, members]) => {
    const ordered = orderWithinRule(members);
    return { id, bindings: ordered, description: describeRule(ordered) };
  });

  // A rule sorts by its most qualified binding — the first after the ordering
  // above — so a merged group is never evaluated later than its narrowest
  // member would have been on its own.
  return plans.sort(
    (a, b) =>
      compareTriggerSortKeys(
        triggerSortKey(a.bindings[0]!.binding.trigger),
        triggerSortKey(b.bindings[0]!.binding.trigger),
      ) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Compile a plan into the Karabiner `Rule` objects written to the config. */
export function emitRules(plans: readonly RulePlan[]): Rule[] {
  return plans.map((plan) =>
    rule(plan.description)
      .manipulators(plan.bindings.flatMap((m) => buildManipulators(m.binding)))
      .build(),
  );
}
