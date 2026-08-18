/**
 * Pointer tweaks — the two Karabiner manipulator types that are not `basic`.
 *
 * `mouse_basic` and `mouse_motion_to_scroll` carry no `from` key and no `to`
 * events, so a {@link Binding} cannot express them and none of the resolve
 * pipeline applies. They are collected separately by `src/config.ts` and
 * emitted directly.
 *
 * Both can render a machine unusable if left unscoped, so scoping is required
 * here rather than merely recommended — see the per-variant notes.
 */

import type { Condition, Trigger, TriggerModifiers } from "./bindings";
import type { PointerAxis } from "../../types/karabiner";
import type { PointerButtonAlias, TriggerKey } from "../registries/buttons";
import type { VarSpec } from "./vars";

/**
 * Invert, swap, or discard pointer axes.
 *
 * `discard` requires at least one condition: an unscoped discard can leave the
 * cursor completely unmovable, with no way to reach the Settings UI to undo it
 * (gotcha 1.2). `flip` and `swap` stay unconstrained — the pointer still moves,
 * so a mistake there is recoverable.
 *
 * @example
 * ```ts
 * const invertScroll: PointerTransform = {
 *   kind: "transform",
 *   description: "Invert vertical scroll direction",
 *   flip: ["vertical_wheel"],
 * };
 * ```
 */
export type PointerTransform = {
  /** Discriminator for pointer transformation tweaks (`"transform"`). */
  kind: "transform";

  /**
   * Human-readable label for this rule in Karabiner Settings and logs.
   *
   * @example "Invert vertical scroll direction"
   */
  description: string;

  /**
   * Invert one or more pointer axes (reverses motion direction).
   *
   * @example flip: ["vertical_wheel"]
   * @example flip: ["x", "y"]
   */
  flip?: PointerAxis[];

  /**
   * Swap the two pointer axes (`"xy"`) or the two scroll wheel axes (`"wheels"`).
   *
   * @example swap: ["xy"]
   * @example swap: ["wheels"]
   */
  swap?: ("xy" | "wheels")[];

  /**
   * Conditions under which this transform is active.
   * Required when using `discard`.
   */
  conditions?: Condition[];
} & (
  | {
      /**
       * Discard mouse movement along specified axes.
       * DANGER: Requires at least one condition to prevent locking out pointer movement permanently (gotcha 1.2).
       *
       * @example discard: ["horizontal_wheel"]
       */
      discard: [PointerAxis, ...PointerAxis[]];
      /** At least one condition is required when `discard` is specified. */
      conditions: [Condition, ...Condition[]];
    }
  | {
      /** `discard` is absent when no axes are dropped. */
      discard?: never;
    }
);

/**
 * Trigger input accepted by {@link PointerMotionToScroll}.
 *
 * Accepts:
 * - A pre-built `Trigger` (from `from(...)` / `trigger(...)`)
 * - A single key code or modifier string (e.g. `"fn"`, `"space"`, `"left_control"`)
 * - An array of key codes for simultaneous chords (e.g. `["d", "f"]`)
 * - A mouse button alias (e.g. `"button4"`, `"shift_button"`, `"left"`, `"right"`)
 *
 * @example "button4"
 * @example "fn"
 * @example ["d", "f"]
 * @example from("button4")
 */
export type PointerMotionTrigger =
  | Trigger
  | TriggerKey
  | TriggerKey[]
  | PointerButtonAlias;

/**
 * Common configuration options for {@link PointerMotionToScroll}.
 */
type PointerMotionToScrollBase = {
  /** Discriminator for motion-to-scroll tweaks (`"motionToScroll"`). */
  kind: "motionToScroll";

  /**
   * Human-readable label for this rule in Karabiner Settings and logs.
   *
   * @example "Hold button4 and move pointer to scroll"
   * @example "Hold fn and move pointer to scroll"
   */
  description: string;

  /**
   * Optional custom variable identifier or {@link VarSpec} used to signal scroll mode
   * when using non-modifier triggers (such as mouse buttons or key chords).
   *
   * If omitted, a descriptive unique variable name is derived automatically
   * (e.g. `enable_mouse_motion_to_scroll_<slug>`).
   *
   * @example "my_scroll_mode_active"
   * @example VARS.rButtonDown
   */
  variable?: VarSpec | string;

  /**
   * Whether momentum / inertial scrolling is enabled after pointer movement stops.
   *
   * @default true
   */
  momentumScroll?: boolean;

  /**
   * Multiplier applied to scroll speed. Higher values scroll faster.
   *
   * @default 1.0
   * @example 1.5
   */
  speedMultiplier?: number;
};

