import type { DeviceSpec } from "../primitives/devices";

export const DEVICES = {
  appleNumericKeypad: {
    name: "appleNumericKeypad",
    deviceDesc: "Apple numeric keypad",
    vendor_id: 76,
    product_id: 802,
    is_keyboard: true,
  },
  g502X: {
    name: "g502X",
    deviceDesc: "Logitech G502 X",
    product_id: 49305,
    vendor_id: 1133,
    is_pointing_device: true,
    mouse_flip_vertical_wheel: true,
    pointing_motion_xy_multiplier: 10,
    pointing_motion_wheels_multiplier: 5,
    mouse_modify_events: false,
    ignore_vendor_events: true,
    ignore: false,
  },
} as const satisfies Record<string, DeviceSpec>;

export type { DeviceSpec };
