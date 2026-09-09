import type { VarSpec, VarValueSpec } from "../primitives/vars";
import { PW_IDS } from "./apps";
import { VARS } from "./vars";

/** Factory to create a registry entry for a value comparison against a variable.
 *  @param ref     - reference to the VarSpec variable
 *  @param value   - value to compare in condition blocks
 *  @param varDesc - human label used in descriptions
 */
const varState = (ref: VarSpec, value: string | number | boolean, varDesc: string): VarValueSpec => ({
  ref,
  value,
  varDesc,
});

// Scoped factory helper for UI element states
const axState = (value: string, varDesc: string): VarValueSpec => varState(VARS.elementType, value, varDesc);

// ---------------------------------------------------------
// STATES Registry
// ---------------------------------------------------------

/**
 * Unified registry of variable states (variable + value specs for both built-in system values and user variable states).
 */
export const STATES = {
  // ── Built-in System UI Element States ──────────────────────────────────────

  isTextArea: axState("AXTextArea", "focused element is a text area"),
  isTextField: axState("AXTextField", "focused element is a text field"),
  isSecureInput: axState("AXSecureTextField", "focused element is a secure text field"),
  isSecureInputSubrole: varState(VARS.elementSubtype, "AXSecureTextField*", "focused element is secure input"),
  isButton: axState("AXButton", "focused element is a button"),
  isStaticText: axState("AXStaticText", "focused element is static text"),
  isWebArea: axState("AXWebArea", "focused element is a web area"),

  // ── User / Mouse States ──────────────────────────────────────────────────

  rButtonDown: varState(VARS.rButtonDown, 1, "button 2 is pressed"),
  rButtonUp: varState(VARS.rButtonDown, 0, "button 2 is not pressed"),
  wheelDown: varState(VARS.wheelDown, 1, "wheel is held down"),
  wheelUp: varState(VARS.wheelDown, 0, "wheel is not held down"),
  lButtonDown: varState(VARS.lButtonDown, 1, "left button is pressed"),
  lButtonUp: varState(VARS.lButtonDown, 0, "left button is not pressed"),
  lButtonFirstTap: varState(VARS.lButtonTapCount, 1, "left+right first tap"),
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
