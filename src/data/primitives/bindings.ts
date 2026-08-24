import type {
  AnyEventType,
  FromEvent,
  InputSourceSpecifier,
  KeyboardType,
} from "../../types/karabiner";
// TriggerKey/PointerButtonAlias are registry-derived (they depend on BUTTONS,
// which depends on DEVICES) rather than pure primitives; imported here as the
// one documented exception rather than hand-duplicating the button union.
import type { PointerButtonAlias, TriggerKey } from "../registries/buttons";
import type { Action } from "./actions";
import type { AppSpec } from "./apps";
import type { DeviceSpec } from "./devices";
import type { PathSpec } from "./paths";
import type { VarSpec } from "./vars";

/**
 * When in the key lifecycle the case's action fires.
 *
 * Maps directly to Karabiner manipulator output event channels:
 * - `"press"`: Fires immediately on key down (`to` channel, or press override).
 * - `"release"`: Fires on key release if no other key intervened (`to_if_alone` channel).
 * - `"hold"`: Fires after hold threshold elapses while held (`to_if_held_down` channel).
 */
export type Phase = "press" | "release" | "hold";

/**
 * External state condition specification.
 * Evaluates external context (frontmost app, variable state, hardware device, keyboard type, input source, or event modification) before triggering.
 *
 * @example
 * ```ts
 * const appCond: Condition = { app: "com.apple.finder" };
 * const varCond: Condition = { var: VARS.rButtonDown, equals: 1 };
 * const devCond: Condition = { device: DEVICES.g502X };
 * ```
 */
export type Condition =
  | {
    /** Application bundle ID or path condition. */
    app: AppSpec | PathSpec | string | (AppSpec | PathSpec | string)[];
    /** If true, condition evaluates to true when application is NOT frontmost. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /** Karabiner state variable condition. */
    var: VarSpec;
    /** Target value required for variable match. Strict equality matching (`1 != true`). */
    equals: string | number | boolean;
    /** If true, condition evaluates to true when variable value does NOT match. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /**
     * Whether a device is **connected**, regardless of which device produced
     * the event (KE 14.8.4+, gotcha 8.5).
     *
     * Distinct from `device`, which tests the event's own source: only this one
     * can express "while the mouse is plugged in" for a keystroke typed on the
     * built-in keyboard.
     */
    deviceExists: DeviceSpec;
    /** If true, condition matches when the device is NOT connected. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /**
     * The **virtual** keyboard type configured in Karabiner, not the physical
     * device (gotcha 8.6). Note `[` is `close_bracket` on JIS.
     */
    keyboardType: KeyboardType | KeyboardType[];
    /** If true, condition matches when the keyboard type does NOT match. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /**
     * Active input source, matched by regex. Entries are ORed; keys within one
     * entry are ANDed (gotcha 8.1).
     */
    inputSource: InputSourceSpecifier | InputSourceSpecifier[];
    /** If true, condition matches when input source does NOT match. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /**
     * Whether Simple Modifications already rewrote this event (gotcha 2.5).
     *
     * The mechanism that stops Function Keys Modifications from re-changing an
     * fx key that Complex Modifications already handled.
     */
    eventChanged: boolean;
    /** If true, condition matches when event was NOT changed by Simple Modifications. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  }
  | {
    /** Input hardware device condition matching the physical source device of this event. */
    device: DeviceSpec;
    /** If true, condition evaluates to true when input is NOT from specified device. */
    unless?: boolean;
    /** Optional description override. */
    description?: string;
  };

/**
 * Simultaneous key chord order requirements and uninterrupted detection settings.
 */
