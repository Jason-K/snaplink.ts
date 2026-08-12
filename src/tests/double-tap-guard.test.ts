import assert from "node:assert/strict";
import test from "node:test";

import { antinoteGuardBinding, globalGuardBinding, guardBindings } from "../definitions/guards";
import { defineBindings } from "../engine";

function toRule(input: any): any {
  return typeof input?.build === "function" ? input.build() : input;
}

test("guardBindings produces rules with two manipulators per double-tap guard", () => {
  const rules = defineBindings(guardBindings).map(toRule);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].manipulators.length, 2);
  assert.equal(rules[1].manipulators.length, 2);
});

test("globalGuardBinding uses the guard_cmd_q variable and fires the combo on the second press", () => {
  const [rule] = defineBindings([globalGuardBinding]).map(toRule);
  const [secondPress, firstPress]: any[] = rule.manipulators;
  // var name derived from trigger q + left_command
  assert.deepEqual(secondPress.conditions[0], { type: "variable_if", name: "guard_cmd_q", value: 1 });
  // second press fires the real combo in `to` (not to_if_alone), then resets
  assert.equal(secondPress.to[0].key_code, "q");
  assert.deepEqual(secondPress.to[0].modifiers, ["left_command"]);
  assert.equal(secondPress.to[1].set_variable.name, "guard_cmd_q");
  assert.equal(secondPress.to[1].set_variable.value, 0);
  // first press arms the var, delayed-action disarms
  const firstPressCond = firstPress.conditions[0];
  assert.deepEqual(firstPressCond, { type: "variable_if", name: "guard_cmd_q", value: 0 });
  assert.equal(firstPress.to[0].set_variable.name, "guard_cmd_q");
  assert.equal(firstPress.to[0].set_variable.value, 1);
  assert.equal(firstPress.to_delayed_action.to_if_invoked[0].set_variable.value, 0);
  assert.equal(firstPress.to_delayed_action.to_if_canceled[0].set_variable.value, 0);
});

test("globalGuardBinding uses mandatory left_command from-modifiers", () => {
  const [rule] = defineBindings([globalGuardBinding]).map(toRule);
  for (const m of rule.manipulators) {
    assert.deepEqual(m.from.modifiers, { mandatory: ["left_command"] });
  }
});

test("antinoteGuardBinding adds frontmost application condition to BOTH manipulators", () => {
  const [rule] = defineBindings([antinoteGuardBinding]).map(toRule);
  assert.ok(
    rule.manipulators.every(
      (m: any) =>
        m.conditions?.some((c: any) => c.type === "frontmost_application_if"),
    ),
    "Both manipulators should have app condition",
  );
});

test("globalGuardBinding has no app condition when omitted", () => {
  const [rule] = defineBindings([globalGuardBinding]).map(toRule);
  assert.ok(
    rule.manipulators.every(
      (m: any) =>
        !m.conditions?.some((c: any) => c.type === "frontmost_application_if"),
    ),
    "No app condition expected for global rule",
  );
});
