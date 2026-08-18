/**
 * The two non-`basic` manipulator types.
 *
 * Both can render a machine undriveable if mis-scoped, so the scoping rules are
 * enforced in the types *and* at build time. These tests cover the runtime half
 * — the type half is exercised by the fact that the rejected shapes below need
 * a cast to construct at all.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { APPS, DEVICES, VARS } from "../data";
import type { PointerTweak } from "../data";
import {
  condDeviceExists,
  emitPointerTweaks,
  motionToScroll,
  mouseMove,
  mouseScroll,
  pointerTransform,
  resolveActionToEvents,
  when,
} from "../engine";
import type { BasicManipulator, MouseBasicManipulator, MouseMotionToScrollManipulator } from "../types/karabiner";

const onMouse = condDeviceExists(DEVICES.g502X);

function manipulatorsOf(tweak: PointerTweak) {
  const [r] = emitPointerTweaks([tweak]);
  assert.ok(r, "expected one rule");
  return r.manipulators;
}

function manipulatorOf(tweak: PointerTweak) {
  return manipulatorsOf(tweak)[0]!;
}

// ── mouse_key (Shape A) ────────────────────────────────────────────────────

test("mouseMove maps directions to Karabiner's axis signs", () => {
  assert.deepEqual(resolveActionToEvents(mouseMove({ right: 1536 })), [{ mouse_key: { x: 1536 } }]);
  assert.deepEqual(resolveActionToEvents(mouseMove({ left: 1536 })), [{ mouse_key: { x: -1536 } }]);
  // y is positive downward.
  assert.deepEqual(resolveActionToEvents(mouseMove({ down: 10 })), [{ mouse_key: { y: 10 } }]);
  assert.deepEqual(resolveActionToEvents(mouseMove({ up: 10 })), [{ mouse_key: { y: -10 } }]);
});

test("mouseScroll inverts the horizontal axis, which is the trap it exists for", () => {
  // vertical_wheel > 0 scrolls down...
  assert.deepEqual(resolveActionToEvents(mouseScroll({ down: 64 })), [
    { mouse_key: { vertical_wheel: 64 } },
  ]);
  // ...but horizontal_wheel > 0 scrolls LEFT (gotcha 6.10).
  assert.deepEqual(resolveActionToEvents(mouseScroll({ left: 32 })), [
    { mouse_key: { horizontal_wheel: 32 } },
  ]);
  assert.deepEqual(resolveActionToEvents(mouseScroll({ right: 32 })), [
    { mouse_key: { horizontal_wheel: -32 } },
  ]);
});

test("opposite directions cancel rather than emitting a zero axis", () => {
  assert.throws(() => mouseMove({ left: 10, right: 10 }), /at least one direction/);
});

// ── mouse_basic (Shape C) ──────────────────────────────────────────────────

test("a flip needs no condition — the pointer still moves", () => {
  const m = manipulatorOf({
    kind: "transform",
    description: "invert vertical scroll",
    flip: ["vertical_wheel"],
  }) as MouseBasicManipulator;
  assert.equal(m.type, "mouse_basic");
  assert.deepEqual(m.flip, ["vertical_wheel"]);
  assert.equal("conditions" in m, false);
});

test("a scoped discard compiles", () => {
  const m = manipulatorOf({
    kind: "transform",
    description: "drop horizontal wheel on the mouse",
    discard: ["horizontal_wheel"],
    conditions: [onMouse],
  }) as MouseBasicManipulator;
  assert.deepEqual(m.discard, ["horizontal_wheel"]);
  assert.equal(m.conditions?.[0]?.type, "device_exists_if");
});

test("an UNSCOPED discard is refused at build time", () => {
  assert.throws(
    () =>
      emitPointerTweaks([
        {
          kind: "transform",
          description: "drop every axis",
          discard: ["x", "y"],
        } as unknown as PointerTweak,
      ]),
    /discard requires at least one condition/,
  );
});

test("a transform that changes nothing is refused", () => {
  assert.throws(
    () => emitPointerTweaks([{ kind: "transform", description: "no-op" } as PointerTweak]),
    /names no flip, swap or discard/,
  );
});

// ── mouse_motion_to_scroll (Shape C) ───────────────────────────────────────

test("motion-to-scroll scoped by modifiers compiles with optional any", () => {
  const m = manipulatorOf({
    kind: "motionToScroll",
    description: "hold fn to scroll by moving",
    modifiers: { mandatory: ["fn"] },
    speedMultiplier: 2,
  }) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.deepEqual(m.from?.modifiers?.mandatory, ["fn"]);
  assert.deepEqual(m.from?.modifiers?.optional, ["any"]);
  assert.deepEqual(m.options, { speed_multiplier: 2 });
});

test("motion-to-scroll with pure modifier trigger compiles", () => {
  const m = manipulatorOf({
    kind: "motionToScroll",
    description: "hold fn to scroll",
    trigger: "fn",
  }) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.deepEqual(m.from?.modifiers?.mandatory, ["fn"]);
  assert.deepEqual(m.from?.modifiers?.optional, ["any"]);
});

test("motion-to-scroll scoped by condition alone compiles with optional any", () => {
  const m = manipulatorOf({
    kind: "motionToScroll",
    description: "scroll-by-motion on the mouse only",
    conditions: [onMouse],
  }) as MouseMotionToScrollManipulator;
  assert.equal(m.conditions?.length, 1);
  assert.deepEqual(m.from?.modifiers?.optional, ["any"]);
});

test("motion-to-scroll triggered by a pointer button compiles to two manipulators", () => {
  const ms = manipulatorsOf({
    kind: "motionToScroll",
    description: "hold button4 to scroll",
    trigger: "button4",
  });
  assert.equal(ms.length, 2);

  const [triggerM, scrollM] = ms as [BasicManipulator, MouseMotionToScrollManipulator];
  assert.equal(triggerM.type, "basic");
  assert.equal(triggerM.from.pointing_button, "button4");
  assert.deepEqual(triggerM.from.modifiers?.optional, ["any"]);
  assert.deepEqual(triggerM.to?.[0]?.set_variable, {
    name: "enable_mouse_motion_to_scroll_hold_button4_to_scroll",
    value: 1,
    key_up_value: 0,
  });

  assert.equal(scrollM.type, "mouse_motion_to_scroll");
  assert.deepEqual(scrollM.from?.modifiers?.optional, ["any"]);
  assert.deepEqual(scrollM.conditions, [
    {
      type: "variable_if",
      name: "enable_mouse_motion_to_scroll_hold_button4_to_scroll",
      value: 1,
    },
  ]);
});

test("motion-to-scroll triggered by a key chord compiles to simultaneous basic manipulator", () => {
  const ms = manipulatorsOf({
    kind: "motionToScroll",
    description: "hold d+f to scroll",
    trigger: ["d", "f"],
  });
  assert.equal(ms.length, 2);

  const [triggerM, scrollM] = ms as [BasicManipulator, MouseMotionToScrollManipulator];
  assert.equal(triggerM.type, "basic");
  assert.deepEqual(triggerM.from.simultaneous, [{ key_code: "d" }, { key_code: "f" }]);
  assert.equal(scrollM.type, "mouse_motion_to_scroll");
  assert.deepEqual(scrollM.from?.modifiers?.optional, ["any"]);
});

test("motion-to-scroll with device-scoped button alias attaches device condition to trigger", () => {
  const ms = manipulatorsOf({
    kind: "motionToScroll",
    description: "hold shift button to scroll",
    trigger: "shift_button",
  });
  assert.equal(ms.length, 2);

  const [triggerM, scrollM] = ms as [BasicManipulator, MouseMotionToScrollManipulator];
  assert.equal(triggerM.type, "basic");
  assert.equal(triggerM.from.pointing_button, "button5");
  assert.ok(triggerM.conditions?.some((c) => c.type === "device_if"));
  assert.equal(scrollM.type, "mouse_motion_to_scroll");
});

test("motion-to-scroll respects custom variable name", () => {
  const ms = manipulatorsOf({
    kind: "motionToScroll",
    description: "hold button4 with custom var",
    trigger: "button4",
    variable: "my_scroll_active",
  });
  assert.equal(ms.length, 2);

  const [triggerM, scrollM] = ms as [BasicManipulator, MouseMotionToScrollManipulator];
  assert.equal(triggerM.to?.[0]?.set_variable?.name, "my_scroll_active");
  assert.equal((scrollM.conditions?.[0] as any)?.name, "my_scroll_active");
});

test("an UNSCOPED motion-to-scroll is refused at build time", () => {
  assert.throws(
    () =>
      emitPointerTweaks([
        {
          kind: "motionToScroll",
          description: "everything scrolls, forever",
        } as unknown as PointerTweak,
      ]),
    /requires a trigger, modifiers, or conditions/,
  );
});

test("each tweak becomes its own rule, so it can be toggled in Settings", () => {
  const rules = emitPointerTweaks([
    { kind: "transform", description: "a", flip: ["x"] },
    { kind: "transform", description: "b", flip: ["y"] },
  ]);
  assert.equal(rules.length, 2);
  assert.deepEqual(rules.map((r) => r.description), ["a", "b"]);
});

// ── DSL Wrapper Helpers ───────────────────────────────────────────────────

test("motionToScroll wrapper with object and when: VARS.rButtonDown compiles", () => {
  const tweak = motionToScroll({
    description: "Hold right click to scroll",
    when: VARS.rButtonDown,
    speedMultiplier: 1.5,
  });
  const m = manipulatorOf(tweak) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.deepEqual(m.from?.modifiers?.optional, ["any"]);
  assert.deepEqual(m.conditions, [{ type: "variable_if", name: "right_button_pressed", value: 1 }]);
  assert.deepEqual(m.options, { speed_multiplier: 1.5 });
});

test("motionToScroll variadic syntax with VARS.rButtonDown compiles", () => {
  const tweak = motionToScroll("Hold right click to scroll", VARS.rButtonDown);
  const m = manipulatorOf(tweak) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.deepEqual(m.conditions, [{ type: "variable_if", name: "right_button_pressed", value: 1 }]);
});

test("motionToScroll variadic syntax with when(VARS.rButtonDown, APPS.zen) and options", () => {
  const tweak = motionToScroll(
    "Hold right click in Zen to scroll",
    when(VARS.rButtonDown, APPS.zen),
    { speedMultiplier: 2.0 },
  );
  const m = manipulatorOf(tweak) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.equal(m.conditions?.length, 2);
  assert.deepEqual(m.options, { speed_multiplier: 2.0 });
});

test("pointerTransform wrapper compiles", () => {
  const tweak = pointerTransform({
    description: "Invert vertical scroll",
    flip: ["vertical_wheel"],
  });
  const m = manipulatorOf(tweak) as MouseBasicManipulator;
  assert.equal(m.type, "mouse_basic");
  assert.deepEqual(m.flip, ["vertical_wheel"]);
});


