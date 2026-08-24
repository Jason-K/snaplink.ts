import type {
  BasicManipulator,
  FromEvent,
  Modifier,
  ToEvent,
} from "../../types/karabiner";
import type { AcceptUndefined } from "../../types/util";
import {
  ifApp,
  map,
  toKey,
  toSetVar,
  type ConditionBuilder,
} from "../karabiner-helpers";
import { KB_TIMINGS, DEFAULT_TIMINGS, TIMINGS } from "../../data";
import { isModifierKey } from "../utils";

/**
 * Helper to compute manipulator-level parameters ONLY for values that differ
 * from profile-level baseline parameters (`DEFAULT_TIMINGS`).
 */
function resolveDiffParams(
  aloneMs?: number,
  holdMs?: number,
  delayedMs?: number,
): Record<string, number> | undefined {
  const params: Record<string, number> = {};
  if (
    aloneMs !== undefined &&
    aloneMs !== DEFAULT_TIMINGS["basic.to_if_alone_timeout_milliseconds"]
  ) {
    params["basic.to_if_alone_timeout_milliseconds"] = aloneMs;
  }
  if (
    holdMs !== undefined &&
    holdMs !== DEFAULT_TIMINGS["basic.to_if_held_down_threshold_milliseconds"]
  ) {
    params["basic.to_if_held_down_threshold_milliseconds"] = holdMs;
  }
  if (
    delayedMs !== undefined &&
    delayedMs !== DEFAULT_TIMINGS["basic.to_delayed_action_delay_milliseconds"]
  ) {
    params["basic.to_delayed_action_delay_milliseconds"] = delayedMs;
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Configuration for basic tap-hold behavior
 */
interface TapHoldOpts {
  key: string;
  alone?: ToEvent[];
  hold?: ToEvent[];
  eventOptions?: {
    halt?: boolean;
    repeat?: boolean;
  };
  timeoutMs?: number;
  thresholdMs?: number;
  cancel?: ToEvent[];
  invoked?: ToEvent[];
  variable?: string;
  appOverrides?: Array<{
    app: string;
    unless?: boolean;
    alone?: ToEvent[];
    hold?: ToEvent[];
    timeoutMs?: number;
    thresholdMs?: number;
    cancel?: ToEvent[];
    invoked?: ToEvent[];
  }>;
}

interface TapHoldFromOpts extends Omit<TapHoldOpts, "key"> {
  from: FromEvent;
}

interface VarTapTapHoldFromOpts extends Omit<VarTapTapHoldOpts, "key"> {
  from: FromEvent;
  passThrough?: ToEvent;
}

function cloneFromEvent(from: FromEvent): FromEvent {
  return JSON.parse(JSON.stringify(from)) as FromEvent;
}

export function tapHoldFrom({
  from,
  alone,
  hold,
  eventOptions,
  timeoutMs = KB_TIMINGS.aloneMs,
  thresholdMs = KB_TIMINGS.holdMs,
  cancel,
  invoked,
  variable,
  appOverrides,
}: AcceptUndefined<TapHoldFromOpts>) {
  const builders: any[] = [];

  const withEventOptions = (event: ToEvent): ToEvent => {
    if (!eventOptions) return event;
    return {
      ...eventOptions,
      ...event,
    } as ToEvent;
  };

  const makeBuilder = (opts: {
    alone?: ToEvent[] | undefined;
    hold?: ToEvent[] | undefined;
    timeoutMs?: number | undefined;
    thresholdMs?: number | undefined;
    cancel?: ToEvent[] | undefined;
    invoked?: ToEvent[] | undefined;
    cond?: ConditionBuilder | undefined;
  }) => {
    const finalTimeout = opts.timeoutMs ?? timeoutMs;
    const finalThreshold = opts.thresholdMs ?? thresholdMs;
    const diffParams = resolveDiffParams(finalTimeout, finalThreshold);

    const m = map(cloneFromEvent(from));
    if (diffParams) {
      m.parameters(diffParams);
    }

    if (variable) {
      m.to(toSetVar(variable, 1));
      m.toAfterKeyUp(toSetVar(variable, 0));
    }
    if (opts.cond) m.condition(opts.cond);
    if (opts.alone) {
      opts.alone.forEach((e: ToEvent) => m.toIfAlone(withEventOptions(e)));
    }
    if (opts.hold) {
      const fromKeyCode = (from as any).key_code;
      const isFromMod = typeof fromKeyCode === "string" && isModifierKey(fromKeyCode);
      const filteredHold = isFromMod
        ? opts.hold.filter((e: any) => e.key_code !== fromKeyCode)
        : opts.hold;
      // halt:true (unless the event already sets it) cancels the subsequent
      // to_delayed_action once the hold has fired, so a release after a
      // genuine hold doesn't also replay the cancel-fallback below. Skipped
      // when `variable` is set: halt would also cancel to_after_key_up, which
      // whileHoldVar relies on to clear its tracking variable on release.
      const holdEvent = variable
        ? withEventOptions
        : (e: ToEvent) => withEventOptions({ halt: true, ...e } as ToEvent);
      filteredHold.forEach((e: ToEvent) => m.toIfHeldDown(holdEvent(e)));
    }

    // Fall back to the alone events on cancel: this is what lets Karabiner
    // commit to "this was a tap" as soon as the next key is pressed, instead
    // of waiting out the full alone-timeout — load-bearing for typing
    // responsiveness. The halt:true above (default on to_if_held_down) stops
    // this from re-firing once a hold has already committed.
    const cancelEvents = opts.cancel ?? cancel ?? alone ?? [];
    const invokedEvents = opts.invoked ?? invoked ?? [];
    m.toDelayedAction(invokedEvents, cancelEvents);
    return m;
  };

  if (appOverrides && Array.isArray(appOverrides)) {
    appOverrides.forEach((ov) => {
      const matcher = ov.app;
      let cond = ifApp(matcher);
      if (ov.unless) cond = cond.unless();
      builders.push(
        makeBuilder({
          alone: ov.alone,
          hold: ov.hold,
          timeoutMs: ov.timeoutMs,
          thresholdMs: ov.thresholdMs,
          cancel: ov.cancel,
          invoked: ov.invoked,
          cond,
        }),
      );
    });
  }

  builders.push(makeBuilder({ alone, hold }));

  return {
    build: () => builders.flatMap((b) => b.build()),
  };
}

/**
 * Creates a tap-hold manipulator with proper to_delayed_action support.
 */
export function tapHold({
  key,
  alone,
  hold,
  eventOptions,
  timeoutMs = KB_TIMINGS.aloneMs,
  thresholdMs = KB_TIMINGS.holdMs,
  cancel,
  invoked,
  variable,
  appOverrides,
}: AcceptUndefined<TapHoldOpts>) {
  return tapHoldFrom({
    from: { key_code: key as any },
    alone,
    hold,
    eventOptions,
    timeoutMs,
    thresholdMs,
    cancel,
    invoked,
    variable,
    appOverrides,
  });
}

/**
 * Configuration for double-tap-hold patterns with variables
 */
interface VarTapTapHoldOpts extends Omit<TapHoldOpts, "alone" | "hold"> {
  key: string;
  firstTapPendingVar: string;
  /** Manipulator description; falls back to a label derived from the variable. */
  description?: string;
  // Fires immediately using the first tap's to_if_alone path; blocks double-tap detection
  immediateSingleTapEvents?: ToEvent[];
  // Fires based on to_delayed_action.to_if_invoked, allowing double tap
  delayedSingleTapEvents?: ToEvent[];
  holdEvents?: ToEvent[];
  doubleTapEvents?: ToEvent[];
  doubleTapHoldEvents?: ToEvent[];
  allowPassThrough?: boolean;
  mods?: Modifier[];
}

export function varTapTapHoldFrom({
  from,
  firstTapPendingVar,
  immediateSingleTapEvents,
  delayedSingleTapEvents,
  holdEvents,
  doubleTapEvents,
  doubleTapHoldEvents,
  thresholdMs = TIMINGS.timeoutDoubleTapMs,
  description,
  allowPassThrough,
  mods,
  passThrough,
}: AcceptUndefined<VarTapTapHoldFromOpts>) {
  const fromBase = cloneFromEvent(from);
  if (mods !== undefined) {
    if (mods.length === 0) {
      delete fromBase.modifiers;
    } else {
      fromBase.modifiers = { mandatory: mods };
    }
  }

  // NOTE: a filter dropping hold events that re-emit the trigger's own modifier
  // key used to be computed here and then never used — `to_if_held_down` below
  // wires the unfiltered `holdEvents`. Removed because it had no effect; if that
  // suppression is wanted, apply it at the `to_if_held_down` site instead.

  const secondTapParams: Record<string, number> = {
    "basic.to_if_alone_timeout_milliseconds": thresholdMs,
    "basic.to_if_held_down_threshold_milliseconds": thresholdMs,
  };

  const secondTap: BasicManipulator = {
    type: "basic",
    from: cloneFromEvent(fromBase),
    conditions: [{ type: "variable_if", name: firstTapPendingVar, value: 1 } as any],
    parameters: secondTapParams,
    description:
      description ||
      `${firstTapPendingVar} second tap (tap-tap / tap-tap-hold)`,
    to: [...(passThrough ? [passThrough] : [])],
    to_if_alone: [toSetVar(firstTapPendingVar, 0), ...(doubleTapEvents ?? [])],
    to_if_held_down: [
      toSetVar(firstTapPendingVar, 0),
      ...(doubleTapHoldEvents ?? []),
    ],
    to_delayed_action: {
      to_if_invoked: [toSetVar(firstTapPendingVar, 0)],
      to_if_canceled: [toSetVar(firstTapPendingVar, 0)],
    },
  } as any;

  let firstTap: BasicManipulator;

  const firstTapAloneEvents = delayedSingleTapEvents
    ? [toSetVar(firstTapPendingVar, 1)]
    : [toSetVar(firstTapPendingVar, 1), ...(immediateSingleTapEvents ?? [])];
  const firstTapInvokedEvents = delayedSingleTapEvents
    ? [...delayedSingleTapEvents, toSetVar(firstTapPendingVar, 0)]
    : [toSetVar(firstTapPendingVar, 0)];

  const firstTapParams: Record<string, number> = {
    "basic.to_delayed_action_delay_milliseconds": thresholdMs,
    "basic.to_if_held_down_threshold_milliseconds": thresholdMs,
    "basic.to_if_alone_timeout_milliseconds": thresholdMs,
  };

  const keyFrom = (from as any).key_code;
  const defaultPassThroughEvent = keyFrom ? toKey(keyFrom) : undefined;

  if (allowPassThrough) {
    firstTap = {
      type: "basic",
      from: cloneFromEvent(fromBase),
      parameters: firstTapParams,
      description:
        description || `${firstTapPendingVar} first tap (pass-through)`,
      to: [
        toSetVar(firstTapPendingVar, 1),
        ...(passThrough ? [passThrough] : []),
      ],
      to_if_alone: [
        toSetVar(firstTapPendingVar, 1),
        ...(defaultPassThroughEvent ? [defaultPassThroughEvent] : []),
      ],
      to_if_held_down: [
        toSetVar(firstTapPendingVar, 0),
        ...(defaultPassThroughEvent ? [defaultPassThroughEvent] : []),
      ],
      to_delayed_action: {
        to_if_invoked: firstTapInvokedEvents,
        to_if_canceled: [toSetVar(firstTapPendingVar, 0)],
      },
    } as any;
  } else {
    firstTap = {
      type: "basic",
      from: cloneFromEvent(fromBase),
      parameters: firstTapParams,
      description:
        description || `${firstTapPendingVar} first tap (tap / tap-hold)`,
      to: [toSetVar(firstTapPendingVar, 1)],
      to_if_alone: firstTapAloneEvents,
      to_if_held_down: [toSetVar(firstTapPendingVar, 0), ...(holdEvents ?? [])],
      to_delayed_action: {
        to_if_invoked: firstTapInvokedEvents,
        to_if_canceled: [toSetVar(firstTapPendingVar, 0)],
      },
    } as any;
  }

  return [secondTap, firstTap];
}

/**
 * Creates a complex double-tap-hold pattern using variable tracking.
 */
export function varTapTapHold({
  key,
  firstTapPendingVar,
  immediateSingleTapEvents,
  delayedSingleTapEvents,
  holdEvents,
  doubleTapEvents,
  doubleTapHoldEvents,
  thresholdMs = TIMINGS.timeoutDoubleTapMs,
  description,
  allowPassThrough,
  mods,
}: AcceptUndefined<VarTapTapHoldOpts>) {
  return varTapTapHoldFrom({
    from: { key_code: key as any },
    passThrough: allowPassThrough
      ? toKey(key as any, [], { lazy: true })
      : undefined,
    firstTapPendingVar,
    immediateSingleTapEvents,
    delayedSingleTapEvents,
    holdEvents,
    doubleTapEvents,
    doubleTapHoldEvents,
    thresholdMs,
    description,
    allowPassThrough,
    mods,
  });
}
