/**
 * Scope combinators — apply one condition, or one set of options, to a whole
 * block of bindings.
 *
 * The alternative is repetition, and repetition is where scoping goes wrong.
 * Today an app-scoped family is written by attaching `.when(APPS.excel)` to
 * every case of every binding, and a layer-gated family by attaching
 * `when(VARS.fooDown)` to each one. Both are mechanical, and both fail the same
 * way: the moment one binding in the block is missed, that binding fires
 * *everywhere* — and because a broader binding shadowing a narrower one is
 * exactly the failure `analyze-conflicts` reports as `shadowed`, the symptom
 * surfaces far from the omission.
 *
 * These combinators make the scope a property of the block rather than of each
 * binding in it, so there is nothing to forget:
 *
 * ```ts
 * ...forApp(APPS.excel, [
 *   bind(from("p", VM.C__S), to(press(COMBOS.excelPalette))),
 *   bind(from("return_or_enter"), to(hold(key("f2")))),
 * ]),
 * ```
 *
 * ## What they attach to, and why it is safe
 *
 * A scope condition lands on `Binding.conditions` — the *hoisted* set, which
 * `resolveCases()` prepends to every case in the binding. That uniformity is
 * what makes scoping composable with the condition-lattice folding in
 * `resolve-cases.ts`: adding the same condition to every case of a binding
 * shifts the whole binding down the lattice without changing the relationships
 * *between* its cases, so per-case `.when(...)` overrides keep working exactly
 * as they did unscoped.
 *
 * Nesting composes, outermost condition first:
 *
 * ```ts
 * ...forApp(APPS.word, whileVar(VARS.rCmdDown, [ bind(...) ]))
 * // conditions: [ {app: Word}, {var: rCmdDown, equals: 1} ]
 * ```
 *
 * ## Options merge, binding wins
 *
 * `withOptions()` and `withTiming()` supply *defaults*: a field the binding
 * already set is left alone, because the binding is the more specific
 * statement. `timing` merges field-by-field rather than wholesale, so
 * `withTiming("snappy", [...])` over a binding that set only `delayedMs` yields
 * the profile's `aloneMs`/`holdMs` and the binding's `delayedMs`.
 *
 * Nothing here mutates: every combinator returns fresh `Binding` objects, so
 * the same binding array can be scoped more than once.
 */

import type {
  AppSpec,
  Binding,
  BindingRuleGroup,
  Condition,
  DeviceSpec,
  PathSpec,
  VarSpec,
} from "../../data";
import { isTimingProfileName, TIMING_PROFILES, type TimingProfileName } from "../../data";
import type { BindingOptionsSpec, OptionsWrapper } from "./binding-wrappers";
import {
  condApp,
  condDevice,
  condNotApp,
  ifUserVar,
  unlessUserVar,
  when,
  type StateItem,
  type WhenWrapper,
} from "./condition-wrappers";

// Type-only imports to enable IDE IntelliSense {@link ...} symbol resolution in JSDoc comments.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { APPS, DEVICES, VARS } from "../../data";
import type { bind, bindTable, holdLayer, options, timing } from "./binding-wrappers";
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * A block of bindings accepted by scope combinators (e.g. single {@link Binding}, an array of {@link Binding}s, or variadic bindings).
 *
 * Supports flat bindings or nested arrays from {@link bindTable}, {@link holdLayer}, or other scope wrappers.
 */
export type BindingBlock = Binding | readonly Binding[];

function flatten(blocks: readonly BindingBlock[]): Binding[] {
  return blocks.flatMap((b) => (Array.isArray(b) ? [...b] : [b as Binding]));
}

/**
 * Prepend conditions to a binding's hoisted set, returning a new binding.
 *
 * Prepended rather than appended so that nesting reads outside-in: the
 * outermost scope's condition is first in the emitted list, matching the order
 * the call sites are written in.
 */
function addConditions(b: Binding, conditions: readonly Condition[]): Binding {
  if (conditions.length === 0) return { ...b };
  return { ...b, conditions: [...conditions, ...(b.conditions ?? [])] };
}

/**
 * Applies an arbitrary set of conditions to every {@link Binding} in a block.
 *
 * Use as the foundational scope combinator to hoist shared conditions across multiple bindings at once without repeating `.when(...)` on every case.
 * Accepts pre-built {@link Condition}s, {@link WhenWrapper} containers, bare registry specs (`APPS.*`, `DEVICES.*`, `VARS.*`), or `[target, value]` tuples.
 *
 * @param conditions - A {@link when} wrapper, a {@link Condition}, or any bare {@link StateItem}.
 * @param blocks - One or more {@link BindingBlock} entries (single bindings, arrays, or table results).
 * @returns An array of new {@link Binding} objects carrying the scope conditions ahead of their own.
 *
 * @example
 * ```ts
 * ...scoped(when(APPS.word, VARS.rCmdDown), [
 *   bind(from("j"), to(press(key("down_arrow")))),
 *   bind(from("k"), to(press(key("up_arrow")))),
 * ])
 * ```
 */
