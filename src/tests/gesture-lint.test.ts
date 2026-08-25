import assert from "node:assert/strict";
import test from "node:test";

import { TIMING_PROFILES, VARS } from "../data";
import {
  bind,
  buildManipulators,
  delayedSingleTap,
  doubleTap,
  effectiveMultiTapThreshold,
  effectiveTapHoldTimings,
  formatLintReport,
  from,
  hold,
  key,
  lintBindings,
  options,
  press,
  release,
  setVar,
  simultaneous,
  timing,
  to,
  when,
  type Binding,
  type LintRuleId,
} from "../engine";

/** Run the lint over one binding and return the rule ids it reported. */
function rulesFor(...bindings: Binding[]): LintRuleId[] {
  return lintBindings(
    bindings.map((binding, index) => ({ set: "test", index, binding })),
  ).diagnostics.map((d) => d.rule);
}

const paramsOf = (b: Binding) =>
  (buildManipulators(b)[0] as { parameters?: Record<string, number> }).parameters ?? {};

// ─────────────────────────────────────────────────────────────────────────────
// The effective-timing model must track the emitter, or every timing rule lies
// ─────────────────────────────────────────────────────────────────────────────

test("effectiveTapHoldTimings matches the parameters the emitter writes", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing({ aloneMs: 150, holdMs: 350 }));
  const params = paramsOf(b);

  assert.deepEqual(effectiveTapHoldTimings(b), { aloneMs: 150, holdMs: 350 });
  assert.equal(params["basic.to_if_alone_timeout_milliseconds"], 150);
  assert.equal(params["basic.to_if_held_down_threshold_milliseconds"], 350);
});

test("effectiveTapHoldTimings reports the inherited defaults when nothing is set", () => {
  // Only values that differ from the profile-level baseline are emitted, so an
  // all-default binding writes no parameters at all — the model has to know the
  // defaults rather than read them back.
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))));
  assert.deepEqual(effectiveTapHoldTimings(b), { aloneMs: 1000, holdMs: 400 });
  assert.deepEqual(paramsOf(b), {});
});

test("effectiveTapHoldTimings reads heldThresholdMs when holdMs is absent", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing({ heldThresholdMs: 250 }));
  assert.equal(effectiveTapHoldTimings(b).holdMs, 250);
  assert.equal(paramsOf(b)["basic.to_if_held_down_threshold_milliseconds"], 250);
});

test("effectiveMultiTapThreshold matches what buildMultiTap hands the builder", () => {
  const b = bind(from("a"), to(release(key("a")), doubleTap(key("b"))), timing({ aloneMs: 220 }));
  assert.equal(effectiveMultiTapThreshold(b), 220);
  assert.equal(paramsOf(b)["basic.to_if_alone_timeout_milliseconds"], 220);
});

// ─────────────────────────────────────────────────────────────────────────────
// tap-hold-dead-zone
// ─────────────────────────────────────────────────────────────────────────────

test("a hold threshold above the alone timeout is reported as a dead zone", () => {
  // aloneMs 150 with the inherited 400ms hold threshold: releasing anywhere in
  // between runs neither channel.
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing({ aloneMs: 150 }));
  assert.deepEqual(rulesFor(b), ["tap-hold-dead-zone"]);
});

test("the dead-zone message quantifies the window and names the inherited half", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing({ aloneMs: 150 }));
  const [d] = lintBindings([{ set: "test", index: 0, binding: b }]).warnings;
  assert.match(d!.message, /250 ms dead zone/);
  assert.match(d!.message, /between 150 ms and 400 ms/);
  assert.match(d!.message, /hold threshold is the inherited default/);
});

test("equal thresholds are clean, and every timing profile sets them equal", () => {
  for (const [name, profile] of Object.entries(TIMING_PROFILES)) {
    assert.equal(profile.aloneMs, profile.holdMs, `profile "${name}" would leave a gap`);
    const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing(name as keyof typeof TIMING_PROFILES));
    assert.deepEqual(rulesFor(b), [], `profile "${name}" tripped the lint`);
  }
});

