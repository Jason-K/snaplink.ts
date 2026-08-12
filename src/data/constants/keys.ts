import type { KeyCode, Modifier } from "../../types/karabiner";
import type { PointerButtonAlias } from "./mouse";

/**
 * Shorthand this configuration accepts wherever a modifier is named. Resolved
 * to Karabiner names by `resolveKeyAlias()`.
 *
 * This is *our* vocabulary; {@link Modifier} is Karabiner's. Keep them separate:
 * the generated half is rewritten by `npm run codegen`, this half is not.
 */
export type ModAlias =
  | "cmd" | "opt" | "ctrl"
  | "L.cmd" | "R.cmd"
  | "L.opt" | "R.opt"
  | "L.ctrl" | "R.ctrl"
  | "L.shift" | "R.shift";

/** A Karabiner modifier name or one of our aliases for one. */
export type ModKey = Modifier | ModAlias;

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
 * Modelling only the first and third is what let `from("L.shift")` typecheck
 * against a union that did not contain it.
 */
export type TriggerKey = KeyCode | ModKey | PointerButtonAlias;

// Expansion map for ActionSpec key modifiers — consumed by action-resolver.ts
// Virtual modifiers use fixed slots in COCS order:
// Cmd, Opt, Ctrl, Shift. Missing modifiers are represented by "_".
export const VM = {
  CO__: ["command", "option"],
  C_C_: ["command", "control"],
  C__S: ["command", "shift"],
  _OC_: ["option", "control"],
  _O_S: ["option", "shift"],
  __CS: ["control", "shift"],
  COC_: ["command", "option", "control"],
  CO_S: ["command", "option", "shift"],
  C_CS: ["command", "control", "shift"],
  _OCS: ["option", "control", "shift"],
  COCS: ["command", "option", "control", "shift"],
} as const satisfies Record<string, Modifier[]>;

export type ModComboAlias = keyof typeof VM;

/**
 * Every Karabiner modifier name, as a value rather than a type.
 *
 * `satisfies Record<Modifier, true>` makes this exhaustive in both directions:
 * a name Karabiner does not know is rejected, and a name missing from here is a
 * compile error. When `npm run codegen` widens {@link Modifier} after an
 * upstream release, this object stops typechecking until it is updated — which
 * is the point. The previous hand-written list had silently fallen four names
 * behind (`left_alt`, `left_gui`, `right_alt`, `right_gui`, KE 12.3.0+), so
 * `isModifierKey("left_alt")` answered `false`.
 */
const MODIFIER_NAMES = {
  caps_lock: true,
  fn: true,
  left_command: true,
  left_control: true,
  left_option: true,
  left_shift: true,
  right_command: true,
  right_control: true,
  right_option: true,
  right_shift: true,
  // Either-side aliases in `from.modifiers`; left-only aliases in `to.modifiers`.
  command: true,
  control: true,
  option: true,
  shift: true,
  // KE 12.3.0+.
  left_alt: true,
  left_gui: true,
  right_alt: true,
  right_gui: true,
} as const satisfies Record<Modifier, true>;

/**
 * Membership test backing `isModifierKey()`. Typed as `ReadonlySet<string>`
 * because callers hand it the output of `resolveKeyAlias()`, which is a
 * `KeyCode` — Karabiner's modifier and key-code tables overlap but neither
 * contains the other (`shift` is a modifier, never a key code; `escape` the
 * reverse). The type safety lives in {@link MODIFIER_NAMES} above.
 */
export const MODKEY_CODES: ReadonlySet<string> = new Set(Object.keys(MODIFIER_NAMES));

/** Every Karabiner modifier name, in declaration order. */
export const MODIFIER_LIST = Object.keys(MODIFIER_NAMES) as readonly Modifier[];

/**
 * Karabiner's full `key_code` table (207 names), generated from the parser's
 * own tables via `npm run codegen`.
 *
 * This replaces the hand-maintained 118-name `StandardKeyCode` union that used
 * to live here. Every name in that list is present in this one, and the
 * `(string & {})` escape hatch is gone on purpose: a key name Karabiner does
 * not know is now a compile error rather than a rule that silently never fires.
 */
export type { KeyCode } from "../../types/karabiner";

/**
 * @deprecated Alias of {@link KeyCode}, kept for existing `satisfies` call
 * sites. The distinction it used to draw — a curated subset, widened by
 * `(string & {})` — no longer exists.
 */
export type { KeyCode as StandardKeyCode } from "../../types/karabiner";
