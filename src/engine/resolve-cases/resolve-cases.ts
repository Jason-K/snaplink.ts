import type { Case, Condition } from "../../data";
import {
  conditionKey,
  conditionsComplementary,
  resolveCondition,
} from "../resolve-conditions";
import { resolveActionToEvents } from "../resolve-to-action";
import type { CaseGroup, ResolvedCase } from "./types";

export function resolveCases(
  cases: Case[],
  shared: Condition[] | undefined,
): ResolvedCase[] {
  return cases.map((c) => {
    const rawConditions = [...(shared ?? []), ...(c.conditions ?? [])];
    return {
      tapCount: c.tapCount ?? 1,
      phase: c.phase ?? "press",
      delayed: c.delayed ?? false,
      guard: c.guard ?? false,
      conditions: rawConditions.map(resolveCondition),
      rawConditions,
      do: (c.do ?? []).flatMap(resolveActionToEvents),
    };
  });
}

/**
 * Karabiner matches **one** manipulator per input event: it walks the list top
 * to bottom and the first manipulator whose `from` matches and whose conditions
 * hold consumes the event. Every phase — `to` (press), `to_if_alone` (tap /
 * release) and `to_if_held_down` (hold) — is an output channel of that single
 * matched manipulator.
 *
 * So splitting one trigger's cases into one manipulator per condition set is
 * only safe while those condition sets are disjoint. The moment one set is
 * *broader* than another (the extreme being an unconditional case), the broader
 * manipulator's phases are dead in every state the narrower one claims — and
 * because the broader one is emitted last, it is the one that silently never
 * fires. This is not a hold-versus-release quirk; it applies to all three
 * phases equally, in whichever order they happen to be declared.
 *
 * The module below therefore folds phases *down* the condition lattice rather
 * than emitting them side by side: every condition group inherits the phases it
 * does not declare from the groups whose conditions it implies.
 */

const slotOf = (c: ResolvedCase): string => `${c.phase}#${c.tapCount}`;

/** Whether every condition in `sub` also appears in `sup`. */
export function subsumesConditions(sup: unknown[], sub: unknown[]): boolean {
  if (sub.length === 0) return true;
  if (sub.length > sup.length) return false;
  const present = new Set(sup.map((c) => JSON.stringify(c)));
  return sub.every((c) => present.has(JSON.stringify(c)));
}

/** One emitted manipulator's worth of cases: a distinct condition signature. */
type Signature = {
  conditions: unknown[];
  rawConditions: Condition[];
  cases: ResolvedCase[];
};

/** Bucket cases by their resolved condition set, in first-declared order. */
function signaturesOf(cases: ResolvedCase[]): Signature[] {
  const groups = new Map<string, Signature>();
  for (const c of cases) {
    const key = JSON.stringify(c.conditions);
    const existing = groups.get(key);
    if (existing) existing.cases.push(c);
    else
      groups.set(key, {
        conditions: c.conditions,
        rawConditions: c.rawConditions,
        cases: [c],
      });
  }
  return [...groups.values()];
}

/**
 * Order signatures so no manipulator is emitted ahead of one it would swallow.
 *
 * Declaration order is preserved except where it has to give: a signature is
 * moved ahead of the first already-placed signature whose conditions it
 * strictly implies, since that broader manipulator would otherwise match first
 * and the narrower one would never be reached. Unrelated signatures — neither
 * implies the other — keep the order the author wrote them in, which is what
 * the mouse chord bindings depend on.
 */
function orderBySpecificity(signatures: Signature[]): Signature[] {
  const ordered: Signature[] = [];
  for (const s of signatures) {
    const shadowedIdx = ordered.findIndex(
      (placed) =>
        placed.conditions.length < s.conditions.length &&
        subsumesConditions(s.conditions, placed.conditions),
    );
    if (shadowedIdx < 0) ordered.push(s);
    else ordered.splice(shadowedIdx, 0, s);
  }
  return ordered;
}

/**
 * A signature that declares nothing but `press` cases is an *immediate
 * override*, not a variant of the broader gesture.
 *
 * `to` fires on key-down and resolves the input there and then, before the
 * tap/hold arbitration a broader signature describes — the chord bindings in
 * `definitions/mouse.ts` use exactly this to say "while the right button is
 * held, this button does one immediate thing instead of its usual tap/hold".
 * Handing such a group the broader group's `to_if_alone` / `to_if_held_down`
 * would staple the usual gesture back on top of the override. So it inherits
 * nothing; to opt in, declare the phase explicitly (an empty `release([])` /
 * `hold([])` suppresses it just as explicitly).
 */
function isImmediateOverride(s: Signature): boolean {
  return s.cases.every((c) => c.phase === "press");
}

/**
 * The cases `target` inherits from broader signatures: for each phase/tapCount
 * slot it does not declare itself, the nearest signature whose conditions it
 * implies. "Nearest" is the most-conditioned donor, so a two-condition group
 * beats an unconditional one.
 */
