import type { Modifier } from "../../types/karabiner";

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
 * Karabiner's full `key_code` table (207 names), generated from the parser's
 * own tables via `npm run codegen`.
 */
export type { KeyCode } from "../../types/karabiner";

/**
 * @deprecated Alias of {@link KeyCode}, kept for existing `satisfies` call
 * sites. The distinction it used to draw — a curated subset, widened by
 * `(string & {})` — no longer exists.
 */
export type { KeyCode as StandardKeyCode } from "../../types/karabiner";
