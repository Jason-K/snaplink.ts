/**
 * Registry specification for physical hardware input devices (keyboards and mice).
 * Defines hardware identifiers (Vendor ID / Product ID) and per-device Karabiner settings.
 *
 * @example
 * ```ts
 * const g502X: DeviceSpec = {
 *   name: "g502X",
 *   deviceDesc: "Logitech G502 X mouse",
 *   vendor_id: 1133,
 *   product_id: 49305,
 *   is_pointing_device: true,
 * };
 * ```
 */
export interface DeviceSpec {
  /**
   * Registry metadata identifier key.
   *
   * @example "g502X"
   * @example "appleNumericKeypad"
   */
  name: string;

  /**
   * Human-readable description label.
   *
   * @example "Logitech G502 X gaming mouse"
   */
  deviceDesc: string;

  /** Optional reference description override. */
  refDesc?: string;

  // ── Hardware Identifiers ───────────────────────────────────────────────────

  /** USB Product ID number. */
  product_id: number;

  /** USB Vendor ID number. */
  vendor_id: number;

  /** Whether this device is categorized as a keyboard. */
  is_keyboard?: boolean;

  /** Whether this device is categorized as a mouse / pointing device. */
  is_pointing_device?: boolean;

  // ── Per-Device Karabiner Settings (Mouse) ──────────────────────────────────

  /** Flip vertical scroll wheel direction. */
  mouse_flip_vertical_wheel?: boolean;

  /** Flip horizontal scroll wheel direction. */
  mouse_flip_horizontal_wheel?: boolean;

  /** Pointer motion XY axis speed multiplier. */
  pointing_motion_xy_multiplier?: number;

  /** Pointer motion scroll wheels speed multiplier. */
  pointing_motion_wheels_multiplier?: number;

  /** Intercept mouse button click events. */
  mouse_modify_events?: boolean;

  // ── Per-Device Karabiner Settings (Shared) ─────────────────────────────────

  /** Enable event modification on this device. */
  modify_events?: boolean;

  /** Control caps lock LED indicator status. */
  manipulate_caps_lock_led?: boolean;

  /** Ignore vendor-defined special events. */
  ignore_vendor_events?: boolean;

  /** Ignore all input events from this device. */
  ignore?: boolean;
}

// ── Per-Device Default Settings & Overrides ─────────────────────────────────

export interface MouseDefaults {
  flip_vertical_wheel: boolean;
  flip_horizontal_wheel: boolean;
  xy_multiplier: number;
  wheels_multiplier: number;
}

export interface KbDefaults {
  modify_events: boolean;
  use_caps_led: boolean;
}

export type DeviceDefaults = MouseDefaults & KbDefaults;

export type DeviceKey = keyof DeviceDefaults;

export type MouseOverrides = Partial<MouseDefaults>;
export type KbOverrides = Partial<KbDefaults>;
export type DeviceOverrides = Partial<DeviceDefaults>;

