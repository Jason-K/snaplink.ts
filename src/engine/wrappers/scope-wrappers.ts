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

/**
 * A block of bindings, however it is spelled at the call site.
 *
 * Both `forApp(A, [b1, b2])` and `forApp(A, b1, ...bindTable(...))` are valid;
 * arrays are flattened one level, which is all `bindTable()` / `holdLayer()`
 * spreads ever produce.
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
 * Apply an arbitrary condition set to every binding in a block.
 *
 * The general form the named combinators below are built on. Accepts anything
 * {@link when} accepts — built `Condition`s, bare registry specs, `[target,
 * value]` tuples — so a scope can be expressed however the surrounding code
 * expresses conditions.
 *
 * @param conditions - A `when(...)` wrapper, a `Condition`, or any bare state spec.
 * @param blocks - The bindings to scope.
 * @returns New bindings carrying the scope conditions ahead of their own.
 *
 * @example
 * ```ts
 * ...scoped(when(APPS.word, VARS.rCmdDown), [ bind(...), bind(...) ])
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
 * Scope a block to one or more frontmost applications.
 *
 * @param app - {@link AppSpec}, {@link PathSpec}, bundle ID string, or array of any of those.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while one of `app` is frontmost.
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
 * Scope a block to *everywhere except* one or more applications.
 *
 * The complement of {@link forApp}, and worth using in pairs: a `forApp(X, …)`
 * block and an `exceptInApp(X, …)` block over the same trigger are provably
 * complementary, which is the relation `resolve-cases.ts` needs to drop an
 * unreachable fallback and `analyze-conflicts.ts` needs to *not* report the two
 * as conflicting.
 *
 * @param app - {@link AppSpec}, {@link PathSpec}, bundle ID string, or array of any of those.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while none of `app` is frontmost.
 *
 * @example
 * ```ts
 * ...exceptInApp(APPS.excel, [ bind(from("return_or_enter"), to(hold(URLS.hsFormatSubstring))) ])
 * ```
 */
export function exceptInApp(
  app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[],
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(condNotApp(app), ...blocks);
}

/**
 * Gate a block on a Karabiner variable holding a value — the layer idiom.
 *
 * `holdLayer()` does this internally for the chord table it is given; this is
 * the same gate for bindings that live outside a layer builder but still belong
 * to the layer.
 *
 * @param variable - The variable to test.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while `variable` is `1`.
 *
 * @example
 * ```ts
 * ...whileVar(VARS.rCmdDown, [ bind(from("a"), to(press(APPS.antinote))) ])
 * ```
 */
export function whileVar(variable: VarSpec, ...blocks: BindingBlock[]): Binding[] {
  return scoped(ifUserVar(variable, 1), ...blocks);
}

/**
 * {@link whileVar} for a variable that carries a value other than `1` — a mode
 * index, a named state.
 *
 * @param variable - The variable to test.
 * @param value - Value required for a match.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while `variable` equals `value`.
 *
 * @example
 * ```ts
 * ...whileVarIs(VARS.mode, "window", [ bind(from("h"), to(press(URLS.hsWinLeftTop))) ])
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
 * Gate a block on a Karabiner variable *not* holding a value.
 *
 * The suppression half of layering: every rule family outside a layer that
 * stays active after its trigger is released needs `variable_unless` on the
 * layer's variables, or it fires while the layer is up. See
 * {@link modalLayer}, which returns the guard conditions to hand here.
 *
 * @param variable - The variable to test.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while `variable` is not `1`.
 *
 * @example
 * ```ts
 * ...unlessVar(capsVars.pressed, tapHoldBindings)
 * ```
 */
export function unlessVar(variable: VarSpec, ...blocks: BindingBlock[]): Binding[] {
  return scoped(unlessUserVar(variable, 1), ...blocks);
}

/**
 * {@link unlessVar} for a variable that carries a value other than `1`.
 *
 * @param variable - The variable to test.
 * @param value - Value that blocks a match.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire while `variable` does not equal `value`.
 */
export function unlessVarIs(
  variable: VarSpec,
  value: string | number | boolean,
  ...blocks: BindingBlock[]
): Binding[] {
  return scoped(unlessUserVar(variable, value), ...blocks);
}

/**
 * Scope a block to events originating from one physical device.
 *
 * @param device - The {@link DeviceSpec} the event must come from.
 * @param blocks - The bindings to scope.
 * @returns New bindings that only fire for events from `device`.
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
 * Supply option defaults to a whole block.
 *
 * A field the binding already set wins — the binding is the more specific
 * statement — with one refinement: `timing` and `conditions` merge rather than
 * replace, since both are sets of independent facts rather than single values.
 *
 * @param opts - Options wrapper (`options({...})`) or a plain options object.
 * @param blocks - The bindings to scope.
 * @returns New bindings carrying the defaults for every field they did not set.
 *
 * @example
 * ```ts
 * ...withOptions({ suppressCancelFallback: true }, holdLayerBindings)
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
 * Give a whole block one timing profile.
 *
 * Shorthand for `withOptions({ timing: … }, …)` that also accepts a
 * {@link TimingProfileName}, so a family of keys can be given one *feel* in a
 * single place instead of repeating four thresholds per binding — the case
 * `bindTable()` covers for actions but had no equivalent for timing.
 *
 * Per-binding timing still wins field-by-field, so one key in the block can
 * differ on one threshold without restating the rest.
 *
 * @param profileOrTiming - A profile name (`"snappy"`, `"deliberate"`, …) or an explicit timing object.
 * @param blocks - The bindings to scope.
 * @returns New bindings carrying the timing for every field they did not set.
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
 * Merge a block into one named rule in the Karabiner Settings GUI.
 *
 * Bindings that resolve to the same trigger are merged automatically; this is
 * for the case where several *distinct* triggers are one feature and deserve
 * one row rather than a screenful of near-identical ones.
 *
 * @param groupOrDescription - A {@link BindingRuleGroup}, or a description string from which the id is derived.
 * @param blocks - The bindings to group.
 * @returns New bindings sharing one `ruleGroup`.
 *
 * @example
 * ```ts
 * ...group("Window management", bindTable("release", { … }, VM.COCS))
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
