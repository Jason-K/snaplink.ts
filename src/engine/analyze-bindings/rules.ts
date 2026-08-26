/**
 * Gesture lint — the failure modes that live *inside* one binding.
 *
 * `analyze-conflicts` answers "can this rule ever be reached", which is a
 * question about the ordered list of bindings. It says nothing about whether a
 * binding that *is* reached does what its author meant, and that is where the
 * expensive debugging sessions actually happen: a threshold that leaves a
 * window in which the key emits nothing, an option the emitter reads from a
 * different field than the one that was set, an action that a later stage
 * silently drops.
 *
 * Every rule below is derived from a specific line of the emitter rather than
 * from taste, and each one names the file it comes from. A rule that cannot
 * point at such a line does not belong here — the point is to report facts
 * about the compiled output, not to have opinions about binding style.
 *
 * All findings are advisory. `assertNoConflictsInOrder()` fails the build on
 * unreachable rules because an unreachable rule is unambiguously wrong; a lint
 * finding can be a deliberate choice, so it prints and the build continues.
 */

import {
  KB_TIMINGS,
  MOUSE_TIMINGS,
  type Action,
  type Binding,
  type Case,
  type Condition,
  type Phase,
  type VarSpec,
} from "../../data";
import { getTriggerKeys, isModifierKey, isPointerButton, resolveKeyAlias } from "../utils";

/** Identifier for one lint rule, stable enough to suppress or grep for. */
export type LintRuleId =
  | "tap-hold-dead-zone"
  | "hold-layer-leak"
  | "multi-tap-ignores-hold-ms"
  | "chord-ignores-hold-ms"
  | "multi-tap-passthrough-drops-tap"
  | "hold-reemits-trigger-modifier"
  | "timing-without-gesture"
  | "simultaneous-ms-without-chord"
  | "gate-var-never-set"
  | "layer-var-never-read";

/**
 * How much a finding matters.
 *
 * - `warning` — the compiled output almost certainly does not match intent.
 * - `info` — a setting with no effect. Harmless, but it means the knob that was
 *   reached for is not the one that is being read.
 */
export type LintSeverity = "warning" | "info";

/** One finding against one binding. */
export type LintDiagnostic = {
  rule: LintRuleId;
  severity: LintSeverity;
  /** Binding set the binding came from, e.g. `"tap-hold"`. */
  set: string;
  /** Position within that set. */
  index: number;
  binding: Binding;
  /** What the compiled output will do. */
  message: string;
  /** The concrete edit that resolves it. */
  fix: string;
};

/** A binding plus its provenance. Structurally identical to `BindingEntry`. */
export type LintTarget = { set: string; index: number; binding: Binding };

