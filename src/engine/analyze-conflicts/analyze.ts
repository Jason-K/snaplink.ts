/**
 * Rule conflict analysis.
 *
 * Karabiner evaluates complex modifications top-down and stops at the first
 * manipulator whose `from` matches the event and whose conditions all hold.
 * A later rule is therefore unreachable whenever some earlier rule matches
 * strictly more inputs under strictly weaker conditions.
 *
 * This module classifies every ordered pair of bindings against that model.
 * Signature equality — the previous approach — both missed subset relationships
 * (a rule shadowed by a broader one earlier in the list) and false-positived on
 * rules that deliberately share a trigger under mutually exclusive conditions.
 */

import type { Binding, Condition, Trigger } from "../../data";
import {
  conditionsImply,
  conditionsProvablyDisjoint,
  sameConditions,
} from "./condition-logic";
import { isModifierKey } from "../utils";
import {
  describeInputDomain,
  inputDomainContains,
  inputDomainsIntersect,
  sameInputDomain,
  toInputDomain,
  type InputDomain,
} from "./input-domain";

/** A binding tagged with the definition set it came from, for diagnostics. */
export type AnalyzedBinding = {
  /** Name of the binding set, e.g. `"tap-hold"` or `"disabled-hotkeys"`. */
  set: string;
  /** Position in the emitted rule order. */
  index: number;
  binding: Binding;
  domain: InputDomain;
  conditions: readonly Condition[];
};

export type ConflictKind =
  /** Identical input domain and identical conditions — the later rule is dead. */
  | "duplicate"
  /** An earlier, broader rule matches everywhere the later one does. */
  | "shadowed"
  /** A single-key rule precedes a chord that includes that key. */
  | "chord-member"
  /** Overlapping inputs, but the earlier rule is the more specific one. */
  | "narrowing";

export type ConflictSeverity = "error" | "warning" | "info";

export type Conflict = {
  kind: ConflictKind;
  severity: ConflictSeverity;
  /** The rule evaluated first. */
  earlier: AnalyzedBinding;
  /** The rule evaluated later — the one at risk of being unreachable. */
  later: AnalyzedBinding;
  message: string;
};

const SEVERITY: Record<ConflictKind, ConflictSeverity> = {
  duplicate: "error",
  shadowed: "error",
  // Whether a chord is reachable past a single-key rule for one of its members
  // depends on press timing and on the simultaneous threshold, which this
  // static analysis cannot decide. Report it, do not fail the build on it.
  "chord-member": "warning",
  narrowing: "info",
};

/** Short label for a binding, for use in diagnostics. */
export function describeBinding(b: AnalyzedBinding): string {
  const first = b.binding.description?.split("\n")[0];
  return `${b.set}[${b.index}] ${describeInputDomain(b.domain)}${first ? ` — ${first}` : ""}`;
}

function describeConditions(conditions: readonly Condition[]): string {
  return conditions.length ? `${conditions.length} condition(s)` : "unconditional";
}

/** A binding plus its provenance, before its input domain has been computed. */
export type BindingEntry = { set: string; index: number; binding: Binding };

/**
 * Tag already-ordered bindings with their input domains.
 *
 * The emitted rule order is not the declaration order — `planRules()` sorts and
 * merges — so the build hands the analyzer the flattened emit order rather than
 * the binding sets, and provenance travels with each entry.
 */
export function analyzableEntries(
  entries: readonly BindingEntry[],
): AnalyzedBinding[] {
  return entries.map(({ set, index, binding }) => ({
    set,
    index,
    binding,
    domain: toInputDomain(binding.trigger),
    conditions: binding.conditions ?? [],
  }));
}

/** Flatten named binding sets into analysis records, preserving emit order. */
export function analyzable(
  sets: ReadonlyArray<{ name: string; bindings: readonly Binding[] }>,
): AnalyzedBinding[] {
  return analyzableEntries(
    sets.flatMap(({ name, bindings }) =>
      bindings.map((binding, index) => ({ set: name, index, binding })),
    ),
  );
}

/**
 * `true` when a single-key trigger and a chord denote the *same* physical input,
 * differing only in whether the extra keys are expressed as `from.modifiers` or
 * as chord members.
 *
 * A binding may emit both encodings on purpose, so that whichever way Karabiner
 * reports the combination one of them matches. Ordering between such a pair is
 * not a conflict.
 */
function isAlternateEncoding(single: InputDomain, chord: InputDomain): boolean {
  const memberKey = single.keys[0];
  if (!memberKey) return false;
  const others = chord.keys.filter((k) => k !== memberKey);
  const mandatory = single.modifiers.mandatory;
  return (
    others.length === mandatory.size && others.every((k) => mandatory.has(k))
  );
}

/**
 * A single-key rule that runs before a chord containing that key can consume the
 * chord's first key-down. Only flagged when their modifier domains can overlap.
 */
function chordMemberConflict(
  earlier: AnalyzedBinding,
  later: AnalyzedBinding,
): boolean {
  if (earlier.domain.kind === "chord" || later.domain.kind !== "chord") return false;
  const memberKey = earlier.domain.keys[0];
  if (!memberKey || !later.domain.keys.includes(memberKey)) return false;
  if (isAlternateEncoding(earlier.domain, later.domain)) return false;

  const others = later.domain.keys.filter((k) => k !== memberKey);
  // Only chord members that are modifier keys change the held-modifier set;
  // an ordinary key going down does not affect modifier matching at all.
  const modifierMembers = others.filter(isModifierKey);
  const allowed = earlier.domain.modifiers.allowed;

  // If the single-key rule forbids a modifier the chord itself holds down, it
  // cannot match while the chord is being pressed.
  if (allowed !== "any" && modifierMembers.some((k) => !allowed.has(k))) return false;

  // If it demands a modifier the chord does not supply, the chord is still
  // reachable whenever that modifier is not independently held.
  for (const required of earlier.domain.modifiers.mandatory) {
    if (!modifierMembers.includes(required)) return false;
  }

  return !conditionsProvablyDisjoint(earlier.conditions, later.conditions);
}

