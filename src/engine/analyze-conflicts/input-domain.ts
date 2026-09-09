/**
 * Input-domain model for conflict analysis.
 *
 * A binding's *input domain* is the set of physical input events it can match:
 * the trigger key(s) plus every modifier combination Karabiner would accept.
 * Conflict detection is set intersection over these domains — not equality of a
 * signature string, which both misses subset relationships and false-positives
 * on rules that deliberately share a trigger under disjoint conditions.
 */

import type { Trigger } from "../../data";
import {
  getTriggerKeys,
  isPointerButton,
  resolveButton,
  resolveKeyAlias,
  resolveModifiers,
} from "../utils";

/**
 * Karabiner's modifier matching rule: a manipulator matches a held-modifier set
 * `M` when `mandatory ⊆ M ⊆ mandatory ∪ optional`. `optional: ["any"]` lifts the
 * upper bound to every modifier, so the domain becomes "mandatory plus anything".
 */
export type ModifierDomain = {
  /** Modifiers that must be held. */
  mandatory: ReadonlySet<string>;
  /** Upper bound: mandatory ∪ optional, or `"any"` for no upper bound. */
  allowed: ReadonlySet<string> | "any";
};

export type InputDomain = {
  /**
   * `chord` triggers match a simultaneous press; `any` matches every event of
   * one kind; the others match one event.
   */
  kind: "key" | "pointer" | "chord" | "any";
  /** Resolved key codes / button ids. Sorted for chords, empty for `any`. */
  keys: readonly string[];
  modifiers: ModifierDomain;
};

/** Resolve one trigger key or pointer alias to its emitted key code / button id. */
function resolveTriggerKey(key: string): string {
  return isPointerButton(key) ? resolveButton(key).button : resolveKeyAlias(key);
}

export function toInputDomain(trigger: Trigger): InputDomain {
  if ("any" in trigger) {
    const { mandatory, optional } = resolveModifiers(trigger.modifiers);
    return {
      kind: "any",
      keys: [trigger.any],
      modifiers: {
        mandatory: new Set(mandatory),
        allowed: optional.includes("any")
          ? "any"
          : new Set([...mandatory, ...optional]),
      },
    };
  }
  const rawKeys = getTriggerKeys(trigger);
  const keys = rawKeys.map(resolveTriggerKey);
  const { mandatory, optional } = resolveModifiers(trigger.modifiers);

  // A simultaneous trigger is emitted with `modifiers: { optional: ["any"] }`,
  // so it matches regardless of what else is held.
  const isChord = keys.length > 1;
  const allowed: ReadonlySet<string> | "any" =
    isChord || optional.includes("any")
      ? "any"
      : new Set([...mandatory, ...optional]);

  return {
    kind: isChord ? "chord" : isPointerButton(rawKeys[0] ?? "") ? "pointer" : "key",
    keys: isChord ? [...keys].sort() : keys,
    modifiers: { mandatory: new Set(mandatory), allowed },
  };
}

function isSubset(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && isSubset(a, b);
}

/** `true` when every modifier set `inner` accepts is also accepted by `outer`. */
export function modifierDomainContains(
  outer: ModifierDomain,
  inner: ModifierDomain,
): boolean {
  // outer must not require a modifier that inner leaves free.
  if (!isSubset(outer.mandatory, inner.mandatory)) return false;
  if (outer.allowed === "any") return true;
  if (inner.allowed === "any") return false;
  return isSubset(inner.allowed, outer.allowed);
}

/** `true` when the two modifier domains share at least one held-modifier set. */
export function modifierDomainsIntersect(
  a: ModifierDomain,
  b: ModifierDomain,
): boolean {
  // The smallest candidate set satisfying both lower bounds.
  const union = new Set([...a.mandatory, ...b.mandatory]);
  const withinBound = (d: ModifierDomain) =>
    d.allowed === "any" || isSubset(union, d.allowed);
  return withinBound(a) && withinBound(b);
}

function sameKeys(a: InputDomain, b: InputDomain): boolean {
  return (
    a.kind === b.kind &&
    a.keys.length === b.keys.length &&
    a.keys.every((k, i) => k === b.keys[i])
  );
}

/** Which domain kinds a `from.any` of each type claims. */
const ANY_CLAIMS: Record<string, ReadonlySet<InputDomain["kind"]>> = {
  // A catch-all on key codes also claims a chord: it consumes the chord's
  // first key-down before the simultaneous match can complete.
  key_code: new Set<InputDomain["kind"]>(["key", "chord"]),
  consumer_key_code: new Set<InputDomain["kind"]>(["key"]),
  pointing_button: new Set<InputDomain["kind"]>(["pointer"]),
};

/**
 * Key-space containment, which unlike key-space *equality* is directional: a
 * `from.any` covers every specific trigger of its kind, never the reverse.
 */
function keySpaceContains(outer: InputDomain, inner: InputDomain): boolean {
  if (outer.kind === "any") {
    return inner.kind === "any"
      ? outer.keys[0] === inner.keys[0]
      : (ANY_CLAIMS[outer.keys[0] ?? ""]?.has(inner.kind) ?? false);
  }
  if (inner.kind === "any") return false;
  return sameKeys(outer, inner);
}

function keySpacesIntersect(a: InputDomain, b: InputDomain): boolean {
  if (a.kind === "any" || b.kind === "any") {
    return keySpaceContains(a, b) || keySpaceContains(b, a);
  }
  return sameKeys(a, b);
}

/** `true` when every input event `inner` matches is also matched by `outer`. */
export function inputDomainContains(outer: InputDomain, inner: InputDomain): boolean {
  if (!keySpaceContains(outer, inner)) return false;
  return modifierDomainContains(outer.modifiers, inner.modifiers);
}

/** `true` when the two domains can both match the same input event. */
export function inputDomainsIntersect(a: InputDomain, b: InputDomain): boolean {
  if (!keySpacesIntersect(a, b)) return false;
  return modifierDomainsIntersect(a.modifiers, b.modifiers);
}

export function sameInputDomain(a: InputDomain, b: InputDomain): boolean {
  return (
    sameKeys(a, b) &&
    setsEqual(a.modifiers.mandatory, b.modifiers.mandatory) &&
    (a.modifiers.allowed === "any" || b.modifiers.allowed === "any"
      ? a.modifiers.allowed === b.modifiers.allowed
      : setsEqual(a.modifiers.allowed, b.modifiers.allowed))
  );
}

/** Human-readable domain label for diagnostics, e.g. `left_command+q` or `a+b (chord)`. */
export function describeInputDomain(domain: InputDomain): string {
  const mods = [...domain.modifiers.mandatory].sort();
  const keys = domain.keys.join("+");
  const base = mods.length ? `${mods.join("+")}+${keys}` : keys;
  const anySuffix = domain.modifiers.allowed === "any" ? " (+any modifiers)" : "";
  if (domain.kind === "any") return `any ${keys}${anySuffix}`;
  return domain.kind === "chord" ? `${base} (chord)${anySuffix}` : `${base}${anySuffix}`;
}