/** Facts about the whole configuration that a per-binding rule may need. */
export type LintContext = {
  /** Names of every variable some binding writes (`whileHoldVar`, `setVar`, `afterKeyUp`). */
  writtenVars: ReadonlySet<string>;
  /** Names of every variable some binding reads in a condition. */
  readVars: ReadonlySet<string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shape helpers — how the emitter classifies a binding
// ─────────────────────────────────────────────────────────────────────────────

const casesIn = (b: Binding, phase: Phase): Case[] =>
  b.cases.filter((c) => (c.phase ?? "press") === phase);

/** Cases in `phase` that actually emit something. An empty `do` is a suppression. */
const emittingCasesIn = (b: Binding, phase: Phase): Case[] =>
  casesIn(b, phase).filter((c) => (c.do ?? []).length > 0);

/** Whether `buildManipulators` routes this binding through the multi-tap builder. */
function isMultiTap(b: Binding): boolean {
  return b.multiTap !== undefined || b.cases.some((c) => (c.tapCount ?? 1) >= 2);
}

function isChord(b: Binding): boolean {
  return getTriggerKeys(b.trigger).length > 1;
}

function isPointerTrigger(b: Binding): boolean {
  const keys = getTriggerKeys(b.trigger);
  return keys.length === 1 && isPointerButton(keys[0]!);
}

/** Whether the binding declares a tap/hold gesture at all, as `compile-binding.ts` tests it. */
function hasGesture(b: Binding): boolean {
  return b.cases.some((c) => {
    const phase = c.phase ?? "press";
    return phase === "release" || phase === "hold";
  });
}

function describe(t: LintTarget): string {
  const keys = getTriggerKeys(t.binding.trigger);
  const trigger = keys.length ? keys.join("+") : "any";
  const label = t.binding.description?.split("\n")[0];
  return `${t.set}[${t.index}] ${trigger}${label ? ` — ${label}` : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Effective timings — what the emitter will actually put in `parameters`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two thresholds a single-key or pointer tap-hold binding compiles to.
 *
 * Mirrors `buildKeyTapHold` / `buildPointerTapHold`
 * (`emit-manipulators/binding/builders.ts`) and the defaults `tapHoldFrom()`
 * applies (`resolve-trigger/tap-hold.ts`). Kept in step with them by
 * `src/tests/gesture-lint.test.ts`, which compiles a binding and reads the
 * emitted parameters back.
 */
export function effectiveTapHoldTimings(b: Binding): { aloneMs: number; holdMs: number } {
  const pointer = isPointerTrigger(b);
  const defaults = pointer ? MOUSE_TIMINGS : KB_TIMINGS;
  return {
    aloneMs: b.timing?.aloneMs ?? defaults.aloneMs,
    holdMs: b.timing?.holdMs ?? b.timing?.heldThresholdMs ?? defaults.holdMs,
  };
}

/**
 * The single threshold a multi-tap binding compiles to.
 *
 * `buildMultiTap` reads `aloneMs ?? heldThresholdMs` and hands it to
 * `varTapTapHoldFrom`, which uses it for all three parameters. `holdMs` is not
 * in that expression — hence {@link multiTapIgnoresHoldMs}.
 */
export function effectiveMultiTapThreshold(b: Binding): number {
  return b.timing?.aloneMs ?? b.timing?.heldThresholdMs ?? KB_TIMINGS.timeoutDoubleTapMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action inspection
// ─────────────────────────────────────────────────────────────────────────────

function actionKeyCode(a: Action): string | undefined {
  if (typeof a !== "object" || a === null) return undefined;
  const spec = a as { type?: string; key?: string; key_code?: string };
  if (spec.type === "key" && typeof spec.key === "string") return resolveKeyAlias(spec.key);
  if (typeof spec.key_code === "string") return resolveKeyAlias(spec.key_code);
  return undefined;
}

/** Variables an action writes, following `sequence()` into its members. */
function varsWrittenBy(a: Action): string[] {
  if (typeof a !== "object" || a === null) return [];
  const spec = a as { type?: string; var?: VarSpec; name?: string; actions?: Action[] };
  if (spec.type === "setVar" && spec.var?.name) return [spec.var.name];
  if (spec.type === "sequence" && Array.isArray(spec.actions)) {
    return spec.actions.flatMap(varsWrittenBy);
  }
  // A raw `ToEvent` set_variable, which `afterKeyUp` accepts.
  const raw = a as { set_variable?: { name?: string } };
  if (raw.set_variable?.name) return [raw.set_variable.name];
  return [];
}

function varsReadBy(c: Condition): string[] {
  return "var" in c && c.var?.name ? [c.var.name] : [];
}

/** Every variable name this binding writes. */
export function bindingWritesVars(b: Binding): string[] {
  return [
    ...(b.whileHoldVar ? [b.whileHoldVar.name] : []),
    ...(b.multiTap?.firstTapPendingVar ? [b.multiTap.firstTapPendingVar.name] : []),
    ...b.cases.flatMap((c) => (c.do ?? []).flatMap(varsWrittenBy)),
    ...(b.afterKeyUp ?? []).flatMap(varsWrittenBy),
  ];
}

/** Every variable name this binding reads in a condition, hoisted or per-case. */
export function bindingReadsVars(b: Binding): string[] {
  return [
    ...(b.conditions ?? []).flatMap(varsReadBy),
    ...b.cases.flatMap((c) => (c.conditions ?? []).flatMap(varsReadBy)),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// The rules
// ─────────────────────────────────────────────────────────────────────────────

type RuleFn = (t: LintTarget, ctx: LintContext) => LintDiagnostic[];

const diag = (
  t: LintTarget,
  rule: LintRuleId,
  severity: LintSeverity,
  message: string,
  fix: string,
): LintDiagnostic => ({ rule, severity, set: t.set, index: t.index, binding: t.binding, message, fix });

/**
 * A window in which the key emits nothing at all.
 *
 * `to_if_alone` is cancelled by holding past
 * `basic.to_if_alone_timeout_milliseconds` (gotcha 7.2); `to_if_held_down`
 * has not fired until `basic.to_if_held_down_threshold_milliseconds`. Set the
 * hold threshold above the alone timeout and every release between the two
 * runs neither channel — the key is dead for that interval, silently, with
 * perfectly valid JSON.
 *
 * The usual way in is setting one threshold and inheriting the other:
 * `timing({ aloneMs: 150 })` keeps the default 400 ms hold threshold and buys
 * a 250 ms dead window. Upstream's own tap-hold examples set the two equal,
 * which is what every {@link TIMING_PROFILES} entry does.
 */
const tapHoldDeadZone: RuleFn = (t) => {
  const b = t.binding;
  if (isMultiTap(b) || isChord(b)) return []; // both paths derive one threshold for both channels
  if (emittingCasesIn(b, "release").length === 0 || emittingCasesIn(b, "hold").length === 0) return [];

  const { aloneMs, holdMs } = effectiveTapHoldTimings(b);
  if (holdMs <= aloneMs) return [];

  const inherited =
    b.timing?.holdMs === undefined && b.timing?.heldThresholdMs === undefined
      ? " (the hold threshold is the inherited default — only the alone timeout was set)"
      : b.timing?.aloneMs === undefined
        ? " (the alone timeout is the inherited default — only the hold threshold was set)"
        : "";

  return [
    diag(
      t,
      "tap-hold-dead-zone",
      "warning",
      `${describe(t)} has a ${holdMs - aloneMs} ms dead zone: releasing between ` +
        `${aloneMs} ms and ${holdMs} ms emits nothing, because the tap has timed out and ` +
        `the hold has not fired yet${inherited}.`,
      `Set both thresholds together — timing("snappy") and the other TIMING_PROFILES ` +
        `entries do, or spell it out as timing({ aloneMs: ${holdMs}, holdMs: ${holdMs} }).`,
    ),
  ];
};

/**
 * A hold layer that leaks its tap action when the layer is used.
 *
 * `tapHoldFrom()` wires `to_delayed_action.to_if_canceled` to the *alone*
 * events, so that Karabiner can commit to "this was a tap" as soon as another
 * key arrives instead of waiting out the timeout. On a plain tap-hold key that
 * is what makes typing responsive. On a layer trigger it is backwards: pressing
 * a chord key is exactly the cancellation, so using the layer replays the
 * trigger's tap action on top of the chord — the modifier leak in
 * `MISSING_FEATURES.md` item 5A.
 *
 * `suppressCancelFallback: true` clears that channel, which is why
 * `holdLayer()` always sets it.
 */
const holdLayerLeak: RuleFn = (t) => {
  const b = t.binding;
  if (!b.whileHoldVar || b.suppressCancelFallback) return [];
  if (emittingCasesIn(b, "release").length === 0) return [];

  return [
    diag(
      t,
      "hold-layer-leak",
      "warning",
      `${describe(t)} tracks a hold variable but leaves the cancel fallback wired, so ` +
        "pressing a chord key while it is held replays its tap action on top of the chord.",
      "Add suppressCancelFallback: true, or build the layer with holdLayer(), which sets it.",
    ),
  ];
};

/**
 * `holdMs` set on a binding whose builder never reads it.
 *
 * `buildMultiTap` derives its one threshold from `aloneMs ?? heldThresholdMs`
 * and applies it to all three parameters; `holdMs` is not in that expression.
 * Setting it looks like tuning the hold and does nothing.
 */
const multiTapIgnoresHoldMs: RuleFn = (t) => {
  const b = t.binding;
  if (!isMultiTap(b)) return [];
  if (b.timing?.holdMs === undefined) return [];
  if (b.timing.aloneMs !== undefined || b.timing.heldThresholdMs !== undefined) return [];

  return [
    diag(
      t,
      "multi-tap-ignores-hold-ms",
      "warning",
      `${describe(t)} is a multi-tap binding, which derives its threshold from ` +
        `aloneMs ?? heldThresholdMs. holdMs: ${b.timing.holdMs} is dropped; the binding ` +
        `compiles with the ${effectiveMultiTapThreshold(b)} ms default.`,
      `Write timing({ aloneMs: ${b.timing.holdMs} }) instead — one threshold drives tap, ` +
        "hold and the multi-tap window together on this path.",
    ),
  ];
};

/** The chord equivalent: `buildSimultaneousTapHold` reads `aloneMs` only. */
const chordIgnoresHoldMs: RuleFn = (t) => {
  const b = t.binding;
  if (!isChord(b) || isMultiTap(b)) return [];
  if (b.timing?.holdMs === undefined || b.timing.aloneMs !== undefined) return [];

  return [
    diag(
      t,
      "chord-ignores-hold-ms",
      "warning",
      `${describe(t)} is a chord, and buildSimultaneousTapHold reads only aloneMs. ` +
        `holdMs: ${b.timing.holdMs} is dropped.`,
      `Write timing({ aloneMs: ${b.timing.holdMs} }) — on a chord that single value sets ` +
        "both the alone timeout and the hold threshold.",
    ),
  ];
};

/**
 * A single-tap action that pass-through mode discards.
 *
 * With `multiTap.allowPassThrough`, `varTapTapHoldFrom()` builds its first-tap
 * manipulator from a fixed template whose `to_if_alone` re-emits the trigger
 * key; the caller's `immediateSingleTapEvents` are not read on that branch. So
 * a single-tap `release()` case survives only when it happens to be a re-emit
 * of the trigger key anyway — which the existing multi-tap modifier bindings
 * are, and anything else is not.
 */
const multiTapPassThroughDropsTap: RuleFn = (t) => {
  const b = t.binding;
  if (!b.multiTap?.allowPassThrough) return [];

  const triggerKeys: string[] = getTriggerKeys(b.trigger).map(resolveKeyAlias);
  const dropped = b.cases.filter((c) => {
    if ((c.phase ?? "press") !== "release" || (c.tapCount ?? 1) !== 1) return false;
    // A delayed single tap routes through `to_delayed_action.to_if_invoked`,
    // which the pass-through template does keep. Only the immediate channel is
    // overwritten.
    if (c.delayed) return false;
    const actions = c.do ?? [];
    if (actions.length === 0) return false;
    // A lone re-emit of the trigger key is what pass-through already does.
    return !(actions.length === 1 && triggerKeys.includes(actionKeyCode(actions[0]!) ?? ""));
  });
  if (dropped.length === 0) return [];

  return [
    diag(
      t,
      "multi-tap-passthrough-drops-tap",
      "warning",
      `${describe(t)} sets multiTap.allowPassThrough, whose first-tap manipulator re-emits ` +
        `the trigger key on to_if_alone. Its ${dropped.length} single-tap release case(s) ` +
        "never reach the output.",
      "Drop allowPassThrough to keep the single-tap action, or move that action to a " +
        "delayedSingleTap() case, which pass-through does route through to_delayed_action.",
    ),
  ];
};

/**
 * A hold action that re-emits the modifier it is triggered by.
 *
 * `tapHoldFrom()` filters hold events whose key code equals a modifier-key
 * trigger's own key, because emitting the key Karabiner has already consumed
 * produces a stuck modifier. The filter is right; it is just silent.
 */
const holdReemitsTriggerModifier: RuleFn = (t) => {
  const b = t.binding;
  if (isMultiTap(b) || isChord(b) || isPointerTrigger(b)) return [];
  const triggerKey: string | undefined = getTriggerKeys(b.trigger).map(resolveKeyAlias)[0];
  if (!triggerKey || !isModifierKey(triggerKey)) return [];

  const offenders = emittingCasesIn(b, "hold").filter((c) =>
    (c.do ?? []).some((a) => actionKeyCode(a) === triggerKey),
  );
  if (offenders.length === 0) return [];

  return [
    diag(
      t,
      "hold-reemits-trigger-modifier",
      "info",
      `${describe(t)} holds "${triggerKey}" and its hold case emits "${triggerKey}" again. ` +
        "tapHoldFrom() drops that event, so the hold case compiles shorter than it reads.",
      `Remove the ${triggerKey} action from the hold case, or use modWhileDown: true to ` +
        "assert the modifier from key-down without a hold threshold.",
    ),
  ];
};

/** Tap/hold thresholds on a binding that has no tap or hold channel to apply them to. */
const timingWithoutGesture: RuleFn = (t) => {
  const b = t.binding;
  if (hasGesture(b) || isMultiTap(b) || b.cases.some((c) => c.guard)) return [];
  const set = (["aloneMs", "holdMs", "heldThresholdMs", "delayedMs"] as const).filter(
    (k) => b.timing?.[k] !== undefined,
  );
  if (set.length === 0) return [];

  return [
    diag(
      t,
      "timing-without-gesture",
      "info",
      `${describe(t)} sets ${set.join(", ")} but declares only press cases, which compile ` +
        "to a plain remap with no to_if_alone, to_if_held_down or to_delayed_action.",
      "Add a release() or hold() case if a gesture was intended, or drop the timing.",
    ),
  ];
};

/** `simultaneousMs` on something that is not a chord. */
const simultaneousMsWithoutChord: RuleFn = (t) => {
  const b = t.binding;
  if (b.timing?.simultaneousMs === undefined || isChord(b)) return [];

  return [
    diag(
      t,
      "simultaneous-ms-without-chord",
      "info",
      `${describe(t)} sets simultaneousMs on a single-input trigger. ` +
        "basic.simultaneous_threshold_milliseconds only applies to a from.simultaneous event.",
      "Drop simultaneousMs, or make the trigger a chord with simultaneous(...) / from([a, b]).",
    ),
  ];
};

/**
 * `true` for a variable Karabiner maintains itself rather than one a rule sets.
 *
 * Built-in variables are namespaced with a dot — `accessibility.*`,
 * `frontmost_application.*`, `input_source.*`, `system.*`,
 * `virtual_hid_devices_state.*` — and user variables in this configuration
 * never are (`right_button_pressed`, `caps_lock_pressed`, `multi_tap_left_command`).
 * That is the whole distinction {@link gateVarNeverSet} needs: a built-in is
 * always "written", by Karabiner, and reading one is not evidence of a missing
 * writer. See the factories in `src/data/registries/vars.ts`.
 */
function isKarabinerManagedVar(name: string): boolean {
  return name.includes(".");
}

/**
 * A binding gated on a variable nothing in the configuration ever writes.
 *
 * `variable_if` on an unset variable is false forever, so the binding is dead —
 * the same outcome `analyze-conflicts` reports for a shadowed rule, arrived at
 * from the other direction and invisible to it, because nothing about the
 * binding's *position* is wrong.
 *
 * Karabiner treats an unset variable as `0`, so this only fires for a
 * non-zero expected value, and never for a built-in Karabiner variable.
 *
 * `output-invariants.test.ts` asserts the same property over the *compiled*
 * output, which is the backstop; this reaches the same conclusion from the
 * bindings, early enough to name the binding and the fix rather than a variable
 * name and a rule label.
 */
const gateVarNeverSet: RuleFn = (t, ctx) => {
  const gates = [
    ...(t.binding.conditions ?? []),
    ...t.binding.cases.flatMap((c) => c.conditions ?? []),
  ].filter(
    (c): c is Extract<Condition, { var: VarSpec }> =>
      "var" in c && !c.unless && c.equals !== 0 && c.equals !== false,
  );

  const orphans = [...new Set(gates.map((c) => c.var.name))].filter(
    (name) => !isKarabinerManagedVar(name) && !ctx.writtenVars.has(name),
  );
  if (orphans.length === 0) return [];

  return [
    diag(
      t,
      "gate-var-never-set",
      "warning",
      `${describe(t)} is gated on ${orphans.map((n) => `"${n}"`).join(", ")}, which no ` +
        "binding in the configuration ever sets. An unset Karabiner variable reads as 0, " +
        "so this binding can never fire.",
      "Set the variable from the layer trigger (whileHoldVar, or a setVar() action), or " +
        "correct the name — variable conditions match on the string, not on the VarSpec.",
    ),
  ];
};

/** The mirror: a hold layer whose variable gates nothing. */
const layerVarNeverRead: RuleFn = (t, ctx) => {
  const v = t.binding.whileHoldVar;
  if (!v || ctx.readVars.has(v.name)) return [];

  return [
    diag(
      t,
      "layer-var-never-read",
      "info",
      `${describe(t)} maintains "${v.name}" while held, but no binding reads it. ` +
        "The layer is declared and empty.",
      `Gate the layer's chord bindings on it — whileVar(${v.name}, [...]) — or drop ` +
        "whileHoldVar if the variable is only observed outside Karabiner.",
    ),
  ];
};

/** Every rule, in report order. */
export const LINT_RULES: readonly RuleFn[] = [
  tapHoldDeadZone,
  holdLayerLeak,
  multiTapIgnoresHoldMs,
  chordIgnoresHoldMs,
  multiTapPassThroughDropsTap,
  holdReemitsTriggerModifier,
  gateVarNeverSet,
  layerVarNeverRead,
  timingWithoutGesture,
  simultaneousMsWithoutChord,
];
