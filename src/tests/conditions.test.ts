import assert from "node:assert/strict";
import test from "node:test";

import { APPS, STATES, VARS } from "../data";
import { state, unless } from "../engine/wrappers/condition-wrappers";
import { ifVarExpr, toTrigger, toUserCommand, toVarExpr, unlessVarExpr } from "../engine/resolve-to-action";

test("toVarExpr emits documented expression fields", () => {
  assert.deepEqual(toVarExpr("mode", "mode != 0 ? 0 : 1", "0"), {
    set_variable: {
      name: "mode",
      expression: "mode != 0 ? 0 : 1",
      key_up_expression: "0",
    },
  });
});

test("expression helpers emit expression conditions", () => {
  assert.deepEqual(ifVarExpr("mode == 1"), {
    type: "expression_if",
    expression: "mode == 1",
  });
  assert.deepEqual(unlessVarExpr("mode == 0"), {
    type: "expression_unless",
    expression: "mode == 0",
  });
});

test("beta helpers serialize send_user_command and from_event", () => {
  // `endpoint` is omitted rather than set to undefined, so it never reaches
  // the emitted JSON as a key at all.
  assert.deepEqual(toUserCommand({ command: "show_layer", layer: "space" }), {
    send_user_command: {
      payload: {
        command: "show_layer",
        layer: "space",
      },
    },
  });
  assert.deepEqual(toUserCommand({ command: "hide_layer" }, "/tmp/receiver.sock"), {
    send_user_command: {
      payload: { command: "hide_layer" },
      endpoint: "/tmp/receiver.sock",
    },
  });
  assert.deepEqual(toTrigger(), { from_event: true });
});

test("state builder checks STATES registry keys, VarValueSpec, and VarSpec", () => {
  const condString = state("rButtonDown");
  assert.deepEqual(condString, {
    var: VARS.rButtonDown,
    equals: 1,
    description: "button 2 is pressed",
  });

  const condSpec = state(STATES.wheelDown);
  assert.deepEqual(condSpec, {
    var: VARS.wheelDown,
    equals: 1,
    description: "wheel is held down",
  });

  const condUnless = state("rButtonDown", false);
  assert.deepEqual(condUnless, {
    var: VARS.rButtonDown,
    equals: 1,
    unless: true,
    description: "button 2 is pressed",
  });

  const condVarSpec = state(VARS.lButtonDown, 1);
  assert.deepEqual(condVarSpec, {
    var: VARS.lButtonDown,
    equals: 1,
  });
});

test("state builder supports arrays, tuples, apps, and rest parameters", () => {
  const condsArray = state([APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0]]);
  assert.deepEqual(condsArray, [
    { app: APPS.zen },
    { var: VARS.rButtonDown, equals: 1 },
    { var: VARS.wheelDown, equals: 0 },
  ]);

  const condsRest = state(APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0]);
  assert.deepEqual(condsRest, [
    { app: APPS.zen },
    { var: VARS.rButtonDown, equals: 1 },
    { var: VARS.wheelDown, equals: 0 },
  ]);

  const condTupleSingle = state([VARS.wheelDown, 0]);
  assert.deepEqual(condTupleSingle, { var: VARS.wheelDown, equals: 0 });
});

test("unless builder enforces negation across all items", () => {
  const negatedSingle = unless(VARS.rButtonDown);
  assert.deepEqual(negatedSingle, {
    var: VARS.rButtonDown,
    equals: 1,
    unless: true,
  });

  const negatedMultiple = unless(VARS.rButtonDown, VARS.wheelDown, APPS.zen);
  assert.deepEqual(negatedMultiple, [
    { var: VARS.rButtonDown, equals: 1, unless: true },
    { var: VARS.wheelDown, equals: 1, unless: true },
    { app: APPS.zen, unless: true },
  ]);
});

test("accessibility window_title_string variable condition", () => {
  assert.equal(
    VARS.windowTitle.name,
    "accessibility.focused_ui_element.window_title_string",
  );
  assert.equal(
    VARS.winTitle.name,
    "accessibility.focused_ui_element.window_title_string",
  );

  const cond = state(VARS.windowTitle, "My Window");
  assert.deepEqual(cond, {
    var: VARS.windowTitle,
    equals: "My Window",
  });
});

