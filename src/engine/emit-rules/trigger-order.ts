/**
 * Deterministic emission order for rules, and the identity of the rule a
 * trigger belongs to.
 *
 * The Karabiner-Elements GUI lists complex modifications in file order, so this
 * order is what the user scrolls through. It is also Karabiner's *evaluation*
 * order, which makes the choice load-bearing rather than cosmetic: the most
 * heavily qualified trigger for a key has to be evaluated before the less
 * qualified ones, or the specific binding is unreachable.
 *
 * Priority, highest first:
 *   1. more mandatory modifiers before fewer — `⌘⌥⌃⇧+A` ▸ `⌘⌥⌃+A` ▸ `⌘+A` ▸ `A`
 *   2. at equal count, ⌘ before ⌥ before ⌃ before ⇧ — `⌘⌥+A` ▸ `⌘⌃+A` ▸ `⌥⌃+A`
 *   3. key triggers before pointer-button triggers
 *   4. trigger keys in natural alphabetical order — `⌘+A` ▸ `⌘+Z`, and `F2` ▸ `F10`
 *   5. finally the modifiers' sides — unsided, then left, then right
 *
 * Side is the *last* tiebreaker on purpose: `⌘⌥` and `L⌘+L⌥` render
 * identically in a rule description, so letting the side outrank the key name
 * would scatter one visually identical modifier group across the list.
 */

import type { Trigger } from "../../data";
import {
  getTriggerKeys,
  isModifierKey,
  isPointerButton,
  resolveButton,
  resolveKeyAlias,
  resolveModifiers,
} from "../utils";

/**
 * ⌘ ⌥ ⌃ ⇧ — the canonical modifier order this project writes everywhere, then
 * the two modifier-ish keys that can also appear as `from.modifiers`.
 */
const MODIFIER_ORDER = ["command", "option", "control", "shift", "fn", "caps_lock"];

/** Unsided before left before right, so `⌥+K` and `⌥>+K` never tie. */
const SIDE_ORDER = ["", "left_", "right_"];

/** Split one modifier into the pair the order is defined on. */
function modifierRank(modifier: string): { base: number; side: number } {
  const resolved = resolveKeyAlias(modifier);
  const side = SIDE_ORDER.find((p) => p !== "" && resolved.startsWith(p)) ?? "";
  const baseRank = MODIFIER_ORDER.indexOf(resolved.slice(side.length));
  return {
    base: baseRank < 0 ? MODIFIER_ORDER.length : baseRank,
    side: SIDE_ORDER.indexOf(side),
  };
}

function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const diff = a[i]! - b[i]!;
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

/** Digit runs compare numerically so `f2` sorts before `f10`. */
const NATURAL_CHUNKS = /\d+|\D+/g;

function naturalCompare(a: string, b: string): number {
  if (a === b) return 0;
  const left = a.match(NATURAL_CHUNKS) ?? [];
  const right = b.match(NATURAL_CHUNKS) ?? [];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const x = left[i]!;
    const y = right[i]!;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return left.length - right.length;
}

export type TriggerSortKey = {
  /** Mandatory modifier ranks (⌘ ⌥ ⌃ ⇧ …), ascending. */
  modifiers: number[];
  /** `true` for a pointer-button trigger. */
  pointer: boolean;
  /** Resolved trigger keys, minus the modifiers folded into `modifiers`. */
  keys: string[];
  /** Side of each entry in `modifiers`, in the same order. */
  sides: number[];
  /** `true` for a `from.any` trigger, which must be evaluated last. */
  catchAll: boolean;
};

/**
 * Reduce a trigger to the tuple the order above is defined on.
 *
 * A chord expresses its modifiers as extra members rather than as
 * `from.modifiers`, and a binding may deliberately emit both encodings of the
 * same physical input — so every member after the first that is a modifier key is
 * folded into `modifiers`. That makes `[⌘⌥⌃⇧]+[CAPS]` and
 * `[CAPS]+[⌘]+[⌥]+[⌃]+[⇧]` produce the same key, which is what keeps the pair
 * adjacent in the output instead of drifting apart.
 */
export function triggerSortKey(trigger: Trigger): TriggerSortKey {
  const rawKeys = getTriggerKeys(trigger);
  const { mandatory } = resolveModifiers(trigger.modifiers);

  const [head, ...rest] = rawKeys;
  const isChord = rawKeys.length > 1;
  const chordModifiers = isChord ? rest.filter(isModifierKey) : [];
  const baseKeys = isChord
    ? [head!, ...rest.filter((k) => !isModifierKey(k))]
    : rawKeys;

  const ranks = [...mandatory, ...chordModifiers]
    .map(modifierRank)
    .sort((a, b) => a.base - b.base || a.side - b.side);

  return {
    modifiers: ranks.map((r) => r.base),
    pointer: rawKeys.length === 1 && isPointerButton(head ?? ""),
    keys: baseKeys.map((k) =>
      isPointerButton(k) ? resolveButton(k).button : resolveKeyAlias(k),
    ),
    sides: ranks.map((r) => r.side),
    catchAll: "any" in trigger,
  };
}

export function compareTriggerSortKeys(a: TriggerSortKey, b: TriggerSortKey): number {
  if (a.modifiers.length !== b.modifiers.length) {
    return b.modifiers.length - a.modifiers.length;
  }
  const byModifier = compareNumbers(a.modifiers, b.modifiers);
  if (byModifier !== 0) return byModifier;

  // A catch-all claims every event of its kind, so anything it shares a rule
  // with has to be evaluated before it — including keys it would otherwise tie
  // with on an empty key list.
  if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1;

  if (a.pointer !== b.pointer) return a.pointer ? 1 : -1;

  for (let i = 0; i < Math.min(a.keys.length, b.keys.length); i++) {
    const diff = naturalCompare(a.keys[i]!, b.keys[i]!);
    if (diff !== 0) return diff;
  }
  if (a.keys.length !== b.keys.length) return a.keys.length - b.keys.length;

  return compareNumbers(a.sides, b.sides);
}

export function compareTriggers(a: Trigger, b: Trigger): number {
  return compareTriggerSortKeys(triggerSortKey(a), triggerSortKey(b));
}

/**
 * Identity of the GUI rule a trigger belongs to.
 *
 * Two triggers share a rule when they have the same keys and the same mandatory
 * modifiers. Optional modifiers are deliberately *not* part of the identity: a
 * `button1` binding scoped to "no modifier held" and one scoped to "any
 * modifier held" are one entry as far as the GUI is concerned, and folding them
 * together is the point. For the same reason the chord and `from.modifiers`
 * encodings of one physical combination share a signature.
 */
export function ruleGroupSignature(trigger: Trigger): string {
  const { modifiers, pointer, keys, sides, catchAll } = triggerSortKey(trigger);
  return JSON.stringify([modifiers, pointer, keys, sides, catchAll]);
}
