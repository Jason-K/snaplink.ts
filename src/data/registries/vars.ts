import type { VarSpec } from "../primitives/vars";

/** Factory to create a registry entry for a Karabiner variable specification.
 *  @param name    - variable identifier (built-in or user-assigned)
 *  @param varDesc - human label used in descriptions
 */
const varId = (name: string, varDesc: string): VarSpec => ({ name, varDesc });

// Scoped factory helpers for concise single-line variable definitions
const axVar = (sub: string, desc: string): VarSpec =>
  varId(`accessibility.focused_ui_element.${sub}`, desc);

const appVar = (sub: string, desc: string): VarSpec =>
  varId(`frontmost_application.${sub}`, desc);

const inputVar = (sub: string, desc: string): VarSpec =>
  varId(`input_source.${sub}`, desc);

const sysVar = (sub: string, desc: string): VarSpec =>
  varId(`system.${sub}`, desc);

const vhidVar = (sub: string, desc: string): VarSpec =>
  varId(`virtual_hid_devices_state.${sub}`, desc);

// ---------------------------------------------------------
// VARS Registry
// ---------------------------------------------------------

/**
 * Unified registry of Karabiner variables (both built-in system variables and user-assigned signaling variables).
 */
export const VARS = {
  // ── Built-in System Variables ─────────────────────────────────────────────

  // accessibility.focused_ui_element.*
  /** Role of the focused UI element (e.g. "AXTextArea", "AXTextField"). */
  elementType: axVar("role_string", "UI element role is"),
  /** Subrole of the focused UI element (e.g. "AXSecureTextField"). */
  elementSubtype: axVar("subrole_string", "UI element subrole is"),
  /** Title / label of the focused UI element. */
  elementTitle: axVar("title_string", "UI element title is"),
  /** X position of the focused element's window. */
  winPosX: axVar("window_position_x", "Window X position"),
  /** Y position of the focused element's window. */
  winPosY: axVar("window_position_y", "Window Y position"),
  /** Height of the focused element's window. */
  winHeight: axVar("window_size_height", "Window height"),
  /** Width of the focused element's window. */
  winWidth: axVar("window_size_width", "Window width"),

  // ── Frontmost application ──────────────────────────────────────────────────

  /** Bundle identifier of the frontmost application. */
  foremostAppID: appVar("bundle_identifier", "Frontmost app bundle ID"),
  /** Bundle path of the frontmost application. */
  foremostAppPath: appVar("bundle_path", "Frontmost app bundle path"),
  /** Detection source used to identify the frontmost application. */
  foremostAppDetectionSource: appVar("detection_source", "Frontmost app detection source"),
  /** Executable file path of the frontmost application. */
  foremostAppFilePath: appVar("file_path", "Frontmost app file path"),
  /** Process ID (PID) of the frontmost application. */
  foremostAppPID: appVar("pid", "Frontmost app PID"),

  // ── Input source ──────────────────────────────────────────────────────────

  /** Input source identifier (e.g. "com.apple.keylayout.US"). */
  inputSource: inputVar("input_source_id", "Input source ID"),
  /** BCP-47 language tag of the active input source (e.g. "en"). */
  inputLanguage: inputVar("language", "Input source language"),

  // ── System ────────────────────────────────────────────────────────────────

  /** Current time in milliseconds since the Unix epoch. */
  systemTime: sysVar("now.milliseconds", "System time (ms)"),
  /** Whether natural (macOS) scroll direction is active. */
  naturalScroll: sysVar("scroll_direction_is_natural", "Natural scroll direction"),
  /** Whether all devices are temporarily ignored by Karabiner. */
  tempIgnoreDevices: sysVar("temporarily_ignore_all_devices", "Temporarily ignore all devices"),
  /** Whether the F-keys are configured as standard function keys. */
  fnKeysForFunctions: sysVar("use_fkeys_as_standard_function_keys", "F-keys as function keys"),

  // ── Virtual HID device state ───────────────────────────────────────────────

  /** Whether the virtual HID keyboard is ready. */
  vhidKeyboardReady: vhidVar("virtual_hid_keyboard_ready", "Virtual HID keyboard ready"),
  /** Whether the virtual HID pointing device is ready. */
  vhidPointingReady: vhidVar("virtual_hid_pointing_ready", "Virtual HID pointing ready"),

  // ── User-Assigned / Signal Variables ───────────────────────────────────────

  /** Right mouse button held down state variable. */
  rButtonDown: varId("right_button_pressed", "Right button held"),
  /** Scroll wheel held down state variable. */
  wheelDown: varId("wheel_down", "Wheel held down"),
  /** Left mouse button held down state variable. */
  lButtonDown: varId("left_button_pressed", "Left button held"),
  /** Left+right mouse chord tap count state variable. */
  lButtonTapCount: varId("left_with_right_first_tap", "Left+right first tap"),
} as const satisfies Record<string, VarSpec>;

export type { VarSpec };
