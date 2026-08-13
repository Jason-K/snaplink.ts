/**
 * The complete generated configuration, assembled from `src/definitions/`.
 *
 * Pure: importing this module performs no I/O and reads no environment. That is
 * what lets tests compile the real configuration and diff it against the
 * committed golden file without the build's filesystem side effects.
 */

import { DEVICES } from "./data";
import {
  buildCapsLockBindings,
  disabledHotkeys,
  guardBindings,
  mouseBindings,
  NUMPAD_REMAPS,
  simultaneousMappings,
  tapHoldBindings,
} from "./definitions";
import type { Binding, PointerTweak } from "./data";
import type { AnalysisReport, DeviceConfig, PlannedBinding, RulePlan } from "./engine";
import {
  assertNoConflictsInOrder,
  buildDeviceConfig,
  emitPointerTweaks,
  emitRules,
  generateSimultaneousRules,
  planRules,
} from "./engine";
import type { Rule } from "./types/karabiner";

/**
 * Every binding set.
 *
 * Declaration order here is only a tiebreaker: `planRules()` decides the order
 * rules are actually emitted in, from the triggers themselves (most modifiers
 * first, then ⌘ ⌥ ⌃ ⇧, then alphabetical). Two bindings that resolve to the same
 * trigger stay in the order they appear here, whichever sets they came from.
 */
export const BINDING_SETS: ReadonlyArray<{ name: string; bindings: Binding[] }> = [
  { name: "tap-hold", bindings: tapHoldBindings },
  { name: "guards", bindings: guardBindings },
  { name: "mouse", bindings: mouseBindings },
  { name: "disabled-hotkeys", bindings: disabledHotkeys },
];

/**
 * The caps lock layer, planned separately so it can be emitted ahead of
 * everything else.
 *
 * Trigger order cannot express this. A layer manipulator for `q` has no
 * mandatory modifiers — the layer key emits none — so it would sort level with
 * the plain `q` tap-hold rule and lose the tiebreak, and the plain rule would
 * consume the key before the layer ever saw it. Every layer manipulator is
 * conditioned on `caps_lock_pressed`, so putting them first costs nothing when
 * caps is not held.
 *
 * It is built from {@link BINDING_SETS} rather than alongside them: any binding
 * triggered by the combination a layer state emits (`⌘⌥⌃⇧+E` for the base
 * layer) is adopted into the layer, because Karabiner never re-reads its own
 * output and an emitted `⌘⌥⌃⇧+E` would otherwise reach nothing.
 */
export const CAPS_LAYER_SET: { name: string; bindings: Binding[] } = {
  name: "caps-layer",
  bindings: buildCapsLockBindings(BINDING_SETS.flatMap((s) => s.bindings)),
};

/**
 * Pointer tweaks — `mouse_basic` and `mouse_motion_to_scroll`.
 *
 * Empty by design. Both manipulator types can render a machine undriveable if
 * mis-scoped (gotchas 1.2, 1.3), so nothing is enabled until it is deliberately
 * added here. The types refuse the unscoped forms; `emitPointerTweaks` refuses
 * them again at build time.
 *
 * Test any addition with a second pointing device attached, or with the
 * built-in trackpad available as a fallback.
 */
export const POINTER_TWEAKS: PointerTweak[] = [];

/** Device-scoped settings and simple modifications. */
export const DEVICE_CONFIGS: DeviceConfig[] = [
  buildDeviceConfig(DEVICES.appleNumericKeypad, [...NUMPAD_REMAPS]),
  buildDeviceConfig(DEVICES.g502X),
];

/** The rule layout the build emits: grouping, ordering and descriptions. */
export function rulePlan(): RulePlan[] {
  return [...planRules([CAPS_LAYER_SET]), ...planRules(BINDING_SETS)];
}

/** Every binding in the order Karabiner will evaluate it. */
export function orderedBindings(): PlannedBinding[] {
  return rulePlan().flatMap((plan) => plan.bindings);
}

/**
 * Compile every binding set into the final ordered rule list.
 *
 * Conflict analysis runs first, over the planned order rather than the
 * declaration order, and throws on any rule that a preceding rule makes
 * unreachable — so an unfireable binding fails the build rather than sitting
 * silently dead in the config.
 *
 * @throws {import('./engine').RuleConflictError} on unreachable rules.
 */
export function buildRules(): { rules: Rule[]; analysis: AnalysisReport } {
  const plans = rulePlan();
  const analysis = assertNoConflictsInOrder(plans.flatMap((p) => p.bindings));
  const rules = [
    // Chords stay ahead of everything: a single-key rule for one of a chord's
    // members can consume the chord's first key-down, and trigger order alone
    // cannot express that dependency.
    ...generateSimultaneousRules(simultaneousMappings, tapHoldBindings),
    ...emitRules(plans),
    // Last: these claim pointer motion, which no key rule competes for, so
    // their position is free — and keeping them out of the key-rule block keeps
    // the emitted ordering readable.
    ...emitPointerTweaks(POINTER_TWEAKS),
  ];
  return { rules, analysis };
}
