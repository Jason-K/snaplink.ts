import type {
  FromEvent,
  Manipulator,
  Modifier,
  PointingButton,
  ToEvent,
} from "../../../types/karabiner";
import { map, toKey, toPointingButton, toSetVar } from "../../karabiner-helpers";
import {
  MOUSE_TIMINGS,
  TIMINGS,
  type ActionKeyModifier,
  type Binding,
  type Condition,
  type Phase,
  type Trigger,
} from "../../../data";
import {
  groupMultiTapCases,
  unionRawConditions,
  type CaseGroup,
  type ResolvedCase,
} from "../../resolve-cases";
import {
  fromModifiersObj,
  resolveSimKarOptions,
  simultaneousMultiTap,
  simultaneousRemap,
  simultaneousTapHold,
  tapHold,
  tapHoldFrom,
  triggerToFrom,
  varTapTapHoldFrom,
} from "../../resolve-trigger";
import { resolveActionToEvents } from "../../resolve-to-action";
import { synthesizeManipulatorLabel } from "../../resolve-description/description-synthesizer";
import {
  getTriggerKeys,
  isModifierKey,
  isPointerButton,
  normalizeModifier,
  resolveButton,
  resolveKeyAlias,
  resolveModifiers,
} from "../../utils";
import { attachConditions, deviceLast, stampLabel } from "./stamping";

/**
 * Derive default ToEvents matching the trigger event when guard() actions are omitted.
 */
export function deriveTriggerToEvents(trigger: Trigger): ToEvent[] {
  const mods = resolveModifiers(trigger.modifiers).mandatory;
  const modsArr: Modifier[] | undefined = mods.length > 0 ? (mods as Modifier[]) : undefined;

  if ("pointer" in trigger && trigger.pointer) {
    return [toPointingButton(trigger.pointer as PointingButton, modsArr)];
  }

  const rawKeys = getTriggerKeys(trigger);
  if (rawKeys.length > 0) {
    return rawKeys.map((k) => toKey(resolveKeyAlias(k), modsArr, { repeat: false }));
  }

  return [];
}

/**
 * Derive the double-tap guard variable name from the trigger.
 */
export function deriveGuardVar(trigger: Trigger): string {
  const rawKey = getTriggerKeys(trigger)[0] ?? "none";
  const key = resolveKeyAlias(rawKey);
  const mods = resolveModifiers(trigger.modifiers).mandatory;
  const firstMod = mods[0];
  const normalized = firstMod ? normalizeModifier(firstMod) : "none";
  return `guard_${normalized}_${key}`;
}

/**
 * Double-tap guard arm: require two presses of the trigger combo within a
 * timeout before firing the real combo.
 */
export function buildGuard(b: Binding, resolved: ResolvedCase[]): Manipulator[] {
  const rawKey = getTriggerKeys(b.trigger)[0]!;
  const key = resolveKeyAlias(rawKey);
  const guardCases = resolved.filter((c) => c.guard);
  if (guardCases.length !== 1 || resolved.length !== 1) {
    throw new Error(
      `A double-tap guard binding must have exactly one guard() case, but trigger "${JSON.stringify(b.trigger)}" has ${guardCases.length} guard case(s) among ${resolved.length} total case(s).`,
    );
  }
  const guardCase = guardCases[0]!;
  const varName = b.guardVar ?? deriveGuardVar(b.trigger);
  const timeoutMs = b.guardMs ?? TIMINGS.timeoutDoubleTapMs;
  const combo = guardCase.do.length > 0 ? guardCase.do : deriveTriggerToEvents(b.trigger);
  if (combo.length === 0) {
    throw new Error(
      `A double-tap guard binding without explicit actions must specify a valid key or pointer trigger.`,
    );
  }
  const modifiersObj = fromModifiersObj(b.trigger);
  const conds = deviceLast(resolved.flatMap((c) => c.conditions));

  const secondPress = map(key as any);
  secondPress.condition({ type: "variable_if", name: varName, value: 1 } as any);
  for (const e of combo) secondPress.to(e);
  secondPress.to(toSetVar(varName, 0));
  for (const c of conds) secondPress.condition(c as any);
  (secondPress as any).from.modifiers = modifiersObj;

  const firstPress = map(key as any);
  firstPress.condition({ type: "variable_if", name: varName, value: 0 } as any);
  firstPress.parameters({ "basic.to_delayed_action_delay_milliseconds": timeoutMs });
  firstPress.to(toSetVar(varName, 1));
  firstPress.toDelayedAction([toSetVar(varName, 0)], [toSetVar(varName, 0)]);
  for (const c of conds) firstPress.condition(c as any);
  (firstPress as any).from.modifiers = modifiersObj;

  const built = [...secondPress.build(), ...firstPress.build()];
  stampLabel(built, guardCase?.rawConditions);
  return built as Manipulator[];
}

