import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULTS,
  KB_DEFAULTS,
  MOUSE_DEFAULTS,
  type DeviceKey,
} from "../data";
import { getDeviceSettings, getKbSettings, getMouseSettings } from "../engine";

test("devices constants export expected defaults", () => {
  assert.deepEqual(MOUSE_DEFAULTS, {
    flip_vertical_wheel: true,
    flip_horizontal_wheel: true,
    xy_multiplier: 10.0,
    wheels_multiplier: 5.0,
  });

  assert.deepEqual(KB_DEFAULTS, {
    modify_events: true,
    use_caps_led: true,
  });

  assert.deepEqual(DEFAULTS, {
    flip_vertical_wheel: true,
    flip_horizontal_wheel: true,
    xy_multiplier: 10.0,
    wheels_multiplier: 5.0,
    modify_events: true,
    use_caps_led: true,
  });
});

test("DeviceKey type includes all DEFAULTS keys", () => {
  const keys: DeviceKey[] = [
    "flip_vertical_wheel",
    "flip_horizontal_wheel",
    "xy_multiplier",
    "wheels_multiplier",
    "modify_events",
    "use_caps_led",
  ];
  assert.equal(keys.length, Object.keys(DEFAULTS).length);
});

test("helper functions apply user-specified overrides correctly", () => {
  const mouseCustom = getMouseSettings({ xy_multiplier: 15.0 });
  assert.equal(mouseCustom.xy_multiplier, 15.0);
  assert.equal(mouseCustom.flip_vertical_wheel, true);

  const kbCustom = getKbSettings({ use_caps_led: false });
  assert.equal(kbCustom.use_caps_led, false);
  assert.equal(kbCustom.modify_events, true);

  const deviceCustom = getDeviceSettings({ xy_multiplier: 20.0, use_caps_led: false });
  assert.equal(deviceCustom.xy_multiplier, 20.0);
  assert.equal(deviceCustom.use_caps_led, false);
  assert.equal(deviceCustom.flip_vertical_wheel, true);
});
