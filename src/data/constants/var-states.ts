/** Reusable string/number state constants for Karabiner variable condition checks */

export const ACCESSIBILITY_ROLES = {
  textArea: "AXTextArea",
  textField: "AXTextField",
  secureTextField: "AXSecureTextField",
  webArea: "AXWebArea",
  button: "AXButton",
  window: "AXWindow",
} as const;

export type AccessibilityRole =
  (typeof ACCESSIBILITY_ROLES)[keyof typeof ACCESSIBILITY_ROLES];

export const INPUT_SOURCES = {
  us: "com.apple.keylayout.US",
  abc: "com.apple.keylayout.ABC",
} as const;

export type InputSourceId =
  (typeof INPUT_SOURCES)[keyof typeof INPUT_SOURCES];

export const VAR_STATE = {
  off: 0,
  on: 1,
} as const;