export function buildMultiTap(
  b: Binding,
  cases: ResolvedCase[],
  isSim: boolean,
): Manipulator[] {
  const keys = getTriggerKeys(b.trigger);
  const rawKey = isSim ? "" : keys[0]!;
  const key = rawKey ? resolveKeyAlias(rawKey) : "";
  const byPhase = (p: Phase, tapCount = 1) =>
    cases
      .filter((c) => c.tapCount === tapCount && c.phase === p)
      .flatMap((c) => c.do);
  const threshold = b.timing?.aloneMs ?? b.timing?.heldThresholdMs;
  if (isSim) {
    const label = keys.join("");
    const manipulators = simultaneousMultiTap({
      keys,
      label,
      alone: byPhase("release"),
      hold: byPhase("hold"),
      tapTap: cases
        .filter((c) => c.tapCount === 2 && c.phase === "release")
        .flatMap((c) => c.do),
      tapTapHold: cases
        .filter((c) => c.tapCount === 2 && c.phase === "hold")
        .flatMap((c) => c.do),
      thresholdMs: threshold,
      karOptions: resolveSimKarOptions(b),
      simultaneousThresholdMs: b.timing?.simultaneousMs,
    });
    const pressDo = cases
      .filter((c) => c.tapCount === 1 && c.phase === "press")
      .flatMap((c) => c.do);
    if (pressDo.length) {
      manipulators.forEach((m: any) => {
        m.to = m.to || [];
        m.to.push(...pressDo);
      });
    }
    attachConditions(manipulators, cases);
    stampLabel(manipulators, unionRawConditions(cases));
    return manipulators;
  }
  const isPointer = isPointerButton(key);
  const triggerKey = isPointer ? resolveButton(key).button : key;
  const firstTapPendingVar =
    b.multiTap?.firstTapPendingVar?.name ?? `multi_tap_${triggerKey}`;
  const manipulators: Manipulator[] = [];
  for (const g of groupMultiTapCases(cases)) {
    const delayedEvents = g.cases
      .filter((c) => c.tapCount === 1 && c.phase === "release" && c.delayed)
      .flatMap((c) => c.do);
    const shared = {
      firstTapPendingVar,
      immediateSingleTapEvents: g.cases
        .filter((c) => c.tapCount === 1 && c.phase === "release" && !c.delayed)
        .flatMap((c) => c.do),
      delayedSingleTapEvents: delayedEvents.length ? delayedEvents : undefined,
      holdEvents: g.cases
        .filter((c) => c.tapCount === 1 && c.phase === "hold")
        .flatMap((c) => c.do),
      doubleTapEvents: g.cases
        .filter((c) => c.tapCount === 2 && c.phase === "release")
        .flatMap((c) => c.do),
      doubleTapHoldEvents: g.cases
        .filter((c) => c.tapCount === 2 && c.phase === "hold")
        .flatMap((c) => c.do),
      thresholdMs: threshold,
      allowPassThrough: b.multiTap?.allowPassThrough,
    };
    const groupManips = isPointer
      ? varTapTapHoldFrom({
        from: { pointing_button: triggerKey as PointingButton } as FromEvent,
        passThrough: b.multiTap?.allowPassThrough
          ? toPointingButton(triggerKey as PointingButton, undefined, {
            lazy: true,
          })
          : undefined,
        ...shared,
      })
      : varTapTapHoldFrom({
        // The trigger's own modifiers, not just its key: building `from` from
        // the key code alone dropped them, so a multi-tap bound to `⌘⌥⌃⇧+A`
        // compiled down to one on bare `A` that claimed every press of the key.
        // `multiTap.mods` stays an explicit override for the call sites that
        // want to say "no modifiers at all".
        from: triggerToFrom(b.trigger),
        // `key` is "" for a simultaneous trigger, which has no single key to
        // pass through; emitting `key_code: ""` would fail schema validation.
        passThrough: b.multiTap?.allowPassThrough && key
          ? toKey(key, [], { lazy: true })
          : undefined,
        ...(b.multiTap?.mods ? { mods: b.multiTap.mods as Modifier[] } : {}),
        ...shared,
      });
    // A press case fires on key-down whichever tap the manipulator represents,
    // so it belongs on all of them. Previously they were dropped silently.
    const pressDo = g.cases
      .filter((c) => c.tapCount === 1 && c.phase === "press")
      .flatMap((c) => c.do);
    if (pressDo.length) {
      groupManips.forEach((m: any) => {
        m.to = m.to || [];
        m.to.push(...pressDo);
      });
    }
    const conds = deviceLast(g.conditions);
    if (conds.length) {
      groupManips.forEach((m: any) => {
        m.conditions = m.conditions || [];
        m.conditions.push(...conds);
      });
    }
    stampLabel(groupManips, unionRawConditions(g.cases));
    manipulators.push(...groupManips);
  }
  return manipulators;
}

