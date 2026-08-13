/**
 * `to.from_event` and `to_if_other_key_pressed`.
 *
 * The `to_if_other_key_pressed` cases were written against an API that did not
 * exist and sat skipped; the channel was wired on 2026-08-13 and they now run
 * against `BasicManipulatorBuilder.toIfOtherKeyPressed()`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { map, toSetVar } from "../engine/karabiner-helpers";
import { ifVarExpr, toTrigger } from "../engine/resolve-to-action";
import type { BasicManipulator } from "../types/karabiner";
import { buildManipulators } from "../engine";

/** The single manipulator a builder produced, narrowed for assertions. */
function only(manipulators: BasicManipulator[]): BasicManipulator {
  assert.equal(manipulators.length, 1, "expected exactly one manipulator");
  return manipulators[0]!;
}

test("to.from_event: pass-through for conditional remap", () => {
  const manipulator = only(map("left_option").to([toTrigger()]).build());

  assert(manipulator.to, "manipulator should have 'to' events");
  assert.deepEqual(
    manipulator.to,
    [{ from_event: true }],
    "should emit from_event pass-through",
  );
});

test("to_if_other_key_pressed: option-tab remap (cmd-tab alternative)", () => {
  /**
   * Use case: Option-tab should behave like cmd-tab for app switching
   * This is a classic modifier remap pattern.
   *
   * Behavior:
   * - option alone → option
   * - option + tab → command + tab (for app switcher)
   * - option + other keys → option + other keys (pass-through)
   */
  const manipulator = only(map("left_option")
    .to("left_option") // Normal pass-through
    .toIfOtherKeyPressed(
      { key_code: "tab" },
      { key_code: "left_command", modifiers: ["left_option"] },
    )
    .build());

  assert(
    manipulator.to?.[0] &&
    typeof manipulator.to[0] === "object" &&
    "key_code" in manipulator.to[0],
    "base case: should have key_code",
  );
  assert(
    manipulator.to_if_other_key_pressed,
    "should have conditional handler",
  );
  assert.deepEqual(
    manipulator.to_if_other_key_pressed?.[0]?.other_keys,
    [{ key_code: "tab" }],
    "trigger: tab",
  );
  assert(manipulator.to_if_other_key_pressed?.[0]?.to, "should have to events");
});

test("to_if_other_key_pressed: multiple chords (option key with different targets)", () => {
  /**
   * Use case: Same base key can have different re-maps for different other-key combinations.
   *
   * Example: Option key behavior varies:
   * - option alone → option
   * - option + tab → cmd + tab (app switcher)
   * - option + grave → cmd + grave (last app)
   * - option + up → Page Up
   */
  const manipulator = only(map("left_option")
    .to("left_option")
    .toIfOtherKeyPressed({ key_code: "tab" }, { key_code: "left_command" })
    .toIfOtherKeyPressed(
      { key_code: "grave_accent_and_tilde" },
      { key_code: "left_command" },
    )
    .toIfOtherKeyPressed({ key_code: "up_arrow" }, { key_code: "page_up" })
    .build());

  assert.equal(
    manipulator.to_if_other_key_pressed?.length,
    3,
    "should have 3 to_if_other_key_pressed blocks",
  );
});

test("to_if_other_key_pressed with optional modifiers in trigger", () => {
  /**
   * Use case: Remap only when other key is pressed with specific optional modifiers.
   *
   * Example: Option + (Tab with optional shift/cmd) → Cmd + Tab
   * (App switcher works with or without shift for reverse)
   */
  const manipulator = only(map("left_option")
    .to("left_option")
    .toIfOtherKeyPressed(
      {
        key_code: "tab",
        modifiers: { optional: ["left_shift", "left_command"] },
      },
      { key_code: "left_command" },
    )
    .build());

  const trigger = manipulator.to_if_other_key_pressed?.[0]?.other_keys?.[0];
  assert.deepEqual(
    trigger?.modifiers,
    { optional: ["left_shift", "left_command"] },
    "should preserve optional modifiers",
  );
});

test("from_event in event sequence (emit original + side effect)", () => {
  /**
   * Use case: Emit the original key AND perform a side effect like setting a variable.
   *
   * Example: When pressing escape, emit escape unchanged AND mark that it was pressed.
   * (Enables detection of escape key activity for UI purposes)
   */
  const manipulator = only(map("escape")
    .to([toTrigger(), toSetVar("escape_pressed", 1)])
    .build());

  assert.deepEqual(manipulator.to?.[0], { from_event: true }, "first event: from_event");
  assert.equal(manipulator.to?.length, 2, "should have 2 events in sequence");
});

