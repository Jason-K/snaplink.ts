import assert from "node:assert/strict";
import test from "node:test";
import { DEVICES } from "../data";
import {
  buildDeviceConfig,
  expandDeviceConfigs,
  getDeviceKey,
  karabinerDeviceId,
} from "../engine/resolve-trigger/device-config";

test("karabinerDeviceId extracts vendor, product, and device type flags", () => {
  const keyboardId = karabinerDeviceId(DEVICES.appleNumericKeypad);
  assert.deepEqual(keyboardId, {
    vendor_id: 76,
    product_id: 802,
    is_keyboard: true,
  });

  const pointingId = karabinerDeviceId(DEVICES.g502X);
  assert.deepEqual(pointingId, {
    vendor_id: 1133,
    product_id: 49305,
    is_pointing_device: true,
  });
});

test("getDeviceKey produces unique keys distinguishing pointing devices from keyboards", () => {
  const keyboardKey = getDeviceKey({
    vendor_id: 1133,
    product_id: 49305,
    is_keyboard: true,
  });
  const pointingKey = getDeviceKey({
    vendor_id: 1133,
    product_id: 49305,
    is_pointing_device: true,
  });
  const genericKey = getDeviceKey({
    vendor_id: 1133,
    product_id: 49305,
  });

  assert.equal(keyboardKey, "1133_49305_keyboard");
  assert.equal(pointingKey, "1133_49305_pointing");
  assert.equal(genericKey, "1133_49305_generic");
  assert.notEqual(keyboardKey, pointingKey);
});

test("expandDeviceConfigs automatically generates keyboard ignore block for pointing devices", () => {
  const g502xConfig = buildDeviceConfig(DEVICES.g502X);
  const expanded = expandDeviceConfigs([g502xConfig]);

  assert.equal(expanded.length, 2);

  // Original pointing device config
  assert.deepEqual(expanded[0]!.identifiers, {
    vendor_id: 1133,
    product_id: 49305,
    is_pointing_device: true,
  });
  assert.equal(expanded[0]!.settings?.mouse_flip_vertical_wheel, true);

  // Automatically generated keyboard companion config with ignore: true
  assert.deepEqual(expanded[1]!.identifiers, {
    vendor_id: 1133,
    product_id: 49305,
    is_keyboard: true,
  });
  assert.deepEqual(expanded[1]!.settings, { ignore: true });
});

test("expandDeviceConfigs does not duplicate keyboard config if explicitly provided", () => {
  const g502xPointing = buildDeviceConfig(DEVICES.g502X);
  const g502xCustomKeyboard = {
    identifiers: {
      vendor_id: 1133,
      product_id: 49305,
      is_keyboard: true,
    },
    settings: {
      ignore: true,
      modify_events: false,
    },
  };

  const expanded = expandDeviceConfigs([g502xPointing, g502xCustomKeyboard]);
  assert.equal(expanded.length, 2);
  assert.deepEqual(expanded[1], g502xCustomKeyboard);
});
