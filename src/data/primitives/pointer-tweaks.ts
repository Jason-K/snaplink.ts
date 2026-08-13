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

import type { Condition, TriggerModifiers } from "./bindings";
import type { PointerAxis } from "../../types/karabiner";

/**
 * Invert, swap, or discard pointer axes.
 *
 * `discard` requires at least one condition: an unscoped discard can leave the
 * cursor completely unmovable, with no way to reach the Settings UI to undo it
 * (gotcha 1.2). `flip` and `swap` stay unconstrained — the pointer still moves,
 * so a mistake there is recoverable.
 */
export type PointerTransform = {
  kind: "transform";
  description: string;
  /** Invert an axis. */
  flip?: PointerAxis[];
  /** Swap the two pointer axes, or the two wheel axes. */
  swap?: ("xy" | "wheels")[];
  conditions?: Condition[];
} & (
  | { discard: [PointerAxis, ...PointerAxis[]]; conditions: [Condition, ...Condition[]] }
  | { discard?: never }
);

/**
 * Convert pointer motion into scrolling.
 *
 * Requires `modifiers` or `conditions`: with neither, *all* pointer motion
 * becomes scrolling permanently and the mouse is unusable (gotcha 1.3). The
 * union below makes the unscoped form unrepresentable.
 */
export type PointerMotionToScroll = {
  kind: "motionToScroll";
  description: string;
  /** Default true. */
  momentumScroll?: boolean;
  /** Default 1.0. */
  speedMultiplier?: number;
} & (
  | { modifiers: TriggerModifiers; conditions?: Condition[] }
  | { conditions: [Condition, ...Condition[]]; modifiers?: TriggerModifiers }
);

export type PointerTweak = PointerTransform | PointerMotionToScroll;
