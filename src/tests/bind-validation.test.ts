import assert from "node:assert/strict";
import test from "node:test";

import { bind, from, hold, key, noop, press, to } from "../engine";

/**
 * `bind()` accepts a deliberately flexible argument list. `BindingOptionsSpec`
 * is fully optional, so the type system alone cannot tell a valid options object
 * from a typo'd one — every object literal satisfies it. These cases cover the
 * runtime checks that close that gap.
 */

test("bind accepts a well-formed options object", () => {
  const binding = bind(from("a"), to(hold(key("b"))), {
    timing: { holdMs: 200 },
    suppressCancelFallback: true,
  });

  assert.equal(binding.timing?.holdMs, 200);
  assert.equal(binding.suppressCancelFallback, true);
});

test("bind rejects a misspelled option instead of silently dropping it", () => {
  assert.throws(
    // `timings` for `timing` — previously accepted and discarded, so the
    // binding compiled with default timings and no warning.
    () => bind(from("a"), to(hold(key("b"))), { timings: { holdMs: 200 } } as never),
    /unknown option "timings"/,
  );
});

test("bind names every unknown key it found", () => {
  assert.throws(
    () => bind(from("a"), to(hold(key("b"))), { nope: 1, alsoNope: 2 } as never),
    /unknown options "nope", "alsoNope"/,
  );
});

test("bind rejects an array holding something that is neither case nor condition", () => {
  assert.throws(
    () => bind(from("a"), [press(noop()), { garbage: true }] as never),
    /neither a case nor a condition/,
  );
});

test("bind classifies every array element, not just the first", () => {
  // A conditions array whose first element is a case used to file the whole
  // array as cases (and vice versa).
  const binding = bind(from("a"), [press(noop()), hold(key("b"))]);
  assert.equal(binding.cases.length, 2);
  assert.equal(binding.conditions, undefined);
});