function inheritedCases(target: Signature, all: Signature[]): ResolvedCase[] {
  if (isImmediateOverride(target)) return [];
  const filled = new Set(target.cases.map(slotOf));
  const donors = all
    .filter(
      (d) =>
        d !== target &&
        d.conditions.length < target.conditions.length &&
        subsumesConditions(target.conditions, d.conditions),
    )
    .sort((a, b) => b.conditions.length - a.conditions.length);

  const inherited: ResolvedCase[] = [];
  for (const donor of donors) {
    const claimed = new Set<string>();
    for (const c of donor.cases) {
      const slot = slotOf(c);
      if (filled.has(slot)) continue;
      inherited.push(c);
      claimed.add(slot);
    }
    // Only after the whole donor, so a donor contributing several cases to one
    // slot contributes all of them rather than just the first.
    for (const slot of claimed) filled.add(slot);
  }
  return inherited;
}

/** The conditions `inner` adds on top of `outer`, or `null` if it lacks any. */
function extraConditions(inner: Signature, outer: Signature): Condition[] | null {
  const innerKeys = new Set(inner.rawConditions.map(conditionKey));
  if (!outer.rawConditions.every((c) => innerKeys.has(conditionKey(c))))
    return null;
  const outerKeys = new Set(outer.rawConditions.map(conditionKey));
  return inner.rawConditions.filter((c) => !outerKeys.has(conditionKey(c)));
}

/**
 * Whether the folded groups leave `s` nothing to catch.
 *
 * The shape that matters is a fallback sitting behind a complementary pair —
 * `In Excel` / `Outside Excel`, `left button held` / `not held`. Between them
 * those two claim every state `s` itself would match, and both have already
 * inherited every phase `s` declares, so `s`'s own manipulator can only ever be
 * dead weight. Anything less than a provably exhaustive pair keeps its
 * fallback: an unreachable manipulator is inert, a missing one is a broken key.
 */
function isFullyCovered(s: Signature, folded: Map<Signature, ResolvedCase[]>): boolean {
  const slots = [...new Set(s.cases.map(slotOf))];
  const children: { sig: Signature; extra: Condition[] }[] = [];
  for (const other of folded.keys()) {
    if (other === s) continue;
    const extra = extraConditions(other, s);
    if (extra?.length !== 1) continue;
    const inherits = new Set(folded.get(other)!.map(slotOf));
    if (!slots.every((slot) => inherits.has(slot))) continue;
    children.push({ sig: other, extra });
  }
  return children.some((a) =>
    children.some(
      (b) => a !== b && conditionsComplementary(a.extra[0]!, b.extra[0]!),
    ),
  );
}

/**
 * Fold each signature's inherited phases in and drop the fallbacks that folding
 * has made unreachable.
 */
function foldSignatures(cases: ResolvedCase[]): Map<Signature, ResolvedCase[]> {
  const signatures = orderBySpecificity(signaturesOf(cases));
  const folded = new Map<Signature, ResolvedCase[]>(
    signatures.map((s) => [s, [...s.cases, ...inheritedCases(s, signatures)]]),
  );
  for (const s of signatures) {
    if (isFullyCovered(s, folded)) folded.delete(s);
  }
  return folded;
}

/**
 * Split a binding's cases into one manipulator's worth of phases per distinct
 * condition set, folding inherited phases in so that every manipulator carries
 * the complete gesture that applies under its own conditions.
 */
export function groupByConditions(cases: ResolvedCase[]): CaseGroup[] {
  return [...foldSignatures(cases)].map(([s, folded]) => {
    const g: CaseGroup = {
      conditions: s.conditions,
      rawConditions: s.rawConditions,
      pressDo: [],
      releaseDo: [],
      holdDo: [],
      hasRelease: false,
      hasHold: false,
    };
    for (const c of folded) {
      if (c.phase === "press") g.pressDo.push(...c.do);
      if (c.phase === "release") {
        g.releaseDo.push(...c.do);
        g.hasRelease = true;
      }
      if (c.phase === "hold") {
        g.holdDo.push(...c.do);
        g.hasHold = true;
      }
    }
    return g;
  });
}

/**
 * The multi-tap equivalent of {@link groupByConditions}: the same ordering and
 * the same inheritance, but handing back the cases themselves because
 * `buildMultiTap` needs the `tapCount` and `delayed` flags the flattened
 * {@link CaseGroup} throws away.
 */
export function groupMultiTapCases(cases: ResolvedCase[]): {
  conditions: unknown[];
  cases: ResolvedCase[];
}[] {
  return [...foldSignatures(cases)].map(([s, folded]) => ({
    conditions: s.conditions,
    cases: folded,
  }));
}

export function unionRawConditions(cases: ResolvedCase[]): Condition[] {
  const seen = new Set<string>();
  const out: Condition[] = [];
  for (const c of cases) {
    for (const cond of c.rawConditions) {
      const key = JSON.stringify(cond);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cond);
      }
    }
  }
  return out;
}
