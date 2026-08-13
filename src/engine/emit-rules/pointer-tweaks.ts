/**
 * Compile {@link PointerTweak}s into rules.
 *
 * These bypass the `Binding` pipeline entirely: `mouse_basic` and
 * `mouse_motion_to_scroll` carry no `from` key and no `to` events, so there is
 * nothing for `resolve-trigger` or `resolve-to-action` to do. They also sit
 * outside conflict analysis, which reasons about key events — a pointer tweak
 * claims pointer motion, which no key rule competes for.
 *
 * The scoping requirements are enforced twice on purpose. The types make the
 * dangerous form unrepresentable for hand-authored definitions; these runtime
 * checks catch anything that reaches here through a cast or a widened type,
 * because the failure mode is a machine you cannot drive to the Settings UI.
 */

import type { Manipulator, Rule } from "../../types/karabiner";
import type { PointerTweak } from "../../data";
import { rule } from "../karabiner-helpers";
import { resolveCondition } from "../resolve-conditions";
import { fromModifiersObj } from "../resolve-trigger";

function compile(tweak: PointerTweak): Manipulator {
  const conditions = tweak.conditions?.map(resolveCondition) ?? [];

  if (tweak.kind === "transform") {
    if (tweak.discard?.length && conditions.length === 0) {
      throw new Error(
        `pointer tweak "${tweak.description}": discard requires at least one condition — ` +
          "an unscoped discard can leave the cursor unmovable (gotcha 1.2)",
      );
    }
    if (!tweak.flip?.length && !tweak.swap?.length && !tweak.discard?.length) {
      throw new Error(`pointer tweak "${tweak.description}": names no flip, swap or discard`);
    }
    return {
      type: "mouse_basic",
      ...(tweak.flip?.length ? { flip: tweak.flip } : {}),
      ...(tweak.swap?.length ? { swap: tweak.swap } : {}),
      ...(tweak.discard?.length ? { discard: tweak.discard } : {}),
      ...(conditions.length ? { conditions } : {}),
      description: tweak.description,
    } as Manipulator;
  }

  const modifiers = tweak.modifiers ? fromModifiersObj({ keys: [], modifiers: tweak.modifiers }) : undefined;
  const hasModifiers = Boolean(modifiers?.mandatory?.length || modifiers?.optional?.length);
  if (!hasModifiers && conditions.length === 0) {
    throw new Error(
      `pointer tweak "${tweak.description}": mouse_motion_to_scroll requires modifiers or ` +
        "conditions — with neither, all pointer motion becomes scrolling permanently (gotcha 1.3)",
    );
  }
  const options = {
    ...(tweak.momentumScroll !== undefined ? { momentum_scroll_enabled: tweak.momentumScroll } : {}),
    ...(tweak.speedMultiplier !== undefined ? { speed_multiplier: tweak.speedMultiplier } : {}),
  };
  return {
    type: "mouse_motion_to_scroll",
    ...(hasModifiers ? { from: { modifiers } } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(Object.keys(options).length ? { options } : {}),
    description: tweak.description,
  } as Manipulator;
}

/** One rule per tweak, so each can be toggled independently in Settings. */
export function emitPointerTweaks(tweaks: readonly PointerTweak[]): Rule[] {
  return tweaks.map((tweak) => rule(tweak.description).manipulators([compile(tweak)]).build());
}