export function buildSimultaneousTapHold(
  b: Binding,
  cases: ResolvedCase[],
): Manipulator[] {
  const keys = getTriggerKeys(b.trigger);
  const byPhase = (p: Phase) =>
    cases.filter((c) => c.phase === p).flatMap((c) => c.do);
  const releaseEvents = byPhase("release");
  const holdEvents = byPhase("hold");
  const pressEvents = byPhase("press");

  const hasTapHold = releaseEvents.length > 0 || holdEvents.length > 0;

  const manipulators = hasTapHold
    ? simultaneousTapHold({
        keys,
        to: pressEvents.length > 0 ? pressEvents : undefined,
        alone: releaseEvents,
        hold: holdEvents,
        thresholdMs: b.timing?.aloneMs,
        karOptions: resolveSimKarOptions(b),
        simultaneousThresholdMs: b.timing?.simultaneousMs,
      })
    : simultaneousRemap({
        keys,
        to: pressEvents,
        karOptions: resolveSimKarOptions(b),
        simultaneousThresholdMs: b.timing?.simultaneousMs,
      });

  attachConditions(manipulators, cases);
  stampLabel(manipulators, unionRawConditions(cases));
  return manipulators;
}

export function buildTapHold(b: Binding, g: CaseGroup): Manipulator | Manipulator[] {
  const keys = getTriggerKeys(b.trigger);
  const isPointer = keys.length === 1 && isPointerButton(keys[0]!);
  const manipulators = isPointer
    ? buildPointerTapHold(b, g)
    : buildKeyTapHold(b, g);
  for (const cond of deviceLast(g.conditions)) {
    manipulators.forEach((m: any) => {
      m.conditions = m.conditions || [];
      m.conditions.push(cond);
    });
  }
  if (b.suppressCancelFallback) {
    manipulators.forEach((m: any) => {
      if (m.to_delayed_action?.to_if_canceled)
        m.to_delayed_action.to_if_canceled = [];
    });
  }
  if (b.suppress) {
    manipulators.forEach((m: any) => {
      m.to_if_alone = [];
    });
  }
  stampLabel(manipulators, g.rawConditions);
  return manipulators;
}

export function buildModWhileDown(
  b: Binding,
  g: CaseGroup,
  key: string,
): Manipulator[] {
  const resolvedKey = resolveKeyAlias(key);
  const builder = map(resolvedKey as any);
  if (b.whileHoldVar) {
    builder.to(toSetVar(b.whileHoldVar.name, 1));
    builder.toAfterKeyUp(toSetVar(b.whileHoldVar.name, 0));
  }
  for (const e of g.pressDo) builder.to(e);
  for (const e of g.releaseDo) builder.toIfAlone(e);
  const m = builder.build()[0] as any;
  m.from.modifiers = fromModifiersObj(b.trigger);
  return [m as Manipulator];
}

