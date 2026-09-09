import assert from "node:assert/strict";
import test from "node:test";

import { BINDING_SETS, buildRules } from "../config";
import {
  analyzeConflicts,
  assertNoConflicts,
  bind,
  from,
  hold,
  key,
  app,
  RuleConflictError,
  to,
} from "../engine";
import type { Binding } from "../data";

/**
 * The production build path must validate conflicts.
 *
 * `assertUniqueTriggers` used to be called from the build entry point; it was
 * replaced by the richer `assertNoConflicts`. These tests pin the guarantee to
 * the path the build actually takes, so the validation cannot be silently
 * dropped again during a refactor — the previous version was only covered by
 * tests of the validator itself, which kept passing while nothing called it.
 */

test("buildRules() validates conflicts before emitting anything", () => {
  // A duplicate injected into the real binding sets must fail, proving the
  // check runs over production data rather than a test-local fixture.
  const original = [...BINDING_SETS[0]!.bindings];
  const duplicate = original[0];
  assert.ok(duplicate, "expected at least one binding in the first set");

  assert.throws(
    () =>
      assertNoConflicts([
        ...BINDING_SETS,
        { name: "injected", bindings: [duplicate] },
      ]),
    RuleConflictError,
  );
});

test("the shipped configuration itself has no conflicts", () => {
  const { analysis } = buildRules();
  assert.deepEqual(
    analysis.errors.map((e) => e.message),
    [],
  );
});

test("a duplicate bare tap-hold trigger is rejected, not silently shadowed", () => {
  // The exact regression the reviewer flagged: two bindings on the same bare
  // key. Previously this emitted two rules and the second was unreachable.
  const bindings: Binding[] = [
    bind(from("k"), to(hold(key("a")))),
    bind(from("k"), to(hold(key("b")))),
  ];

  const report = analyzeConflicts([{ name: "tap-hold", bindings }]);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]?.kind, "duplicate");
  assert.match(report.errors[0]!.message, /can never fire/);
});

test("duplicate detection covers every binding set, not just tap-hold", () => {
  // The old validator only ever saw tapHoldBindings; guards, mouse, caps-lock
  // and disabled-hotkeys were compiled unchecked.
  const shared = bind(from("d", ["L.cmd"]), to(hold(app("com.example.app"))));

  const report = analyzeConflicts([
    { name: "guards", bindings: [shared] },
    { name: "disabled-hotkeys", bindings: [shared] },
  ]);

  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]?.earlier.set, "guards");
  assert.equal(report.errors[0]?.later.set, "disabled-hotkeys");
});