export function scoped(
  conditions: WhenWrapper | Condition | readonly Condition[] | StateItem,
  ...blocks: BindingBlock[]
): Binding[] {
  const resolved =
    typeof conditions === "object" &&
    conditions !== null &&
    "kind" in conditions &&
    (conditions as WhenWrapper).kind === "when"
      ? (conditions as WhenWrapper).conditions
      : when(conditions as StateItem).conditions;
  return flatten(blocks).map((b) => addConditions(b, resolved));
}

/**
 * Scopes a block of bindings to only activate while one or more specified applications are frontmost.
 *
 * Use when defining a collection of app-specific hotkeys and overrides (e.g. custom shortcuts for Excel, Xcode, or Finder).
 *
 * @param app - {@link AppSpec} (e.g. `APPS.excel`), {@link PathSpec}, bundle ID string, or array of apps.
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects gated by the application condition.
 *
 * @example
 * ```ts
 * ...forApp(APPS.excel, [
 *   bind(from("p", VM.C__S), to(press(COMBOS.excelPalette))),
 *   bind(from("return_or_enter"), to(hold(key("f2")))),
 * ])
 * ```
 */
export function forApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(condApp(app), ...blocks);
}

/**
 * Scopes a block of bindings to activate everywhere *except* when one or more specified applications are frontmost.
 *
 * Use when defining global hotkeys that should be suppressed in specific applications (e.g. games, terminal emulators, or IDEs).
 *
 * @param app - {@link AppSpec} (e.g. `APPS.excel`), {@link PathSpec}, bundle ID string, or array of apps.
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects with the negated application condition.
 *
 * @example
 * ```ts
 * ...exceptInApp(APPS.excel, [
 *   bind(from("return_or_enter"), to(hold(URLS.hsFormatSubstring))),
 * ])
 * ```
 */
export function exceptInApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(condNotApp(app), ...blocks);
}

/**
 * Gates a block of bindings on a Karabiner state variable equaling `1` (the layer idiom).
 *
 * Use when defining a family of shortcuts that belong to a hold layer or mode toggle without using {@link holdLayer}.
 *
 * @param variable - The {@link VarSpec} variable to test.
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects that only fire while `variable` is `1`.
 *
 * @example
 * ```ts
 * ...whileVar(VARS.rCmdDown, [
 *   bind(from("a"), to(press(APPS.antinote))),
 *   bind(from("b"), to(press(APPS.brave))),
 * ])
 * ```
 */
export function whileVar(variable: VarSpec, ...blocks: BindingBlock[]): Binding[] {
  return scoped(ifUserVar(variable, 1), ...blocks);
}

/**
 * Gates a block of bindings on a Karabiner state variable equaling a specific numeric, string, or boolean value.
 *
 * Use when scoping bindings to a multi-state mode index or named state variable (e.g. window management mode, leader key mode).
 *
 * @param variable - The {@link VarSpec} variable to test.
 * @param value - Expected value required for a match (`string`, `number`, or `boolean`).
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects that only fire while `variable` equals `value`.
 *
 * @example
 * ```ts
 * ...whileVarIs(VARS.mode, "window", [
 *   bind(from("h"), to(press(URLS.hsWinLeftTop))),
 * ])
 * ```
 */
export function whileVarIs(
  variable: VarSpec,
  value: string | number | boolean,
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(ifUserVar(variable, value), ...blocks);
}

/**
 * Gates a block of bindings on a Karabiner state variable *not* holding `1` (variable suppression).
 *
 * Use when suppressing global bindings or default keys while a temporary hold layer or modal layer is active.
 *
 * @param variable - The {@link VarSpec} variable to test.
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects that only fire while `variable` is not `1`.
 *
 * @example
 * ```ts
 * ...unlessVar(VARS.capsLockDown, tapHoldBindings)
 * ```
 */
export function unlessVar(variable: VarSpec, ...blocks: BindingBlock[]): Binding[] {
  return scoped(unlessUserVar(variable, 1), ...blocks);
}