export type SimOrder = {
  /**
   * Enforcement mode for key press down order.
   * - `"insensitive"` (default): Keys can be pressed down in any sequence.
   * - `"strict"`: Keys must be pressed strictly in the defined array order.
   * - `"strict_inverse"`: Keys must be pressed strictly in reverse order.
   */
  down?: "insensitive" | "strict" | "strict_inverse";
  /**
   * Enforcement mode for key release up order.
   * - `"insensitive"`: Keys can be released in any order.
   * - `"strict"`: Keys must be released in the defined order.
   * - `"strict_inverse"`: Keys must be released in reverse order.
   */
  up?: "insensitive" | "strict" | "strict_inverse";
  /**
   * Key release criteria deciding when key_up is posted.
   * - `"any"` (default): Key up event is sent as soon as ANY chord key is released.
   * - `"all"`: Key up event is sent only after ALL chord keys have been released.
   */
  upWhen?: "any" | "all";
  /**
   * When true, an unrelated key down between the chord keys will not cancel the chord match (KE 14.4.0+).
   */
  detectUninterrupted?: boolean;
};

/**
 * Trigger modifier key specification.
 *
 * Defines required (mandatory) and permitted (optional) modifier keys for a trigger.
 *
 * Accepts:
 * - Array of modifier names / aliases: `["command", "option"]`, `["cmd", "opt"]`, `["shift"]`, `["L.cmd"]`, `["R.opt"]`, `["ctrl"]`
 * - Virtual modifier sets from `VM`: `VM.COCS`, `VM.COC_`, `VM.C__S`
 * - Object specifying mandatory and optional modifiers:
 *   - `mandatory`: Modifiers strictly required to trigger the rule. These are **consumed** (stripped) from emitted `to` events.
 *   - `optional`: Modifiers that are allowed to be held without preventing the rule from triggering. Without `optional: ["any"]`, holding any extra unlisted modifier will block the rule.
 *
 * @example
 * ```ts
 * ["cmd", "shift"]
 * VM.COCS
 * { mandatory: ["control"], optional: ["any"] }
 * { mandatory: ["left_command"], optional: ["caps_lock"] }
 * ```
 */
export type TriggerModifiers =
  | string[]
  | { mandatory?: string[]; optional?: string[] };

/**
 * Trigger input specification representing what key, mouse button, or wildcard event initiates a binding.
 *
 * Variants:
 * - 1 key = single key trigger
 * - 2+ keys = simultaneous chord trigger
 * - pointer = mouse button trigger
 * - any = wildcard event trigger (`from.any`)
 */
export type Trigger =
  /** Key-based trigger (single key or simultaneous chord). Names may still be unresolved aliases; resolved during compilation. */
  | { keys: TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder }
  /** Pointer button-based trigger (e.g. "button1", "button4", "left", "right"). */
  | { pointer: PointerButtonAlias; modifiers?: TriggerModifiers }
  /**
   * Every event of one kind — Karabiner's `from.any`.
   *
   * A catch-all claims the event before any later rule sees it, so it is only
   * ever correct behind a condition and ordered last. `capsLayer()` uses one to
   * notice that a key went through the layer without being translated.
   */
  | {
    /**
     * Generated from the schema, so this stays in step with the parser — the
     * hand-written version here listed three of the five families Karabiner
     * accepts, omitting both `apple_vendor_*` kinds.
     */
    any: AnyEventType;
    modifiers?: TriggerModifiers;
  };

/**
 * One (state + timing) -> action pairing within a binding rule.
 *
 * Cases of the same binding that share a condition set compile into one
 * manipulator, and a case whose conditions are *implied* by another's is
 * inherited into it: given `release(A).when(X)`, `release(B).when(not X)` and an
 * unconditional `hold(C)`, both emitted manipulators carry `C`. They have to —
 * Karabiner runs only the first manipulator whose `from` and conditions match,
 * so a phase left in a broader manipulator behind them would never fire.
 *
 * Two ways to opt out. Declare the phase explicitly — an empty `do` suppresses
 * it — or make the narrower case `press`-only, which marks it an immediate
 * override that inherits nothing (see `definitions/mouse.ts`, where a chord
 * replaces a button's whole tap/hold gesture).
 */
