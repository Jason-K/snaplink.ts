import type { PointingButton } from "../../types/karabiner";
import { type DEVICES } from "../registries/devices";

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