test("the default thresholds are clean — hold fires before the tap times out", () => {
  assert.deepEqual(rulesFor(bind(from("a"), to(release(key("b")), hold(key("c"))))), []);
});

test("no dead zone is reported without both a tap and a hold to arbitrate", () => {
  assert.deepEqual(rulesFor(bind(from("a"), to(hold(key("c"))), timing({ aloneMs: 150 }))), []);
  // An explicitly emptied phase is a suppression, not a gesture.
  assert.deepEqual(
    rulesFor(bind(from("a"), to(release([]), hold(key("c"))), timing({ aloneMs: 150 }))),
    [],
  );
});

test("chords are exempt: one threshold drives both of their channels", () => {
  const b = bind(simultaneous("j", "k"), to(release(key("escape")), hold(key("c"))), timing({ aloneMs: 150 }));
  assert.equal(rulesFor(b).includes("tap-hold-dead-zone"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// hold-layer-leak
// ─────────────────────────────────────────────────────────────────────────────

test("a hold-tracking binding that leaves the cancel fallback wired is reported", () => {
  const b = bind(
    from("R.cmd"),
    to(release(key("R.cmd")), hold([])),
    options({ whileHoldVar: VARS.rCmdDown }),
  );
  assert.equal(rulesFor(b).includes("hold-layer-leak"), true);
});

test("suppressCancelFallback clears the leak", () => {
  const b = bind(
    from("R.cmd"),
    to(release(key("R.cmd")), hold([])),
    options({ whileHoldVar: VARS.rCmdDown, suppressCancelFallback: true }),
  );
  assert.equal(rulesFor(b).includes("hold-layer-leak"), false);
});

test("holdLayer() output is free of the leak it exists to prevent", async () => {
  const { holdLayer } = await import("../engine");
  const bindings = holdLayer({
    trigger: "R.cmd",
    variable: VARS.rCmdDown,
    bindings: { a: key("b") },
  });
  assert.deepEqual(rulesFor(...bindings), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Options read from a field other than the one that was set
// ─────────────────────────────────────────────────────────────────────────────

test("holdMs on a multi-tap binding is reported as dropped", () => {
  const b = bind(from("a"), to(release(key("a")), doubleTap(key("b"))), timing({ holdMs: 220 }));
  assert.equal(rulesFor(b).includes("multi-tap-ignores-hold-ms"), true);
  // And it really is dropped: the compiled threshold is the 300ms default.
  assert.equal(effectiveMultiTapThreshold(b), 300);
});

test("aloneMs on a multi-tap binding is not reported", () => {
  const b = bind(from("a"), to(release(key("a")), doubleTap(key("b"))), timing({ aloneMs: 220 }));
  assert.deepEqual(rulesFor(b), []);
});

test("holdMs on a chord is reported as dropped", () => {
  const b = bind(simultaneous("j", "k"), to(release(key("escape")), hold(key("c"))), timing({ holdMs: 220 }));
  assert.equal(rulesFor(b).includes("chord-ignores-hold-ms"), true);
});

test("pass-through mode is reported when it would discard a single-tap action", () => {
  const b = bind(
    from("L.cmd"),
    to(release(key("escape")), hold(key("L.cmd")), doubleTap(key("b"))),
    options({ multiTap: { allowPassThrough: true } }),
  );
  assert.equal(rulesFor(b).includes("multi-tap-passthrough-drops-tap"), true);
});

test("pass-through re-emitting the trigger key itself is not reported", () => {
  // The shape the existing multi-tap modifier bindings use: the single-tap case
  // is the same key pass-through already emits, so nothing is lost.
  const b = bind(
    from("L.cmd"),
    to(release(key("L.cmd")), hold(key("L.cmd")), doubleTap(key("b"))),
    options({ multiTap: { allowPassThrough: true } }),
  );
  assert.equal(rulesFor(b).includes("multi-tap-passthrough-drops-tap"), false);
});

test("a delayed single tap survives pass-through and is not reported", () => {
  const b = bind(
    from("L.cmd"),
    to(delayedSingleTap(key("escape")), doubleTap(key("b"))),
    options({ multiTap: { allowPassThrough: true } }),
  );
  assert.equal(rulesFor(b).includes("multi-tap-passthrough-drops-tap"), false);
});

test("a hold case re-emitting its own modifier trigger is reported", () => {
  const b = bind(from("L.shift"), to(release(key("escape")), hold(key("L.shift"))));
  assert.equal(rulesFor(b).includes("hold-reemits-trigger-modifier"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Variable wiring
// ─────────────────────────────────────────────────────────────────────────────

test("a gate on a variable nothing writes is reported", () => {
  const b = bind(from("a"), to(press(key("b"))), when(VARS.rCmdDown));
  assert.equal(rulesFor(b).includes("gate-var-never-set"), true);
});

test("a gate is satisfied by whileHoldVar on any binding in the set", () => {
  const writer = bind(from("R.cmd"), to(release(key("R.cmd")), hold([])), options({
    whileHoldVar: VARS.rCmdDown,
    suppressCancelFallback: true,
  }));
  const reader = bind(from("a"), to(press(key("b"))), when(VARS.rCmdDown));
  assert.equal(rulesFor(writer, reader).includes("gate-var-never-set"), false);
});

test("a gate is satisfied by a setVar() action", () => {
  const writer = bind(from("f13"), to(press(setVar(VARS.rCmdDown, 1))));
  const reader = bind(from("a"), to(press(key("b"))), when(VARS.rCmdDown));
  assert.equal(rulesFor(writer, reader).includes("gate-var-never-set"), false);
});

test("built-in Karabiner variables are never reported as unwritten", () => {
  // `accessibility.focused_ui_element.role_string` is set by Karabiner, not by
  // any rule. Namespaced names are what distinguishes the two.
  const b = bind(from("a"), to(press(key("b"))), when([VARS.elementType, "AXTextField"]));
  assert.equal(rulesFor(b).includes("gate-var-never-set"), false);
});

test("a hold variable no binding reads is reported as an empty layer", () => {
  const b = bind(
    from("R.cmd"),
    to(release(key("R.cmd")), hold([])),
    options({ whileHoldVar: VARS.rCmdDown, suppressCancelFallback: true }),
  );
  assert.deepEqual(rulesFor(b), ["layer-var-never-read"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings with no channel to act on
// ─────────────────────────────────────────────────────────────────────────────

test("tap/hold thresholds on a press-only binding are reported as inert", () => {
  const b = bind(from("a"), to(press(key("b"))), timing({ aloneMs: 200, holdMs: 200 }));
  assert.deepEqual(rulesFor(b), ["timing-without-gesture"]);
});

test("simultaneousMs on a single-key trigger is reported as inert", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing({ simultaneousMs: 80 }));
  assert.deepEqual(rulesFor(b), ["simultaneous-ms-without-chord"]);
});

test("simultaneousMs on a chord is not reported", () => {
  const b = bind(simultaneous("j", "k"), to(press(key("escape"))), timing({ simultaneousMs: 80 }));
  assert.deepEqual(rulesFor(b), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

test("the report groups findings by rule and carries one fix per group", () => {
  const bindings = [
    bind(from("a"), to(release(key("x")), hold(key("y"))), timing({ aloneMs: 150 })),
    bind(from("b"), to(release(key("x")), hold(key("y"))), timing({ aloneMs: 150 })),
  ];
  const report = lintBindings(bindings.map((binding, index) => ({ set: "test", index, binding })));
  const text = formatLintReport(report);

  assert.equal(report.warnings.length, 2);
  assert.match(text, /\[tap-hold-dead-zone\] 2 binding\(s\)/);
  assert.equal(text.match(/fix:/g)?.length, 1);
});

test("an empty report formats to an empty string", () => {
  assert.equal(formatLintReport(lintBindings([])), "");
});

test("the committed configuration is lint-clean", async () => {
  const { orderedBindings } = await import("../config");
  const report = lintBindings(orderedBindings());
  assert.deepEqual(report.diagnostics.map((d) => `${d.rule}: ${d.message}`), []);
});