test("to_if_other_key_pressed should not override base to events", () => {
  /**
   * Correctness check: to_if_other_key_pressed is additive, not a replacement.
   *
   * Behavior matrix:
   * - When condition NOT met: execute base .to() events
   * - When condition IS met: execute to_if_other_key_pressed events instead
   *
   * Both should coexist in the generated rule.
   */
  const manipulator = only(map("left_option")
    .to({ key_code: "left_option" })
    .toIfOtherKeyPressed({ key_code: "tab" }, { key_code: "left_command" })
    .build());

  assert(manipulator.to, "should preserve base to events");
  assert(
    manipulator.to_if_other_key_pressed,
    "should also add to_if_other_key_pressed",
  );
  // Karabiner behavior: when tab is pressed, use to_if_other_key_pressed; otherwise, use to
});

test("to_if_other_key_pressed stacks with other conditionals", () => {
  /**
   * Verify that to_if_other_key_pressed works alongside
   * other event handlers (.toIfAlone, .toIfHeldDown, etc).
   */
  const manipulator = only(map("left_option")
    .toIfAlone("left_option")
    .toIfHeldDown("left_option")
    .toIfOtherKeyPressed({ key_code: "tab" }, { key_code: "left_command" })
    .build());

  assert(manipulator.to_if_alone, "should preserve to_if_alone");
  assert(manipulator.to_if_held_down, "should preserve to_if_held_down");
  assert(
    manipulator.to_if_other_key_pressed,
    "should add to_if_other_key_pressed",
  );
});

test("correctness: from_event with expression conditions", () => {
  /**
   * Verify that from_event works correctly when combined with
   * expression conditions (another Phase 1 beta feature).
   *
   * This ensures beta features compose well together.
   */
  const manipulator = only(map("left_option")
    .condition(ifVarExpr("layer_active == 1"))
    .to([toTrigger()])
    .build());

  assert(manipulator.conditions, "should preserve expression condition");
  assert.deepEqual(manipulator.to?.[0], { from_event: true }, "from_event should work with expression conditions");
});

// ── the Binding-level surface ───────────────────────────────────────────────

test("Binding.otherKeyPressed reaches the emitted manipulator", () => {
  const [m] = buildManipulators({
    description: "option acts as command for tab",
    trigger: { keys: ["left_option"] },
    cases: [{ phase: "press", do: [{ type: "key", key: "left_option" }] }],
    otherKeyPressed: [
      {
        otherKeys: { key_code: "tab", modifiers: { optional: ["left_shift"] } },
        do: [{ type: "key", key: "left_command" }],
      },
    ],
  }) as BasicManipulator[];

  assert.equal(m?.to_if_other_key_pressed?.length, 1);
  assert.deepEqual(m?.to_if_other_key_pressed?.[0]?.other_keys, [
    { key_code: "tab", modifiers: { optional: ["left_shift"] } },
  ]);
  assert.equal(m?.to_if_other_key_pressed?.[0]?.to?.[0]?.key_code, "left_command");
});

test("several entries stack onto one manipulator", () => {
  const [m] = buildManipulators({
    description: "option chords",
    trigger: { keys: ["left_option"] },
    cases: [{ phase: "press", do: [{ type: "key", key: "left_option" }] }],
    otherKeyPressed: [
      { otherKeys: { key_code: "tab" }, do: [{ type: "key", key: "left_command" }] },
      { otherKeys: { key_code: "up_arrow" }, do: [{ type: "key", key: "page_up" }] },
    ],
  }) as BasicManipulator[];
  assert.equal(m?.to_if_other_key_pressed?.length, 2);
});

test("otherKeyPressed is rejected where its interaction is unvalidated", () => {
  assert.throws(
    () =>
      buildManipulators({
        description: "double tap plus chord",
        trigger: { keys: ["left_option"] },
        cases: [{ tapCount: 2, phase: "release", do: [{ type: "key", key: "a" }] }],
        otherKeyPressed: [
          { otherKeys: { key_code: "tab" }, do: [{ type: "key", key: "b" }] },
        ],
      }),
    /not supported on a multi-tap binding/,
  );
});

test("an entry that emits nothing fails the build", () => {
  assert.throws(
    () =>
      buildManipulators({
        description: "empty chord",
        trigger: { keys: ["left_option"] },
        cases: [{ phase: "press", do: [{ type: "key", key: "left_option" }] }],
        otherKeyPressed: [{ otherKeys: { key_code: "tab" }, do: [] }],
      }),
    /emits nothing/,
  );
});
