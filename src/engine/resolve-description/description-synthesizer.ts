import type { ToEvent } from "../../types/karabiner";
import type { Action, Binding, Condition, Phase, Trigger } from "../../data";
import { keyTokenToLabel, modifierTokenToSymbols } from "./rule-descriptions";
import {
  expandModifiers,
  getTriggerKeys,
  isPointerButton,
  resolveButton,
  resolveModifiers,
} from "../utils";
import { describeAction, isActionSpec } from "../resolve-to-action/action-handlers";
import { describeCondition } from "../resolve-conditions";
import { deriveTriggerToEvents } from "../emit-manipulators/binding/builders";

export { describeAction };


/** Describe a raw Karabiner `ToEvent` passed through verbatim in `do` (mouse
 * mappings). Best-effort labels by event shape; never throws. */
function describeToEvent(event: ToEvent): string {
  if (!event || typeof event !== "object") return "Raw event";
  const e = event as Record<string, unknown>;
  if ("key_code" in e) {
    const keyLabel = keyTokenToLabel(e.key_code as string);
    const mods =
      Array.isArray(e.modifiers) && e.modifiers.length
        ? expandModifiers(e.modifiers as string[]).map(modifierTokenToSymbols).join("")
        : "";
    return mods ? `Emit ${mods} + '${keyLabel}'` : `Emit '${keyLabel}'`;
  }
  if ("pointing_button" in e) {
    return `Click ${resolveButton(e.pointing_button as string).desc}`;
  }
  if ("shell_command" in e) {
    const c = String(e.shell_command);
    return `Run '${c.length > 40 ? `${c.slice(0, 37)}…` : c}'`;
  }
  if ("set_variable" in e) {
    const sv = e.set_variable as { name: string };
    return `Set ${sv.name}`;
  }
  if ("from_event" in e) return "Pass through";
  return "Raw event";
}

/** Describe a `do` entry that may be a typed ActionSpec or a raw ToEvent. */
function describeDoAction(action: Action): string {
  return isActionSpec(action) ? describeAction(action) : describeToEvent(action);
}

/** Human label for one condition group (spec §6). Empty group -> "Always". */
export function describeConditionGroup(conditions: Condition[] | undefined): string {
  if (!conditions?.length) return "Always";
  return conditions.map(describeCondition).join(" and ");
}

/**
 * The `[TRIGGER]:` segment (spec §7). Reuses the key→symbol mapping from
 * rule-descriptions. Pointer triggers render as `Click:` (button1) / `Pointer <x>:`.
 * `SimOrder`-augmented rendering (strict key-down sequences, upWhen notes) is
 * intentionally minimal here: no Phase 2 binding uses a simultaneous trigger, so
 * the basic `]+[` join is complete for this phase; Phase 3 (simultaneous
 * migration) extends it.
 */
export function describeTrigger(trigger: Trigger): string {
  const { mandatory, optional } = resolveModifiers(trigger.modifiers);
  const mandSymbols = mandatory.length ? mandatory.map(modifierTokenToSymbols).join("") : "";
  const optSymbols = optional.length ? optional.map(modifierTokenToSymbols).join("") : "";
  const keys = getTriggerKeys(trigger);

  const segments: string[] = [];
  if (mandSymbols) segments.push(`[${mandSymbols}]`);
  if (optSymbols) segments.push(`(${optSymbols})?`);
  if ("any" in trigger) segments.push(`[ANY ${trigger.any.replace(/_/g, " ")}]`);
  for (const k of keys) {
    if (isPointerButton(k)) {
      segments.push(resolveButton(k).desc);
    } else {
      segments.push(`[${keyTokenToLabel(k)}]`);
    }
  }
  return `${segments.join("+")}:`;
}

const BUCKET_ORDER = ["On Tap", "On Hold", "On Double Tap", "On Double Tap Hold"];

function bucketFor(tapCount: number, phase: Phase): string {
  if (tapCount === 1 && (phase === "press" || phase === "release")) return "On Tap";
  if (tapCount === 1 && phase === "hold") return "On Hold";
  if (tapCount >= 2 && (phase === "press" || phase === "release")) return "On Double Tap";
  return "On Double Tap Hold";
}

/**
 * Rich multi-line rule description (spec §9). Layout:
 *   [TRIGGER]:\n---\n\t<Phase>:\n\t\t<conditionLabel>:\t<actionLine>
 * Phases emitted in fixed order (On Tap, On Hold, On Double Tap, On Double Tap
 * Hold); empty phases omitted. Per-case conditionLabel combines hoisted
 * binding.conditions + the case's own conditions. Case.description, when set,
 * overrides the derived action line verbatim.
 */
export function synthesizeRuleDescription(binding: Binding): string {
  return synthesizeMergedRuleDescription([binding]);
}

/**
 * The same layout for the several bindings that share one emitted rule.
 *
 * Bindings that share a trigger become one GUI entry, so their cases have to
 * share one description too: the header comes from the first binding's trigger
 * and every binding's cases are folded into the same phase sections, in
 * evaluation order. With a single binding this is exactly
 * {@link synthesizeRuleDescription}.
 */
export function synthesizeMergedRuleDescription(
  bindings: readonly Binding[],
): string {
  const first = bindings[0];
  if (!first) return "";

  const buckets = new Map<string, string[]>();
  for (const label of BUCKET_ORDER) buckets.set(label, []);

  for (const binding of bindings) {
    for (const c of binding.cases) {
      const condLabel = describeConditionGroup([
        ...(binding.conditions ?? []),
        ...(c.conditions ?? []),
      ]);
      const doActions =
        c.do.length > 0
          ? c.do
          : c.guard
            ? deriveTriggerToEvents(binding.trigger)
            : [];
      const actionLine = c.description ?? doActions.map(describeDoAction).join(" then ");
      buckets
        .get(bucketFor(c.tapCount ?? 1, c.phase ?? "press"))!
        .push(`\t\t${condLabel}:\t${actionLine}`);
    }
  }

  const sections = [...buckets]
    .filter(([, lines]) => lines.length > 0)
    .map(([label, lines]) => `\t${label}:\n${lines.join("\n")}`);

  return `${describeTrigger(first.trigger)}\n---\n${sections.join("\n")}`;
}

/**
 * Per-manipulator slice-label (spec §9): the condition-group's short label.
 * Returns undefined for the single unconditional group so the manipulator's
 * `description` field is omitted entirely.
 */
export function synthesizeManipulatorLabel(
  conditions: Condition[] | undefined,
): string | undefined {
  if (!conditions?.length) return undefined;
  return describeConditionGroup(conditions);
}