function classify(
  earlier: AnalyzedBinding,
  later: AnalyzedBinding,
): ConflictKind | undefined {
  if (chordMemberConflict(earlier, later)) return "chord-member";

  if (!inputDomainsIntersect(earlier.domain, later.domain)) return undefined;
  if (conditionsProvablyDisjoint(earlier.conditions, later.conditions)) return undefined;

  if (
    sameInputDomain(earlier.domain, later.domain) &&
    sameConditions(earlier.conditions, later.conditions)
  ) {
    return "duplicate";
  }

  // `later` is unreachable when `earlier` matches every input it does under
  // conditions that hold whenever `later`'s do.
  if (
    inputDomainContains(earlier.domain, later.domain) &&
    conditionsImply(earlier.conditions, later.conditions)
  ) {
    return "shadowed";
  }

  return "narrowing";
}

function messageFor(
  kind: ConflictKind,
  earlier: AnalyzedBinding,
  later: AnalyzedBinding,
): string {
  const a = describeBinding(earlier);
  const b = describeBinding(later);
  switch (kind) {
    case "duplicate":
      return (
        `Duplicate rule: ${b} has the same trigger and the same conditions as ${a}, ` +
        "which is evaluated first. The later rule can never fire — remove it, or " +
        "narrow one of the two with a condition."
      );
    case "shadowed":
      return (
        `Unreachable rule: ${b} (${describeConditions(later.conditions)}) is fully ` +
        `covered by ${a} (${describeConditions(earlier.conditions)}), which is ` +
        "evaluated first. Reorder them, or narrow the earlier rule."
      );
    case "chord-member":
      return (
        `Chord "${later.domain.keys.join("+")}" may be unreachable: ${a} claims member ` +
        `key "${earlier.domain.keys[0]}" and is evaluated first. Move the chord ` +
        "above it, or give the single-key rule a modifier the chord does not use."
      );
    case "narrowing":
      return `${a} narrows ${b}; the more specific rule is correctly ordered first.`;
  }
}

export type AnalysisReport = {
  bindings: AnalyzedBinding[];
  conflicts: Conflict[];
  errors: Conflict[];
  warnings: Conflict[];
};

/** Classify every ordered pair of bindings across all sets. */
export function analyzeConflicts(
  sets: ReadonlyArray<{ name: string; bindings: readonly Binding[] }>,
): AnalysisReport {
  return analyzeOrdered(analyzable(sets));
}

/** Classify every ordered pair in an already-flattened evaluation order. */
export function analyzeConflictsInOrder(
  entries: readonly BindingEntry[],
): AnalysisReport {
  return analyzeOrdered(analyzableEntries(entries));
}

function analyzeOrdered(bindings: AnalyzedBinding[]): AnalysisReport {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < bindings.length; i++) {
    for (let j = i + 1; j < bindings.length; j++) {
      const earlier = bindings[i]!;
      const later = bindings[j]!;
      const kind = classify(earlier, later);
      if (!kind) continue;
      const severity = SEVERITY[kind];
      if (severity === "info") continue;
      conflicts.push({
        kind,
        severity,
        earlier,
        later,
        message: messageFor(kind, earlier, later),
      });
    }
  }

  return {
    bindings,
    conflicts,
    errors: conflicts.filter((c) => c.severity === "error"),
    warnings: conflicts.filter((c) => c.severity === "warning"),
  };
}

/** Thrown by {@link assertNoConflicts} when unreachable rules are found. */
export class RuleConflictError extends Error {
  constructor(readonly conflicts: readonly Conflict[]) {
    super(
      `${conflicts.length} unreachable rule(s) detected:\n\n` +
        conflicts.map((c) => `  • [${c.kind}] ${c.message}`).join("\n\n"),
    );
    this.name = "RuleConflictError";
  }
}

/**
 * Fail the build on unreachable rules; return warnings for the caller to report.
 *
 * Replaces `assertUniqueTriggers`, which only saw one binding set and only
 * caught exact signature duplicates.
 */
export function assertNoConflicts(
  sets: ReadonlyArray<{ name: string; bindings: readonly Binding[] }>,
): AnalysisReport {
  return throwOnErrors(analyzeConflicts(sets));
}

/** {@link assertNoConflicts} over an already-flattened evaluation order. */
export function assertNoConflictsInOrder(
  entries: readonly BindingEntry[],
): AnalysisReport {
  return throwOnErrors(analyzeConflictsInOrder(entries));
}

function throwOnErrors(report: AnalysisReport): AnalysisReport {
  if (report.errors.length) throw new RuleConflictError(report.errors);
  return report;
}

/** Every rule whose input domain can match the given trigger, in evaluation order. */
export function rulesMatching(
  bindings: readonly AnalyzedBinding[],
  trigger: Trigger,
): AnalyzedBinding[] {
  const query = toInputDomain(trigger);
  return bindings.filter(
    (b) =>
      inputDomainsIntersect(b.domain, query) ||
      (b.domain.kind === "chord" &&
        query.keys.every((k) => b.domain.keys.includes(k))),
  );
}
