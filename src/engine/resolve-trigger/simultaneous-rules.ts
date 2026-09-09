import type { Rule } from "../../types/karabiner";
import type { Binding } from "../../data";
import { defineBindings } from "../emit-manipulators/compile-binding";

export function generateSimultaneousRules(
  bindings: Binding[],
  _tapHoldBindings?: Binding[],
): Rule[] {
  validateSimultaneousBindings(bindings);
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
}

