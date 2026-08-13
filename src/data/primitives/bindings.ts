import type {
  AnyEventType,
  FromEvent,
  InputSourceSpecifier,
  KeyboardType,
} from "../../types/karabiner";
import type { TriggerKey } from "../constants/keys";
import type { PointerButtonAlias } from "../constants/mouse";
import type { Action } from "./actions";
import type { AppSpec } from "./apps";
import type { DeviceSpec } from "./devices";
import type { PathSpec } from "./paths";
import type { VarSpec } from "./vars";

/**
 * When in the key lifecycle the case's action fires.
 * Maps directly to a Karabiner output event channel (`to`, `to_if_alone`, `to_after_key_up`).
 */
export type Phase = "press" | "release" | "hold";

/**
 * External state condition specification.
 * Evaluates external context (frontmost app, variable state, or hardware device) before triggering.
 *
 * @example
 * ```ts
 * const appCond: Condition = { app: "com.apple.finder" };
 * const varCond: Condition = { var: VARS.rButtonDown, equals: 1 };
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
    /** Target value required for variable match. */
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
    unless?: boolean;
    description?: string;
  }
  | {
    /**
     * The **virtual** keyboard type configured in Karabiner, not the physical
     * device (gotcha 8.6). Note `[` is `close_bracket` on JIS.
     */
    keyboardType: KeyboardType | KeyboardType[];
    unless?: boolean;
    description?: string;
  }
  | {
    /**
     * Active input source, matched by regex. Entries are ORed; keys within one
     * entry are ANDed (gotcha 8.1).
     */
    inputSource: InputSourceSpecifier | InputSourceSpecifier[];
    unless?: boolean;
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
    unless?: boolean;
    description?: string;
  }
  | {
    /** Input hardware device condition. */
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
  /** Enforcement mode for key press down order (`"insensitive"`, `"strict"`, `"strict_inverse"`). */
  down?: "insensitive" | "strict" | "strict_inverse";
  /** Enforcement mode for key release up order. */
  up?: "insensitive" | "strict" | "strict_inverse";
  /** Key release criteria (`"any"` or `"all"`). */
  upWhen?: "any" | "all";
  /** Require uninterrupted key sequence. */
  detectUninterrupted?: boolean;
};

/**
 * Trigger modifier key specification: array of modifier names or object specifying mandatory/optional modifiers.
 */
export type TriggerModifiers =
  | string[]
  | { mandatory?: string[]; optional?: string[] };

/**
 * Trigger input specification representing what key or mouse button was pressed.
 * 1 key = single key trigger; 2+ keys = simultaneous chord trigger.
 */
export type Trigger =
  /** Names may still be unresolved aliases; `buildManipulators()` resolves them. */
  | { keys: TriggerKey[]; modifiers?: TriggerModifiers; order?: SimOrder }
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
  /** Tap count requirement (default 1; 2 = double-tap, 3 = triple-tap). */
  tapCount?: number;
  /** Key lifecycle phase (`"press"`, `"release"`, `"hold"`). Default is `"press"`. */
  phase?: Phase;
  /** Conditions specific to this case. */
  conditions?: Condition[];
  /** Array of actions to execute when case matches. */
  do: Action[];
  /** Optional action fragment description line verbatim. */
  description?: string;
  /** Suppress trigger fallback (emit only explicit `do` actions). */
  suppress?: boolean;
  /** Multi-tap: route tap1 release as a delayed single tap instead of immediate. */
  delayed?: boolean;
  /** Double-tap guard: require two presses within timeout before firing. */
  guard?: boolean;
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
 * };
 * ```
 */
export type Binding = {
  /** Rule description label (auto-derived by synthesizer if absent). */
  description?: string;
  /** Input trigger specification. */
  trigger: Trigger;
  /**
   * Timing configuration parameters (ms).
   *
   * Fields accept an explicit `undefined` so callers can forward an optional
   * value directly (`aloneMs: config.thresholdMs`) without first testing it.
   */
  timing?: {
    aloneMs?: number | undefined;
    holdMs?: number | undefined;
    heldThresholdMs?: number | undefined;
    delayedMs?: number | undefined;
    simultaneousMs?: number | undefined;
  };
  /** Hoisted conditions applied to all cases within this binding. */
  conditions?: Condition[];
  /** Array of case pairings defining rule behavior across key phases and states. */
  cases: Case[];
  /** Event processing options (halt on match, repeat on hold). */
  eventOptions?: { halt?: boolean; repeat?: boolean };
  /** Multi-tap configuration settings. */
  multiTap?: {
    allowPassThrough?: boolean;
    mods?: string[];
    firstTapPendingVar?: VarSpec;
  };
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
  otherKeyPressed?: {
    /** Full `from` definitions — an entry may carry `modifiers`. */
    otherKeys: FromEvent | FromEvent[];
    do: Action[];
  }[];
  /** Tap-hold signaling variable set to 1 while key is held down and 0 on key release. */
  whileHoldVar?: VarSpec;
  /** Suppress trigger fallback across binding. */
  suppress?: boolean;
  /** Clear `to_if_canceled` fallback channel. */
  suppressCancelFallback?: boolean;
  /** Assert modifier while key is held down without hold threshold delay. */
  modWhileDown?: boolean;
  /** Variable name override for double-tap guard protection. */
  guardVar?: string;
  /** Timeout for double-tap guard protection in milliseconds. */
  guardMs?: number;
  /**
   * Emit this binding into a shared rule instead of one derived from its
   * trigger.
   *
   * Bindings that resolve to the *same* trigger are merged automatically; this
   * is the escape hatch for the case where several distinct triggers are one
   * feature and deserve one row in the GUI. `capsLayer()` uses it so that the
   * caps lock layer appears once rather than once per key it translates.
   *
   * `description` is the merged rule's label — mechanically merging the
   * variants' own descriptions produces an unreadable wall of near-duplicates,
   * so the group states what it does once.
   */
  ruleGroup?: { id: string; description: string };
};