/**
 * Convert pointer motion into scrolling while a trigger is held or conditions are met.
 *
 * ### Scoping Architecture
 * - **Pointer Buttons / Keys / Chords**: When `trigger` is a button (e.g. `"button4"`) or key/chord (e.g. `["d", "f"]`),
 *   the compiler automatically emits two manipulators:
 *   1. A `basic` manipulator that sets a variable on press and unsets it on release (with `modifiers: { optional: ["any"] }`).
 *   2. A `mouse_motion_to_scroll` manipulator with `modifiers: { optional: ["any"] }` gated on that variable condition.
 * - **Modifiers**: When `trigger` (or `modifiers`) is a modifier (e.g. `"fn"`), Karabiner's `from.modifiers` handles it
 *   directly in a single `mouse_motion_to_scroll` manipulator.
 * - **Conditions**: `conditions` can also scope the tweak directly (e.g. `conditions: [onMouse]`).
 *
 * > [!CAUTION]
 * > DANGER: Without `trigger`, `modifiers`, or `conditions`, *all* pointer motion becomes scrolling permanently
 * > and the mouse becomes unusable (gotcha 1.3). The union below makes the unscoped form unrepresentable.
 *
 * @example
 * ```ts
 * // 1. Scoped by mouse button:
 * const buttonScroll: PointerMotionToScroll = {
 *   kind: "motionToScroll",
 *   description: "Hold button4 to scroll",
 *   trigger: "button4",
 *   speedMultiplier: 1.5,
 * };
 *
 * // 2. Scoped by modifier key:
 * const fnScroll: PointerMotionToScroll = {
 *   kind: "motionToScroll",
 *   description: "Hold fn to scroll",
 *   trigger: "fn",
 * };
 *
 * // 3. Scoped by key chord:
 * const chordScroll: PointerMotionToScroll = {
 *   kind: "motionToScroll",
 *   description: "Hold d+f to scroll",
 *   trigger: ["d", "f"],
 * };
 * ```
 */
export type PointerMotionToScroll = PointerMotionToScrollBase &
  (
    | {
        /**
         * Trigger input that activates scroll mode while held (mouse button, key, chord, or modifier).
         *
         * @example "button4"
         * @example "fn"
         * @example ["d", "f"]
         * @example from("shift_button")
         */
        trigger: PointerMotionTrigger;
        /** Optional modifier requirements (e.g. `["shift"]`, `{ optional: ["any"] }`). */
        modifiers?: TriggerModifiers;
        /** Optional additional conditions (e.g. application or device filters). */
        conditions?: Condition[];
      }
    | {
        /**
         * Optional trigger input that activates scroll mode while held.
         */
        trigger?: PointerMotionTrigger;
        /**
         * Modifier keys that activate scroll mode, or optional modifiers to allow through.
         *
         * @example ["fn"]
         * @example { mandatory: ["fn"], optional: ["any"] }
         */
        modifiers: TriggerModifiers;
        /** Optional additional conditions (e.g. application or device filters). */
        conditions?: Condition[];
      }
    | {
        /**
         * Optional trigger input that activates scroll mode while held.
         */
        trigger?: PointerMotionTrigger;
        /** Optional modifier requirements. */
        modifiers?: TriggerModifiers;
        /**
         * Conditions under which motion-to-scroll is active (e.g. device or application gating).
         * Must contain at least one condition if neither trigger nor modifiers is provided.
         *
         * @example [condDeviceExists(DEVICES.g502X)]
         */
        conditions: [Condition, ...Condition[]];
      }
  );

/**
 * Union of all pointer tweak definitions (`PointerTransform` and `PointerMotionToScroll`).
 */
export type PointerTweak = PointerTransform | PointerMotionToScroll;


