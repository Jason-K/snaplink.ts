import type { VarSpec, VarValueSpec } from "../primitives/vars";
import { PW_IDS } from "./apps";
import { VARS } from "./vars";

/** Factory to create a registry entry for a value comparison against a variable.
 *  @param ref     - reference to the VarSpec variable
 *  @param value   - value to compare in condition blocks
 *  @param varDesc - human label used in descriptions
 */
const varState = (
  ref: VarSpec,
  value: string | number | boolean,
  varDesc: string,
): VarValueSpec => ({ ref, value, varDesc });

// ---------------------------------------------------------
// STATES Registry
// ---------------------------------------------------------

/**
 * Unified registry of variable states (variable + value specs for both built-in system values and user variable states).
 */
export const STATES = {
  // ── Built-in System UI Element States ──────────────────────────────────────

  isTextArea: varState(
    VARS.elementType,
    "AXTextArea",
    "Focused element is a text area",
  ),
  isTextField: varState(
    VARS.elementType,
    "AXTextField",
    "Focused element is a text field",
  ),
  isSecureInput: varState(
    VARS.elementType,
    "AXSecureTextField",
    "Focused element is a secure text field",
  ),
  isSecureInputSubrole: varState(
    VARS.elementSubtype,
    "AXSecureTextField*",
    "Focused element is a secure text field",
  ),
  isButton: varState(
    VARS.elementType,
    "AXButton",
    "Focused element is a button",
  ),
  isStaticText: varState(
    VARS.elementType,
    "AXStaticText",
    "Focused element is static text",
  ),
  isWebArea: varState(
    VARS.elementType,
    "AXWebArea",
    "Focused element is a web area",
  ),

  // ── User / Mouse States ──────────────────────────────────────────────────

  rButtonDown: varState(VARS.rButtonDown, 1, "Button 2 is pressed"),
  rButtonUp: varState(VARS.rButtonDown, 0, "Button 2 is not pressed"),
  wheelDown: varState(VARS.wheelDown, 1, "Wheel is held down"),
  wheelUp: varState(VARS.wheelDown, 0, "Wheel is not held down"),
  lButtonDown: varState(VARS.lButtonDown, 1, "Left button is pressed"),
  lButtonUp: varState(VARS.lButtonDown, 0, "Left button is not pressed"),
  lButtonFirstTap: varState(
    VARS.lButtonTapCount,
    1,
    "Left+right first tap",
  ),
} as const satisfies Record<string, VarValueSpec>;

// ---------------------------------------------------------
// STATE GROUPS Registry
// ---------------------------------------------------------

/**
 * Reusable groups of state conditions.
 */
export const STATE_GROUPS = {
  isPasswordEdit: [PW_IDS, STATES.isTextField, STATES.isSecureInputSubrole],
  isUserEdit: [PW_IDS, STATES.isTextField, [STATES.isSecureInputSubrole, false]],
} as const;
