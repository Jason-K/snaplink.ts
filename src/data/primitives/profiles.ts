/**
 * Primitive specification for Karabiner-Elements configuration profiles.
 * Defines profile identification metadata and profile-level simple modifications.
 *
 * @example
 * ```ts
 * const defaultProfile: ProfileSpec = {
 *   name: "JJK_Default",
 *   refDesc: "Primary customized profile",
 *   simpleModifications: SWAP_CTRL_FN,
 * };
 * ```
 */

export interface SimpleModificationPair {
  from: { key_code: string } | string;
  to: readonly ({ key_code: string } | string)[] | string;
}

export interface ProfileSpec {
  /**
   * Profile name as configured in Karabiner-Elements.
   *
   * @example "JJK_Default"
   * @example "Default profile"
   */
  name: string;

  /**
   * Human-readable description label.
   */
  refDesc?: string;

  /**
   * Whether this profile is selected as active by default.
   */
  selected?: boolean;

  /**
   * Profile-level simple modifications (key-to-key remaps applied at profile level).
   */
  simpleModifications?: readonly SimpleModificationPair[];
}
