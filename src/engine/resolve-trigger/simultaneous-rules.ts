import type { Rule, SimultaneousKeyOrder } from "../../types/karabiner";
import type { ActionSpec, Binding, Case, SimOrder, TriggerKey } from "../../data";
import { defineBindings, resolveModifiers } from "../emit-manipulators/compile-binding";

/**
 * Authoring-facing mirror of Karabiner's `from.simultaneous_options`.
 *
 * Identical to {@link import('../../types/karabiner').SimultaneousOptions}
 * except that `to_after_key_up` takes high-level {@link ActionSpec}s rather
 * than resolved `ToEvent`s — the adapter below splits it off onto
 * `binding.afterKeyUp` and the engine re-merges it after resolution.
 */
export type SimultaneousOptions = {
  detect_key_down_uninterruptedly?: boolean;
  key_down_order?: SimultaneousKeyOrder;
  key_up_order?: SimultaneousKeyOrder;
  key_up_when?: "any" | "all";
  to_after_key_up?: ActionSpec[];
};

export type SimultaneousConfig = {
  keys: TriggerKey[];
  description?: string;
  to?: ActionSpec[];
  alone?: ActionSpec[];
  hold?: ActionSpec[];
  tapTap?: ActionSpec[];
  tapTapHold?: ActionSpec[];
  thresholdMs?: number;
  simultaneousOptions?: SimultaneousOptions;
  simultaneousThresholdMs?: number;
};

/**
 * Map the user-facing `SimultaneousOptions` (Karabiner JSON shape) to the
 * `SimOrder` slice stored on a Binding's `trigger.order`. The `to_after_key_up`
 * field is split off — it becomes `binding.afterKeyUp` (resolved ActionSpec[])
 * in the adapter, then re-merged into `karOptions` by `compile-binding.ts` when the
 * simultaneous core primitive is called.
 */
function resolveOrder(simOpts: SimultaneousOptions | undefined): SimOrder | undefined {
  if (!simOpts) return undefined;
  const o: SimOrder = {};
  if (simOpts.key_down_order) o.down = simOpts.key_down_order;
  if (simOpts.key_up_order) o.up = simOpts.key_up_order;
  if (simOpts.key_up_when) o.upWhen = simOpts.key_up_when;
  if (simOpts.detect_key_down_uninterruptedly) o.detectUninterrupted = true;
  return Object.keys(o).length ? o : undefined;
}

export function generateSimultaneousRules(
  mappingsOrBindings: Record<string, SimultaneousConfig> | Binding[],
  tapHoldBindings: Binding[],
): Rule[] {
  if (Array.isArray(mappingsOrBindings)) {
    validateSimultaneousBindings(mappingsOrBindings, tapHoldBindings);
    return defineBindings(mappingsOrBindings);
  }

  validateMappings(mappingsOrBindings, tapHoldBindings);

  const bindings: Binding[] = Object.entries(mappingsOrBindings).map(([, config]) => {
    const cases: Case[] = [];
    if (config.to) cases.push({ phase: "press", do: config.to });
    if (config.alone) cases.push({ phase: "release", do: config.alone });
    if (config.hold) cases.push({ phase: "hold", do: config.hold });
    if (config.tapTap) cases.push({ tapCount: 2, phase: "release", do: config.tapTap });
    if (config.tapTapHold) cases.push({ tapCount: 2, phase: "hold", do: config.tapTapHold });

    const order = resolveOrder(config.simultaneousOptions);
    return {
      trigger: {
        keys: config.keys,
        ...(order ? { order } : {}),
      },
      timing: {
        ...(config.thresholdMs !== undefined
          ? { aloneMs: config.thresholdMs, heldThresholdMs: config.thresholdMs }
          : {}),
        ...(config.simultaneousThresholdMs !== undefined
          ? { simultaneousMs: config.simultaneousThresholdMs }
          : {}),
      },
      ...(config.simultaneousOptions?.to_after_key_up
        ? { afterKeyUp: config.simultaneousOptions.to_after_key_up }
        : {}),
      cases,
    };
  });
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

function validateMappings(
  mappings: Record<string, SimultaneousConfig>,
  tapHoldBindings: Binding[],
): void {
  // Input validation
  for (const [label, config] of Object.entries(mappings)) {
    if (config.keys.length < 2) {
      throw new Error(
        `Simultaneous chord "${label}": requires at least 2 keys, got ${config.keys.length}.`,
      );
    }
    if (config.tapTap && config.tapTapHold) {
      throw new Error(
        `Simultaneous chord "${label}": tapTap and tapTapHold are mutually exclusive.`,
      );
    }
    if (!config.to && !config.alone && !config.hold && !config.tapTap && !config.tapTapHold) {
      throw new Error(
        `Simultaneous chord "${label}": no action fields specified (to, alone, hold, tapTap, or tapTapHold). This would produce a no-op rule.`,
      );
    }
  }

  // Check 1: duplicate chords (order-aware)
  const seen = new Map<string, string>(); // normalizedKey → label
  for (const [label, config] of Object.entries(mappings)) {
    const key = normalizedChordKey(
      config.keys,
      config.simultaneousOptions?.key_down_order,
    );
    if (seen.has(key)) {
      throw new Error(
        `Simultaneous chord "${label}" is a duplicate of "${seen.get(key)}" — same keys and key_down_order.`,
      );
    }
    seen.set(key, label);
  }

  // Check 2: tap-hold key overlap (bare keys only — no modifier prefix)
  const bareHoldKeys = new Set(
    tapHoldBindings
      .filter((b) => {
        if (!("keys" in b.trigger)) return false;
        const { mandatory, optional } = resolveModifiers(b.trigger.modifiers);
        return mandatory.length === 0 && optional.length === 0;
      })
      .flatMap((b) => (b.trigger as { keys: string[] }).keys),
  );
  for (const [label, config] of Object.entries(mappings)) {
    for (const key of config.keys) {
      if (bareHoldKeys.has(key)) {
        throw new Error(
          `Simultaneous chord "${label}" conflict: key "${key}" is also defined as a bare tap-hold key. ` +
            `Add a modifier prefix to the tap-hold entry (e.g., "cmd+${key}") to resolve the ambiguity.`,
        );
      }
    }
  }
}
