import assert from "node:assert/strict";
import test from "node:test";

import { analyzeConflicts } from "../engine";
import { resolveButton } from "../engine/utils/input-devices";
import type { ActionKeyModifier, Binding, TriggerKey } from "../data";

function bareHold(key: TriggerKey): Binding {
  return { trigger: { keys: [key] }, cases: [{ phase: "hold", do: [{ type: "noop" }] }] };
}

function moddedTapHold(key: TriggerKey, mod: ActionKeyModifier): Binding {
  return {
    trigger: { keys: [key], modifiers: [mod] },
    cases: [{ phase: "hold", do: [{ type: "noop" }] }],
  };
}

// Duplicate-trigger detection lives in analyze-conflicts now; see
// analyze-conflicts.test.ts for the full classification matrix.
test("conflict analysis: distinct triggers produce no errors", () => {
  const report = analyzeConflicts([
    { name: "s", bindings: [bareHold("a"), bareHold("b")] },
  ]);
  assert.deepEqual(report.errors, []);
});

test("conflict analysis: duplicate trigger is reported (order-independent mods)", () => {
  const report = analyzeConflicts([
    { name: "s", bindings: [moddedTapHold("q", "COCS"), moddedTapHold("q", "COCS")] },
  ]);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]?.kind, "duplicate");
});

test("resolveButton: alias + nameScope + raw fallback", () => {
  assert.equal(resolveButton("shift_button").button, "button5");
  assert.deepEqual(resolveButton("shift_button").nameScope, ["g502X"]);
  assert.equal(resolveButton("left").nameScope, "global");
  assert.equal(resolveButton("button99").button, "button99");
  assert.equal(resolveButton("button1").desc, "Left click");
});