export function buildKeyTapHold(b: Binding, g: CaseGroup): Manipulator[] {
  const keys = getTriggerKeys(b.trigger);
  const rawKey = keys[0]!;
  const key = resolveKeyAlias(rawKey);
  if (b.modWhileDown) {
    return buildModWhileDown(b, g, key);
  }
  const { mandatory } = resolveModifiers(b.trigger.modifiers);
  // No tap case was specified, so the default is "re-emit the key as pressed".
  // `to.from_event` can't be used here: it only replays the original event
  // from the immediate `to` channel. to_if_alone / to_if_held_down /
  // to_delayed_action fire later (after the alone-timeout or a key-up), by
  // which point the original from-event is no longer available to replay, so
  // from_event silently emits nothing there. Explicit key_code + modifiers it is.
  const defaultEvents: ToEvent[] = resolveActionToEvents({
    type: "key",
    key,
    modifiers: mandatory as ActionKeyModifier[],
    options: { halt: true },
  });
  const alone = g.hasRelease ? g.releaseDo : defaultEvents;
  const hold = g.hasHold
    ? g.holdDo
    : isModifierKey(key)
      ? []
      : defaultEvents;
  const manipulators = tapHold({
    key,
    alone,
    hold,
    timeoutMs: b.timing?.aloneMs,
    thresholdMs: b.timing?.holdMs ?? b.timing?.heldThresholdMs,
    ...(b.whileHoldVar ? { variable: b.whileHoldVar.name } : {}),
  }).build();
  if (g.pressDo.length) {
    manipulators.forEach((m: any) => {
      m.to = m.to || [];
      m.to.push(...g.pressDo);
    });
  }
  const modifiersObj = fromModifiersObj(b.trigger);
  manipulators.forEach((m: any) => {
    m.from.modifiers = modifiersObj;
  });
  return manipulators;
}

export function buildPointerTapHold(b: Binding, g: CaseGroup): Manipulator[] {
  const pointerKey = getTriggerKeys(b.trigger)[0]!;
  const { button } = resolveButton(pointerKey);
  const from: Record<string, unknown> = {
    pointing_button: button,
    modifiers: fromModifiersObj(b.trigger),
  };
  const alone = g.hasRelease ? g.releaseDo : undefined;
  const hold = g.hasHold ? g.holdDo : undefined;
  const timeoutMs = b.timing?.aloneMs ?? MOUSE_TIMINGS.aloneMs;
  const thresholdMs = b.timing?.holdMs ?? b.timing?.heldThresholdMs ?? MOUSE_TIMINGS.holdMs;
  return tapHoldFrom({
    from: from as FromEvent,
    alone,
    hold,
    timeoutMs,
    thresholdMs,
    eventOptions: b.eventOptions,
    ...(b.whileHoldVar ? { variable: b.whileHoldVar.name } : {}),
  }).build();
}

export function buildRemap(
  b: Binding,
  g: { conditions: unknown[]; rawConditions: Condition[]; pressDo: any[] },
  isPointer: boolean,
): Manipulator | Manipulator[] {
  const label = synthesizeManipulatorLabel(g.rawConditions);
  // A press-only binding still has a key-up edge, and `afterKeyUp` is the only
  // channel that can fire on it. Dropping it here (the previous behaviour) made
  // the field silently do nothing outside chords.
  const afterKeyUp = b.afterKeyUp?.flatMap((a) => resolveActionToEvents(a)) ?? [];
  if (isPointer) {
    const pointerKey = getTriggerKeys(b.trigger)[0]!;
    const { button } = resolveButton(pointerKey);
    const from: Record<string, unknown> = { pointing_button: button };
    const { mandatory, optional } = resolveModifiers(b.trigger.modifiers);
    if (mandatory.length || optional.length) {
      from.modifiers = {
        ...(mandatory.length ? { mandatory } : {}),
        ...(optional.length ? { optional } : {}),
      };
    }
    const m: Record<string, unknown> = { type: "basic", from };
    if (g.pressDo.length) m.to = g.pressDo;
    if (afterKeyUp.length) m.to_after_key_up = afterKeyUp;
    if (label) m.description = label;
    const conds = deviceLast(g.conditions);
    if (conds.length) m.conditions = conds;
    return m as unknown as Manipulator;
  }
  const builder = map(triggerToFrom(b.trigger));
  if (label) builder.description(label);
  for (const cond of deviceLast(g.conditions)) builder.condition(cond as any);
  for (const e of g.pressDo) builder.to(e);
  for (const e of afterKeyUp) builder.toAfterKeyUp(e);
  return builder.build();
}
