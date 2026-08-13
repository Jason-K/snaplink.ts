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

import { DEVICES } from "../data";
import type { PointerTweak } from "../data";
import { condDeviceExists, emitPointerTweaks, mouseMove, mouseScroll, resolveActionToEvents } from "../engine";
import type { MouseBasicManipulator, MouseMotionToScrollManipulator } from "../types/karabiner";

const onMouse = condDeviceExists(DEVICES.g502X);

function manipulatorOf(tweak: PointerTweak) {
  const [r] = emitPointerTweaks([tweak]);
  assert.ok(r, "expected one rule");
  return r.manipulators[0]!;
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

test("motion-to-scroll scoped by modifiers compiles", () => {
  const m = manipulatorOf({
    kind: "motionToScroll",
    description: "hold fn to scroll by moving",
    modifiers: { mandatory: ["fn"] },
    speedMultiplier: 2,
  }) as MouseMotionToScrollManipulator;
  assert.equal(m.type, "mouse_motion_to_scroll");
  assert.deepEqual(m.from?.modifiers?.mandatory, ["fn"]);
  assert.deepEqual(m.options, { speed_multiplier: 2 });
});

test("motion-to-scroll scoped by condition alone compiles", () => {
  const m = manipulatorOf({
    kind: "motionToScroll",
    description: "scroll-by-motion on the mouse only",
    conditions: [onMouse],
  }) as MouseMotionToScrollManipulator;
  assert.equal(m.conditions?.length, 1);
  assert.equal("from" in m, false);
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
    /requires modifiers or conditions/,
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
