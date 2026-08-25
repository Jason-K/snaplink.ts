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

// Scoped factory helpers for concise single-line button definitions
const globalBtn = (button: PointingButton, desc: string): ButtonSpec => ({
  button,
  nameScope: "global",
  desc,
});

const g502xBtn = (button: PointingButton, desc: string): ButtonSpec => ({
  button,
  nameScope: ["g502X"],
  desc,
});

export const BUTTONS = {
  // Physically standard (most pointing devices) → global. Bindings that must
  // restrict them add an explicit `device` condition.
  left: globalBtn("button1", "left click"),
  right: globalBtn("button2", "right click"),
  middle: globalBtn("button3", "middle click"),
  wheel: globalBtn("button3", "wheel click"),
  back: globalBtn("button4", "back button"),
  // G502X-specific extra buttons → auto-scope to the G502X.
  shift_button: g502xBtn("button5", "shift button"),
  forward: g502xBtn("button6", "forward button"),
  wheelLeft: g502xBtn("button7", "wheel left"),
  wheelRight: g502xBtn("button8", "wheel right"),
  middleBack: g502xBtn("button9", "middle-back button"),
  leftForward: g502xBtn("button10", "left-forward button"),
  leftBack: g502xBtn("button11", "left-back button"),
} as const satisfies Record<string, ButtonSpec>;

/** Fallback descriptions for buttons no {@link BUTTONS} entry names. */
export const BUTTON_DESCS: Partial<Record<PointingButton, string>> = {
  button1: "left click",
  button2: "right click",
  button3: "middle click",
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