export type Case = {
  /**
   * Tap count requirement (default 1).
   * Set to `2` for double-tap, `3` for triple-tap.
   *
   * @example 2
   */
  tapCount?: number;
  /**
   * Key lifecycle phase determining which output channel receives the action.
   * - `"press"`: Immediate on key down (`to`).
   * - `"release"`: On key release (`to_if_alone`).
   * - `"hold"`: When held past threshold (`to_if_held_down`).
   *
   * @default "press"
   */
  phase?: Phase;
  /** Conditions specific to this individual case. */
  conditions?: Condition[];
  /** Array of actions to execute when this case matches. */
  do: Action[];
  /** Optional action fragment description line verbatim for documentation. */
  description?: string;
  /** Suppress trigger fallback (emit only explicit `do` actions, preventing pass-through). */
  suppress?: boolean;
  /** Multi-tap: route tap1 release as a delayed single tap instead of immediate. */
  delayed?: boolean;
  /** Double-tap guard: require two presses within timeout before firing. */
  guard?: boolean;
};

/**
 * Timing configuration parameters (ms) controlling key thresholds and delays.
 *
 * Out-of-range values are clamped with a log warning by Karabiner.
 */
export type BindingTiming = {
  /**
   * `basic.to_if_alone_timeout_milliseconds` (default 1000ms).
   * Maximum duration a key can be held down and still trigger `to_if_alone` upon release.
   * Holding longer than this cancels the `to_if_alone` action.
   *
   * @default 1000
   * @example 200
   */
  aloneMs?: number | undefined;

  /**
   * Hold duration threshold in milliseconds.
   * Controls when hold actions or custom hold thresholds activate.
   *
   * @example 200
   */
  holdMs?: number | undefined;

  /**
   * `basic.to_if_held_down_threshold_milliseconds` (default 500ms).
   * Duration the key must remain held down before `to_if_held_down` triggers.
   *
   * @default 500
   * @example 300
   */
  heldThresholdMs?: number | undefined;

  /**
   * `basic.to_delayed_action_delay_milliseconds` (default 500ms).
   * Delay after key down before `to_delayed_action.to_if_invoked` fires if no other key intervened.
   * The core mechanism behind double-tap and two-stroke bindings.
   *
   * @default 500
   * @example 300
   */
  delayedMs?: number | undefined;

  /**
   * `basic.simultaneous_threshold_milliseconds` (default 50ms, clamped 0..1000).
   * Time window within which multiple keys must all be pressed down to register as a simultaneous chord.
   *
   * @default 50
   * @example 75
   */
  simultaneousMs?: number | undefined;
};

/**
 * Event processing options for binding execution.
 */
export type BindingEventOptions = {
  /**
   * In `to_if_alone` / `to_if_held_down`: cancels subsequent `to_after_key_up`
   * and `to_delayed_action` channels when this action executes.
   *
   * @default false
   */
  halt?: boolean;

  /**
   * Whether the key event repeats automatically while held down.
   * (Karabiner native default is true; Snaplink generated actions default to false).
   *
   * @default false
   */
  repeat?: boolean;
};

/**
 * Multi-tap (double-tap, triple-tap) configuration settings.
 */
export type BindingMultiTap = {
  /**
   * When true, single taps pass through immediately to the OS without waiting
   * for the multi-tap timeout window to expire.
   *
   * @default false
   */
  allowPassThrough?: boolean;

  /**
   * Modifiers required to be held during the multi-tap sequence.
   *
   * @example ["command"]
   */
  mods?: string[];

  /**
   * Custom Karabiner variable tracking the pending state of the first tap.
   */
  firstTapPendingVar?: VarSpec;
};

/**
 * Entry for `to_if_other_key_pressed`, rewriting the held key itself when another key is pressed.
 */
export type BindingOtherKeyPressedEntry = {
  /**
   * Full `from` event definitions that trigger the rewrite when pressed while this key is held.
   * An entry may carry `modifiers` to distinguish chords.
   */
  otherKeys: FromEvent | FromEvent[];

  /** Actions to execute when one of `otherKeys` is pressed. */
  do: Action[];
};

/**
 * Group configuration to merge distinct triggers into a single named rule in Karabiner Settings.
 */
export type BindingRuleGroup = {
  /** Unique group identifier used for deduplication. */
  id: string;

  /** Label shown in the Karabiner Settings UI for the combined rule. */
  description: string;
};

