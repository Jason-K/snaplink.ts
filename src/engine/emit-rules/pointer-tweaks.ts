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

import type {
  BasicManipulator,
  FromModifier,
  Manipulator,
  MouseMotionToScrollManipulator,
  Rule,
  VariableCondition,
} from "../../types/karabiner";
import type { PointerTweak, VarSpec } from "../../data";
import { rule } from "../karabiner-helpers";
import { resolveCondition } from "../resolve-conditions";
import { triggerToFrom } from "../resolve-trigger";
import { from } from "../wrappers/from-action-wrappers";
import {
  getTriggerKeys,
  isModifierKey,
  resolveKeyAlias,
  resolveModifiers,
} from "../utils";
import { stampDeviceScope } from "../emit-manipulators/binding/stamping";

function deriveVariableName(tweak: { description: string; variable?: VarSpec | string }): string {
  if (tweak.variable) {
    return typeof tweak.variable === "string" ? tweak.variable : tweak.variable.name;
  }
  const slug = tweak.description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `enable_mouse_motion_to_scroll_${slug}` : "enable_mouse_motion_to_scroll";
}

function compileTweak(tweak: PointerTweak): Manipulator[] {
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
    const manipulator = {
      type: "mouse_basic",
      ...(tweak.flip?.length ? { flip: tweak.flip } : {}),
      ...(tweak.swap?.length ? { swap: tweak.swap } : {}),
      ...(tweak.discard?.length ? { discard: tweak.discard } : {}),
      ...(conditions.length ? { conditions } : {}),
      description: tweak.description,
    } as Manipulator;
    return [manipulator];
  }

  const options = {
    ...(tweak.momentumScroll !== undefined ? { momentum_scroll_enabled: tweak.momentumScroll } : {}),
    ...(tweak.speedMultiplier !== undefined ? { speed_multiplier: tweak.speedMultiplier } : {}),
  };

  // Case 1: Trigger provided
  if (tweak.trigger !== undefined) {
    const resolvedTrigger = from(tweak.trigger, tweak.modifiers);
    const triggerKeys = getTriggerKeys(resolvedTrigger);
    const isPureModifier =
      "keys" in resolvedTrigger &&
      triggerKeys.length > 0 &&
      triggerKeys.every((k) => isModifierKey(k));

    if (isPureModifier) {
      const keyMods = triggerKeys.map((k) => resolveKeyAlias(k)) as FromModifier[];
      const { mandatory, optional } = resolveModifiers(resolvedTrigger.modifiers);
      const combinedMandatory = [...new Set([...keyMods, ...(mandatory as FromModifier[])])];
      const optionalMods: FromModifier[] = optional.length > 0 ? (optional as FromModifier[]) : ["any"];

      const scrollManipulator: MouseMotionToScrollManipulator = {
        type: "mouse_motion_to_scroll",
        from: {
          modifiers: {
            ...(combinedMandatory.length ? { mandatory: combinedMandatory } : {}),
            optional: optionalMods,
          },
        },
        ...(conditions.length ? { conditions } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        description: tweak.description,
      };
      return [scrollManipulator];
    }

    // Non-modifier trigger (pointing button, regular key, simultaneous chord, etc.):
    // emit basic trigger setting variable + mouse_motion_to_scroll conditioned on that variable.
    const triggerFrom = triggerToFrom(resolvedTrigger);
    if (!triggerFrom.modifiers || (!triggerFrom.modifiers.optional?.length && !triggerFrom.modifiers.mandatory?.length)) {
      triggerFrom.modifiers = { optional: ["any"] };
    } else if (!triggerFrom.modifiers.optional?.length) {
      triggerFrom.modifiers.optional = ["any"];
    }

    const varName = deriveVariableName(tweak);
    const triggerManipulator: BasicManipulator = {
      type: "basic",
      from: triggerFrom,
      to: [
        {
          set_variable: {
            name: varName,
            value: 1,
            key_up_value: 0,
          },
        },
      ],
      ...(conditions.length ? { conditions: [...conditions] } : {}),
      description: `${tweak.description} (trigger)`,
    };
    stampDeviceScope([triggerManipulator], resolvedTrigger);

    const varCondition: VariableCondition = {
      type: "variable_if",
      name: varName,
      value: 1,
    };
    const scrollManipulator: MouseMotionToScrollManipulator = {
      type: "mouse_motion_to_scroll",
      from: {
        modifiers: {
          optional: ["any"],
        },
      },
      conditions: [...conditions, varCondition],
      ...(Object.keys(options).length ? { options } : {}),
      description: tweak.description,
    };

    return [triggerManipulator, scrollManipulator];
  }

  // Case 2: Modifiers provided without trigger
  if (tweak.modifiers !== undefined) {
    const { mandatory, optional } = resolveModifiers(tweak.modifiers);
    const hasModifiers = Boolean(mandatory.length || optional.length);

    if (hasModifiers) {
      const optionalMods: FromModifier[] = optional.length > 0 ? (optional as FromModifier[]) : ["any"];
      const scrollManipulator: MouseMotionToScrollManipulator = {
        type: "mouse_motion_to_scroll",
        from: {
          modifiers: {
            ...(mandatory.length ? { mandatory: mandatory as FromModifier[] } : {}),
            optional: optionalMods,
          },
        },
        ...(conditions.length ? { conditions } : {}),
        ...(Object.keys(options).length ? { options } : {}),
        description: tweak.description,
      };
      return [scrollManipulator];
    }
  }

  // Case 3: Condition-only scoping (no trigger and no mandatory modifiers)
  if (conditions.length > 0) {
    const scrollManipulator: MouseMotionToScrollManipulator = {
      type: "mouse_motion_to_scroll",
      from: {
        modifiers: {
          optional: ["any"],
        },
      },
      conditions,
      ...(Object.keys(options).length ? { options } : {}),
      description: tweak.description,
    };
    return [scrollManipulator];
  }

  // Case 4: Unscoped
  throw new Error(
    `pointer tweak "${tweak.description}": mouse_motion_to_scroll requires a trigger, modifiers, or ` +
      "conditions — with none, all pointer motion becomes scrolling permanently (gotcha 1.3)",
  );
}

/** One rule per tweak, so each can be toggled independently in Settings. */
export function emitPointerTweaks(tweaks: readonly PointerTweak[]): Rule[] {
  return tweaks.map((tweak) => rule(tweak.description).manipulators(compileTweak(tweak)).build());
}

