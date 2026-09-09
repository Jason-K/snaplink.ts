export type SimpleModification = {
  from: { key_code: string };
  to: ReadonlyArray<{ key_code: string }>;
};

export type DeviceConfigSetting = {
  mouse_flip_vertical_wheel?: boolean;
  mouse_flip_horizontal_wheel?: boolean;
  pointing_motion_xy_multiplier?: number;
  pointing_motion_wheels_multiplier?: number;
  mouse_modify_events?: boolean;
  ignore_vendor_events?: boolean;
  ignore?: boolean;
  modify_events?: boolean;
  manipulate_caps_lock_led?: boolean;
};

export type DeviceConfig = {
  identifiers: {
    vendor_id: number;
    product_id: number;
    is_keyboard?: boolean;
    is_pointing_device?: boolean;
  };
  simple_modifications?: ReadonlyArray<SimpleModification>;
  settings?: DeviceConfigSetting;
};

import type { DeviceSpec } from "../../data";
import type {
  DeviceDefaults,
  DeviceOverrides,
  KbDefaults,
  KbOverrides,
  MouseDefaults,
  MouseOverrides,
} from "../../data/primitives/devices";
import { DEFAULTS, KB_DEFAULTS, MOUSE_DEFAULTS } from "../../data/constants/devices";

/**
 * Strip a `DeviceSpec` to the shape Karabiner accepts as a device identifier.
 * Prevents the `name`/`deviceDesc` metadata from leaking into Karabiner's `identifiers[]`.
 */
export function karabinerDeviceId(spec: DeviceSpec): DeviceConfig["identifiers"] {
  const id: DeviceConfig["identifiers"] = {
    product_id: spec.product_id,
    vendor_id: spec.vendor_id,
  };
  if (spec.is_keyboard) id.is_keyboard = true;
  if (spec.is_pointing_device) id.is_pointing_device = true;
  return id;
}

/**
 * Build a `DeviceConfig` from a `DeviceSpec`, extracting both identifiers and
 * any device-specific settings declared on the spec.
 */
export function buildDeviceConfig(
  spec: DeviceSpec,
  simple_modifications?: ReadonlyArray<SimpleModification>,
): DeviceConfig {
  const settings: DeviceConfigSetting = {};
  if (spec.mouse_flip_vertical_wheel !== undefined) settings.mouse_flip_vertical_wheel = spec.mouse_flip_vertical_wheel;
  if (spec.mouse_flip_horizontal_wheel !== undefined) settings.mouse_flip_horizontal_wheel = spec.mouse_flip_horizontal_wheel;
  if (spec.pointing_motion_xy_multiplier !== undefined) settings.pointing_motion_xy_multiplier = spec.pointing_motion_xy_multiplier;
  if (spec.pointing_motion_wheels_multiplier !== undefined) settings.pointing_motion_wheels_multiplier = spec.pointing_motion_wheels_multiplier;
  if (spec.mouse_modify_events !== undefined) settings.mouse_modify_events = spec.mouse_modify_events;
  if (spec.modify_events !== undefined) settings.modify_events = spec.modify_events;
  if (spec.manipulate_caps_lock_led !== undefined) settings.manipulate_caps_lock_led = spec.manipulate_caps_lock_led;
  if (spec.ignore_vendor_events !== undefined) settings.ignore_vendor_events = spec.ignore_vendor_events;
  if (spec.ignore !== undefined) settings.ignore = spec.ignore;

  const config: DeviceConfig = { identifiers: karabinerDeviceId(spec) };
  if (simple_modifications !== undefined) config.simple_modifications = simple_modifications;
  if (Object.keys(settings).length > 0) config.settings = settings;
  return config;
}

/**
 * Generate a unique key for a device identifier distinguishing pointing device vs keyboard.
 */
export function getDeviceKey(identifiers: DeviceConfig["identifiers"]): string {
  const type = identifiers.is_pointing_device
    ? "pointing"
    : identifiers.is_keyboard
      ? "keyboard"
      : "generic";
  return `${identifiers.vendor_id}_${identifiers.product_id}_${type}`;
}

/**
 * Expands a list of `DeviceConfig` entries.
 * Pointing devices automatically emit both their pointing device entry
 * and a companion keyboard entry with `ignore: true` (if one was not already explicitly provided).
 */
export function expandDeviceConfigs(configs: ReadonlyArray<DeviceConfig>): DeviceConfig[] {
  const expanded: DeviceConfig[] = [];
  for (const config of configs) {
    expanded.push(config);
    if (config.identifiers.is_pointing_device) {
      const hasKeyboardConfig = configs.some(
        (c) =>
          c.identifiers.vendor_id === config.identifiers.vendor_id &&
          c.identifiers.product_id === config.identifiers.product_id &&
          c.identifiers.is_keyboard === true,
      );
      if (!hasKeyboardConfig) {
        expanded.push({
          identifiers: {
            vendor_id: config.identifiers.vendor_id,
            product_id: config.identifiers.product_id,
            is_keyboard: true,
          },
          settings: {
            ignore: true,
          },
        });
      }
    }
  }
  return expanded;
}

/**
 * Resolves mouse settings by applying user-specified overrides onto MOUSE_DEFAULTS.
 */
export function getMouseSettings(overrides?: MouseOverrides): MouseDefaults {
  return { ...MOUSE_DEFAULTS, ...overrides };
}

/**
 * Resolves keyboard settings by applying user-specified overrides onto KB_DEFAULTS.
 */
export function getKbSettings(overrides?: KbOverrides): KbDefaults {
  return { ...KB_DEFAULTS, ...overrides };
}

/**
 * Resolves device settings by applying user-specified overrides onto DEFAULTS.
 */
export function getDeviceSettings(overrides?: DeviceOverrides): DeviceDefaults {
  return { ...DEFAULTS, ...overrides };
}
