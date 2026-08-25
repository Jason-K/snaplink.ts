import type { Rule } from "../../types/karabiner";
import type { Binding } from "../../data";
import { defineBindings, resolveModifiers } from "../emit-manipulators/compile-binding";

export function generateSimultaneousRules(
  bindings: Binding[],
  tapHoldBindings: Binding[],
): Rule[] {
  validateSimultaneousBindings(bindings, tapHoldBindings);
  return defineBindings(bindings);
}

function normalizedChordKey(keys: string[], keyDownOrder?: string): string {
  const sorted =
    keyDownOrder === "strict" || keyDownOrder === "strict_inverse"
      ? keys.join(",")
      : [...keys].sort().join(",");
  return `${sorted}__${keyDownOrder ?? "insensitive"}`;
}

function validateSimultaneousBindings(
  bindings: Binding[],
  tapHoldBindings: Binding[],
): void {
  for (const b of bindings) {
    const keys = "keys" in b.trigger ? b.trigger.keys : [];
    if (keys.length < 2) {
      throw new Error(
        `Simultaneous binding "${b.description ?? "unnamed"}": requires at least 2 keys, got ${keys.length}.`,
      );
    }
    if (!b.cases.length) {
      throw new Error(
        `Simultaneous binding "${b.description ?? "unnamed"}": no action cases specified. This would produce a no-op rule.`,
      );
    }
  }

  // Check 1: duplicate chords (order-aware)
  const seen = new Map<string, string>();
  for (const b of bindings) {
    const keys = "keys" in b.trigger ? b.trigger.keys : [];
    const downOrder = "order" in b.trigger ? b.trigger.order?.down : undefined;
    const key = normalizedChordKey(keys, downOrder);
    const label = b.description ?? keys.join("+");
    if (seen.has(key)) {
      throw new Error(
        `Simultaneous chord "${label}" is a duplicate of "${seen.get(key)}" — same keys and key_down_order.`,
      );
    }
    seen.set(key, label);
  }

  // Check 2: tap-hold key overlap
  const bareHoldKeys = new Set(
    tapHoldBindings
      .filter((b) => {
        if (!("keys" in b.trigger)) return false;
        const { mandatory, optional } = resolveModifiers(b.trigger.modifiers);
        return mandatory.length === 0 && optional.length === 0;
      })
      .flatMap((b) => (b.trigger as { keys: string[] }).keys),
  );
  for (const b of bindings) {
    const keys = "keys" in b.trigger ? b.trigger.keys : [];
    const label = b.description ?? keys.join("+");
    for (const key of keys) {
      if (bareHoldKeys.has(key)) {
        throw new Error(
          `Simultaneous chord "${label}" conflict: key "${key}" is also defined as a bare tap-hold key. ` +
            `Add a modifier prefix to the tap-hold entry (e.g., "cmd+${key}") to resolve the ambiguity.`,
        );
      }
    }
  }
}
