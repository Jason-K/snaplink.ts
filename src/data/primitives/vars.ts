/**
 * Registry specification for Karabiner state variables.
 * Used in condition checking (`ifVar`/`ifUserVar`/`ifKeVar`) and variable mutation (`setVar`).
 * 
 * **Notes on Variables:**
 * - Type matching is strict: `1 != true`, `true != "true"`.
 * - When a variable is unset, Karabiner evaluates its value as `0`, not `false` or `""`.
 * - Accessibility API variables are either strings (`accessibility.*_string`) or integers (`accessibility.*_size_*` / `accessibility.*_position_*`).
 *
 * @example
 * ```ts
 * const rightButtonHeld: VarSpec = {
 *   name: "right_button_pressed",
 *   varDesc: "Right mouse button state",
 * };
 * ```
 */
export interface VarSpec {
  /**
   * Variable key identifier as registered in Karabiner memory or EventViewer.
   *
   * @example "right_button_pressed"
   * @example "frontmost_application.bundle_identifier"
   */
  name: string;

  /**
   * Human-readable description label used in rule documentation and logs.
   *
   * @example "Right mouse button held down"
   */
  varDesc: string;
}

// ---------------------------------------------------------
// Registry Value Specifications
// ---------------------------------------------------------

/**
 * Registry specification for Karabiner state values.
 * Used in condition checking (`ifVar`/`ifUserVar`/`ifKeVar`) and variable mutation (`setVar`).
 * 
 * **Notes on Variables:**
 * - Type matching is strict: `1 != true`, `true != "true"`.
 * - When a variable is unset, Karabiner evaluates its value as `0`, not `false` or `""`.
 * - Accessibility API variables are either strings (`accessibility.*_string`) or integers (`accessibility.*_size_*` / `accessibility.*_position_*`).
 * 
 * @example
 * ```ts
 * const rightButtonHeld: VarValueSpec = {
 *   ref: VARS.rButtonDown,
 *   value: 1,
 *   varDesc: "Right mouse button held down",
 * };
 * ```
 */

export interface VarValueSpec {
  /**
   * A reference to the {@link VarSpec} variable to compare against
   */
  ref: VarSpec;

  /**
   * Value to compare against {@link VarSpec} variable in condition blocks
   */
  value: string | number | boolean;

  /**
   * Human-readable description label used in rule documentation and logs.
   * 
   * @example "Right mouse button held down"
   */
  varDesc: string;

}