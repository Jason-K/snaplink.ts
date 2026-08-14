import type { KeyCode } from "../../types/karabiner";
import type { ModKey } from "../constants/keys";
import type { PointingButton } from "../../types/karabiner";
import { type DEVICES } from "./devices";

// ── Button registry (replaces g502xButtons) ────────────────────────────────

export type DeviceName = keyof typeof DEVICES;

export type ButtonSpec = {
  button: PointingButton;
  nameScope: "global" | DeviceName[];
  desc: string;
};

export const BUTTONS = {
  // Physically standard (most pointing devices) → global. Bindings that must
  // restrict them add an explicit `device` condition.
  left: { button: "button1", nameScope: "global", desc: "Left click" },
  right: { button: "button2", nameScope: "global", desc: "Right click" },
  middle: { button: "button3", nameScope: "global", desc: "Middle click" },
  wheel: { button: "button3", nameScope: "global", desc: "Wheel click" },
  back: { button: "button4", nameScope: "global", desc: "Back button" },
  // G502X-specific extra buttons → auto-scope to the G502X.
  shift_button: {
    button: "button5",
    nameScope: ["g502X"],
    desc: "Shift button",
  },
  forward: {
    button: "button6",
    nameScope: ["g502X"],
    desc: "Forward button",
  },
  wheelLeft: {
    button: "button7",
    nameScope: ["g502X"],
    desc: "Wheel left",
  },
  wheelRight: {
    button: "button8",
    nameScope: ["g502X"],
    desc: "Wheel right",
  },
  middleBack: {
    button: "button9",
    nameScope: ["g502X"],
    desc: "Middle-back (G9)",
  },
  leftForward: {
    button: "button10",
    nameScope: ["g502X"],
    desc: "Left-forward (G8)",
  },
  leftBack: {
    button: "button11",
    nameScope: ["g502X"],
    desc: "Left-back (G7)",
  },
} as const satisfies Record<string, ButtonSpec>;

/** Fallback descriptions for buttons no {@link BUTTONS} entry names. */
export const BUTTON_DESCS: Partial<Record<PointingButton, string>> = {
  button1: "Left click",
  button2: "Right click",
  button3: "Middle click",
};

/**
 * The names *we* give buttons — derived from {@link BUTTONS} so the two cannot
 * drift. The previous hand-written union stopped at `button5` while `BUTTONS`
 * had already grown to `button11`.
 */
export type ButtonAlias = keyof typeof BUTTONS;

/**
 * Anything accepted where a pointer button is named: a Karabiner button name
 * (`button1`..`button255`, generated) or one of our aliases (`back`,
 * `wheelLeft`). `resolveButton()` maps the second onto the first.
 *
 * The `(string & {})` escape hatch this used to carry is gone: a button name
 * Karabiner does not know is now a compile error rather than JSON that fails
 * validation.
 */
export type PointerButtonAlias = PointingButton | ButtonAlias;

/** @deprecated Use {@link PointerButtonAlias}, or {@link ButtonAlias} for just our names. */
export type KnownPointerButton = PointerButtonAlias;

/**
 * Anything nameable as a trigger key.
 *
 * Three vocabularies meet here and all three are legal: a Karabiner key code
 * (`"a"`, `"escape"`), a modifier name or one of our aliases for one
 * (`"left_option"`, `"L.shift"`, `"cmd"`) since modifiers are triggerable keys,
 * and a pointer button or alias (`"button4"`, `"back"`). `resolveKeyAlias()`
 * and `resolveButton()` collapse the second and third onto the first, and a
 * `Trigger` may hold either form — `{ keys: ["R.cmd"] }` is resolved during
 * manipulator generation, not at construction.
 *
 * Composed here rather than in `data/primitives` or `data/constants`: it
 * spans a types-layer union (KeyCode), a constants-layer union (ModKey), and
 * this registry's own PointerButtonAlias. Keeping it beside PointerButtonAlias
 * is what lets it stay derived instead of a hand-duplicated union that can
 * silently fall behind BUTTONS, the same drift {@link ButtonAlias} above was
 * written to prevent.
 */
export type TriggerKey = KeyCode | ModKey | PointerButtonAlias;