/**
 * Complete Karabiner binding specification.
 * One `Binding` object represents one rule definition.
 *
 * @example
 * ```ts
 * const myBinding: Binding = {
 *   trigger: { keys: ["a"], modifiers: ["command"] },
 *   cases: [{ phase: "press", do: [{ type: "copy" }] }],
 *   timing: { aloneMs: 200 },
 *   description: "Cmd+A -> Copy",
 * };
 * ```
 */
export type Binding = {
  /**
   * Rule description label shown in Karabiner Settings and generated JSON.
   * Auto-derived by the synthesizer if omitted.
   *
   * @example "Cmd+J -> Down Arrow"
   */
  description?: string;

  /** Input trigger specification defining what key, chord, or mouse button activates this binding. */
  trigger: Trigger;

  /**
   * Timing configuration parameters in milliseconds.
   *
   * Fields accept an explicit `undefined` so callers can forward an optional
   * value directly (`aloneMs: config.thresholdMs`) without first testing it.
   */
  timing?: BindingTiming;

  /** Hoisted conditions applied to all manipulators generated by this binding. */
  conditions?: Condition[];

  /** Array of case pairings defining rule behavior across key phases and states. */
  cases: Case[];

  /** Event processing options (halt on match, repeat on hold). */
  eventOptions?: BindingEventOptions;

  /** Multi-tap configuration settings (double-tap detection, pass-through). */
  multiTap?: BindingMultiTap;

  /**
   * Actions executed after key release (`to_after_key_up`).
   *
   * Accepts raw `ToEvent`s as well as {@link ActionSpec}s, because a per-event
   * `conditions` gate — the only way to make a key-up emission depend on what
   * happened during the hold — has no `ActionSpec` spelling.
   */
  afterKeyUp?: Action[];

  /**
   * Rewrite this binding's own key when one of `otherKeys` is pressed while it
   * is held (`to_if_other_key_pressed`).
   *
   * The documented fix for the `option+tab -> command+tab` trap: remapping via
   * mandatory modifiers changes only the second key's output, so pressing a
   * further modifier releases the substituted one and the app switcher closes
   * (gotcha 7.7). This rewrites the held key itself instead.
   *
   * Additive to the binding's `press` cases rather than replacing them, and
   * evaluated per entry, so one held key can target several chords.
   */
  otherKeyPressed?: BindingOtherKeyPressedEntry[];

  /**
   * Tap-hold signaling variable set to 1 while key is held down and automatically reset to 0 on release (`to_after_key_up`).
   *
   * Perfect for momentary modal layers or mouse scroll triggers.
   *
   * @example VARS.rButtonDown
   */
  whileHoldVar?: VarSpec;

  /**
   * Suppress trigger fallback across binding (emits only explicit `do` actions, dropping default pass-through).
   *
   * @default false
   */
  suppress?: boolean;

  /**
   * Clear `to_if_canceled` fallback channel on delayed actions.
   *
   * @default false
   */
  suppressCancelFallback?: boolean;

  /**
   * Assert modifier while key is held down without waiting for hold threshold delay.
   *
   * @default false
   */
  modWhileDown?: boolean;

  /** Variable name override for double-tap guard protection. */
  guardVar?: string;

  /**
   * Timeout for double-tap guard protection in milliseconds.
   *
   * @default 300
   */
  guardMs?: number;

  /**
   * Emit this binding into a shared rule instead of one derived from its trigger.
   *
   * Bindings that resolve to the *same* trigger are merged automatically; this
   * is the escape hatch for the case where several distinct triggers are one
   * feature and deserve one row in the GUI. `capsLayer()` uses it so that the
   * caps lock layer appears once rather than once per key it translates.
   *
   * `description` is the merged rule's label — mechanically merging the
   * variants' own descriptions produces an unreadable wall of near-duplicates,
   * so the group states what it does once.
   *
   * @example { id: "caps_lock_layer", description: "Hyper / Caps Lock Layer" }
   */
  ruleGroup?: BindingRuleGroup;
};
