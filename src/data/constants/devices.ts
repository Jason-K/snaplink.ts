/**
 * Default Karabiner settings for mice (pointing devices).
 */
export const MOUSE_DEFAULTS = {
  flip_vertical_wheel: true,
  flip_horizontal_wheel: true,
  xy_multiplier: 10.0,
  wheels_multiplier: 5.0,
} as const;

/**
 * Default Karabiner settings for keyboards.
 */
export const KB_DEFAULTS = {
  modify_events: true,
  use_caps_led: true,
} as const;

/**
 * Combined default settings across device types.
 */
export const DEFAULTS = {
  ...MOUSE_DEFAULTS,
  ...KB_DEFAULTS,
} as const;
