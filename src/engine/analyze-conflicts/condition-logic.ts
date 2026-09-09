/**
 * Condition-predicate reasoning for conflict analysis.
 *
 * Two rules that share an input domain only actually conflict when their
 * condition predicates can both hold at once. The per-kind rules for identity
 * and contradiction live in the condition handler registry, so adding a
 * condition type cannot silently weaken this analysis — the registry requires
 * a `contradicts` implementation for every kind.
 *
 * Both helpers are deliberately conservative: they answer "provably disjoint"
 * and "provably implies", defaulting to "don't know". That keeps false
 * negatives out of the disjointness test and false positives out of shadowing.
 */

import type { Condition } from "../../data";
import { conditionKey, conditionsContradict } from "../resolve-conditions";

/** `true` when the two condition groups can never be satisfied simultaneously. */
export function conditionsProvablyDisjoint(
  a: readonly Condition[] | undefined,
  b: readonly Condition[] | undefined,
): boolean {
  for (const ca of a ?? []) {
    for (const cb of b ?? []) {
      if (conditionsContradict(ca, cb)) return true;
    }
  }
  return false;
}

/**
 * `true` when satisfying `inner` necessarily satisfies `outer` — i.e. `outer` is
 * the weaker predicate, so it matches everywhere `inner` does.
 *
 * Sound but incomplete: only structural containment is recognised. An
 * unconditional `outer` (empty group) is implied by everything.
 */
export function conditionsImply(
  outer: readonly Condition[] | undefined,
  inner: readonly Condition[] | undefined,
): boolean {
  const innerKeys = new Set((inner ?? []).map(conditionKey));
  return (outer ?? []).every((c) => innerKeys.has(conditionKey(c)));
}

/** `true` when the two groups are the same set of conditions. */
export function sameConditions(
  a: readonly Condition[] | undefined,
  b: readonly Condition[] | undefined,
): boolean {
  return conditionsImply(a, b) && conditionsImply(b, a);
}
