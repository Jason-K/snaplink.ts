import type { Modifier } from "../../types/karabiner";

// All valid Karabiner-native modifier keys and aliases (e.g. cmd, opt, ctrl, L.cmd, R.cmd)
export type ModKey = Modifier | "cmd" | "opt" | "ctrl" | "L.cmd" | "R.cmd" | "L.opt" | "R.opt" | "L.ctrl" | "R.ctrl" | "L.shift" | "R.shift" | (string & {});

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

export const MODKEY_CODES = new Set<string>([
  "left_shift",
  "right_shift",
  "left_command",
  "right_command",
  "left_control",
  "right_control",
  "left_option",
  "right_option",
  "fn",
  "caps_lock",
  "shift",
  "command",
  "control",
  "option",
]);

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