/**
 * Gates a block of bindings on a Karabiner state variable *not* equaling a specific value.
 *
 * Use when suppressing bindings while a specific named mode or sublayer state is active.
 *
 * @param variable - The {@link VarSpec} variable to test.
 * @param value - Value that blocks a match (`string`, `number`, or `boolean`).
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects that only fire while `variable` does not equal `value`.
 *
 * @example
 * ```ts
 * ...unlessVarIs(VARS.mode, "gaming", standardShortcuts)
 * ```
 */
export function unlessVarIs(
  variable: VarSpec,
  value: string | number | boolean,
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(unlessUserVar(variable, value), ...blocks);
}

/**
 * Scopes a block of bindings to events originating from a specific physical hardware device.
 *
 * Use when customizing behavior exclusively for a particular external keyboard, mouse, or trackball.
 *
 * @param device - Target {@link DeviceSpec} the event must come from (e.g. `DEVICES.g502X`).
 * @param blocks - One or more {@link BindingBlock} entries to scope.
 * @returns An array of new {@link Binding} objects that only fire for events from `device`.
 *
 * @example
 * ```ts
 * ...onDevice(DEVICES.g502X, mouseBindings)
 * ```
 */
export function onDevice(device: DeviceSpec, ...blocks: BindingBlock[]): Binding[] {
  return scoped(condDevice(device), ...blocks);
}

/**
 * Supplies default binding options across an entire block of bindings.
 *
 * Use when applying shared metadata, processing flags, or event hooks across a collection of bindings without overriding individual specific settings.
 *
 * @param opts - Options wrapper (from {@link options}) or a {@link BindingOptionsSpec} object.
 * @param blocks - One or more {@link BindingBlock} entries to configure.
 * @returns An array of new {@link Binding} objects carrying the merged default options.
 *
 * @example
 * ```ts
 * ...withOptions({ suppressCancelFallback: true, halt: true }, holdLayerBindings)
 * ```
 */
export function withOptions(
  opts: BindingOptionsSpec | OptionsWrapper,
  ...blocks: BindingBlock[]
): Binding[] {
  const spec: BindingOptionsSpec =
    "kind" in opts && (opts as OptionsWrapper).kind === "options"
      ? (opts as OptionsWrapper).opts
      : (opts as BindingOptionsSpec);

  return flatten(blocks).map((b) => {
    const merged: Binding = { ...spec, ...b };
    if (spec.timing || b.timing) {
      merged.timing = { ...spec.timing, ...b.timing };
    }
    if (spec.conditions?.length) {
      merged.conditions = [...spec.conditions, ...(b.conditions ?? [])];
    }
    return merged;
  });
}

/**
 * Applies a shared timing preset profile or explicit timing thresholds to an entire block of bindings.
 *
 * Use when establishing a consistent timing feel (`"snappy"`, `"instant"`, `"balanced"`, `"relaxed"`, `"deliberate"`) across a family of tap/hold keys.
 *
 * @param profileOrTiming - Named {@link TimingProfileName} (`"snappy"`, `"deliberate"`, etc.) or explicit timing threshold object.
 * @param blocks - One or more {@link BindingBlock} entries to configure.
 * @returns An array of new {@link Binding} objects carrying the configured timing parameters.
 *
 * @example
 * ```ts
 * ...withTiming("snappy", bindTable("hold", { a: APPS.antinote, b: APPS.brave }))
 * ```
 */
export function withTiming(
  profileOrTiming: TimingProfileName | NonNullable<Binding["timing"]>,
  ...blocks: BindingBlock[]
): Binding[] {
  const t = isTimingProfileName(profileOrTiming)
    ? TIMING_PROFILES[profileOrTiming]
    : profileOrTiming;
  return withOptions({ timing: { ...t } }, ...blocks);
}

/**
 * Merges a block of bindings into a single shared rule entry in the Karabiner Settings GUI.
 *
 * Use when grouping multiple distinct triggers that belong to the same logical feature into one clean, labeled row in Karabiner's UI.
 *
 * @param groupOrDescription - A {@link BindingRuleGroup} object or human-readable description string (from which the group ID is automatically derived).
 * @param blocks - One or more {@link BindingBlock} entries to group.
 * @returns An array of new {@link Binding} objects sharing the specified `ruleGroup`.
 *
 * @example
 * ```ts
 * ...group("Window management", bindTable("release", { e: COMBOS.focusWinRight, q: COMBOS.focusWinLeft }, VM.COCS))
 * ```
 */
export function group(
  groupOrDescription: BindingRuleGroup | string,
  ...blocks: BindingBlock[]
): Binding[] {
  const ruleGroup: BindingRuleGroup =
    typeof groupOrDescription === "string"
      ? {
          id: groupOrDescription.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
          description: groupOrDescription,
        }
      : groupOrDescription;
  return flatten(blocks).map((b) => ({ ...b, ruleGroup }));
}
