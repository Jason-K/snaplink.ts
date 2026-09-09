import assert from "node:assert/strict";
import test from "node:test";
import { singleKeyTapHoldBindings } from "../definitions/complex-modifications";
import { defineBindings } from "../engine";

const RAYCAST_CLIPBOARD_HISTORY_URL = "raycast-x://extensions/raycast/clipboard-history/clipboard-history";
const DOUBLE_TAP_THRESHOLD_MS = 300;

function toRule(input: any): any {
  return typeof input?.build === "function" ? input.build() : input;
}

function builtRules(): any[] {
  const leftShift = singleKeyTapHoldBindings.find((b) => "keys" in b.trigger && b.trigger.keys.includes("left_shift"));
  const rightShift = singleKeyTapHoldBindings.find(
    (b) => "keys" in b.trigger && b.trigger.keys.includes("right_shift"),
  );
  return defineBindings([leftShift!, rightShift!]).map(toRule);
}

function manipulators(rule: any): any[] {
  return rule.manipulators;
}

// The second-tap manipulator carries an `expression_if` condition checking `== 1`.
function secondTapManip(rule: any): any {
  return manipulators(rule).find((m: any) => m.conditions?.some((c: any) => c.type === "variable_if" && c.value === 1));
}

// The first-tap (pass-through) manipulator has no expression_if condition checking `== 1`.
function firstTapManip(rule: any): any {
  return manipulators(rule).find(
    (m: any) => !m.conditions?.some((c: any) => c.type === "variable_if" && c.value === 1),
  );
}

function toIfAlone(manip: any): any[] {
  return manip.to_if_alone ?? [];
}

function shellCommands(manip: any): string[] {
  return toIfAlone(manip)
    .filter((e: any) => typeof e.shell_command === "string")
    .map((e: any) => e.shell_command);
}

function aloneKeyCodes(manip: any): string[] {
  return toIfAlone(manip)
    .filter((e: any) => typeof e.key_code === "string")
    .map((e: any) => e.key_code);
}

test("buildShiftRules returns one rule per shift key", () => {
  assert.equal(builtRules().length, 2);
});

test("each shift rule has a second-tap and a first-tap manipulator", () => {
  for (const rule of builtRules()) {
    assert.equal(manipulators(rule).length, 2);
    assert.ok(secondTapManip(rule), "expected a second-tap manipulator");
    assert.ok(firstTapManip(rule), "expected a first-tap pass-through manipulator");
  }
});

test("left shift rule description includes the Raycast clipboard-history action", () => {
  assert.match(builtRules()[0].description, /On Double Tap:/);
  assert.match(builtRules()[0].description, /clipboard manager/);
});

test("right shift rule description includes the Raycast clipboard-history action", () => {
  assert.match(builtRules()[1].description, /On Double Tap:/);
  assert.match(builtRules()[1].description, /clipboard manager/);
});

test("double-tap of either shift key runs the Raycast clipboard-history command", () => {
  for (const rule of builtRules()) {
    const cmds = shellCommands(secondTapManip(rule));
    assert.ok(
      cmds.some((c) => c === `open -u '${RAYCAST_CLIPBOARD_HISTORY_URL}'`),
      `expected Raycast shell command, got ${JSON.stringify(cmds)}`,
    );
  }
});

test("single-tap of either shift key passes the key through (normal Shift preserved)", () => {
  const [left, right] = builtRules();
  assert.ok(aloneKeyCodes(firstTapManip(left)).includes("left_shift"));
  assert.ok(aloneKeyCodes(firstTapManip(right)).includes("right_shift"));
});

test("left and right shift use distinct multi-tap state variables", () => {
  const [left, right] = builtRules();
  const leftVar = secondTapManip(left).conditions.find((c: any) => c.type === "variable_if").name;
  const rightVar = secondTapManip(right).conditions.find((c: any) => c.type === "variable_if").name;
  assert.equal(leftVar, "multi_tap_left_shift");
  assert.equal(rightVar, "multi_tap_right_shift");
  assert.notEqual(leftVar, rightVar);
});

test("double-tap threshold is 300 ms", () => {
  for (const rule of builtRules()) {
    assert.equal(
      secondTapManip(rule).parameters["basic.to_if_held_down_threshold_milliseconds"],
      DOUBLE_TAP_THRESHOLD_MS,
    );
  }
});

test("holding shift past threshold maintains key_code in to_if_held_down", () => {
  const [left, right] = builtRules();
  const leftHeld = firstTapManip(left).to_if_held_down.find((e: any) => typeof e.key_code === "string");
  const rightHeld = firstTapManip(right).to_if_held_down.find((e: any) => typeof e.key_code === "string");
  assert.equal(leftHeld?.key_code, "left_shift");
  assert.equal(leftHeld?.repeat, undefined);
  assert.equal(rightHeld?.key_code, "right_shift");
  assert.equal(rightHeld?.repeat, undefined);
});
