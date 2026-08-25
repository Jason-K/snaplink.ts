import assert from "node:assert/strict";
import test from "node:test";

import { APPS, DEVICES, TIMING_PROFILES, VARS } from "../data";
import {
  bind,
  bindTable,
  buildManipulators,
  exceptInApp,
  forApp,
  from,
  group,
  hold,
  key,
  onDevice,
  press,
  release,
  scoped,
  timing,
  to,
  when,
  whileVar,
  whileVarIs,
  withOptions,
  withTiming,
  unlessVar,
  type Binding,
} from "../engine";

const condNames = (b: Binding) =>
  (b.conditions ?? []).map((c) =>
    "app" in c
      ? `${c.unless ? "!" : ""}app`
      : "var" in c
        ? `${c.unless ? "!" : ""}${c.var.name}=${c.equals}`
        : "device" in c
          ? "device"
          : "?",
  );

// ─────────────────────────────────────────────────────────────────────────────
// Scoping
// ─────────────────────────────────────────────────────────────────────────────

test("forApp gates every binding in the block", () => {
  const scopedBindings = forApp(APPS.excel, [
    bind(from("a"), to(press(key("b")))),
    bind(from("c"), to(press(key("d")))),
  ]);
  assert.equal(scopedBindings.length, 2);
  for (const b of scopedBindings) assert.deepEqual(condNames(b), ["app"]);
});

test("a block can be spread rather than wrapped in an array", () => {
  const scopedBindings = forApp(
    APPS.excel,
    bind(from("a"), to(press(key("b")))),
    ...bindTable("hold", { x: key("y"), z: key("w") }),
  );
  assert.equal(scopedBindings.length, 3);
});

test("scoping does not mutate the input bindings", () => {
  const original = bind(from("a"), to(press(key("b"))));
  forApp(APPS.excel, [original]);
  assert.equal(original.conditions, undefined);
});

test("nesting composes outermost-first", () => {
  const [b] = forApp(APPS.word, whileVar(VARS.rCmdDown, [bind(from("a"), to(press(key("b"))))]));
  assert.deepEqual(condNames(b!), ["app", "right_command_pressed=1"]);
});

test("a scope keeps the binding's own conditions, after its own", () => {
  const [b] = forApp(APPS.word, [bind(from("a"), to(press(key("b"))), when(VARS.rCmdDown))]);
  assert.deepEqual(condNames(b!), ["app", "right_command_pressed=1"]);
});

test("exceptInApp negates", () => {
  const [b] = exceptInApp(APPS.excel, [bind(from("a"), to(press(key("b"))))]);
  assert.deepEqual(condNames(b!), ["!app"]);
});

test("unlessVar and whileVarIs cover the non-default value cases", () => {
  const [off] = unlessVar(VARS.rCmdDown, [bind(from("a"), to(press(key("b"))))]);
  const [mode] = whileVarIs(VARS.rCmdDown, "window", [bind(from("a"), to(press(key("b"))))]);
  assert.deepEqual(condNames(off!), ["!right_command_pressed=1"]);
  assert.deepEqual(condNames(mode!), ["right_command_pressed=window"]);
});

test("onDevice scopes to the event's source device", () => {
  const [b] = onDevice(DEVICES.g502X, [bind(from("a"), to(press(key("b"))))]);
  assert.deepEqual(condNames(b!), ["device"]);
});

test("scoped() accepts a when() wrapper of several conditions", () => {
  const [b] = scoped(when(APPS.word, VARS.rCmdDown), [bind(from("a"), to(press(key("b"))))]);
  assert.deepEqual(condNames(b!), ["app", "right_command_pressed=1"]);
});

test("a scoped condition reaches the compiled manipulator", () => {
  const [b] = forApp(APPS.excel, [bind(from("a"), to(press(key("b"))))]);
  const m = buildManipulators(b!)[0] as { conditions?: { type: string }[] };
  assert.equal(m.conditions?.[0]?.type, "frontmost_application_if");
});

test("a scope applies to every case, so per-case conditions still narrow within it", () => {
  const [b] = forApp(APPS.excel, [
    bind(from("a"), to(release(key("b")), hold(key("c")).when(VARS.rCmdDown))),
  ]);
  const manipulators = buildManipulators(b!) as {
    conditions?: unknown[];
    to_if_alone?: unknown[];
    to_if_held_down?: unknown[];
  }[];

  // The narrower group inherits the broader group's tap, as it does unscoped —
  // scoping shifts the whole binding down the lattice without disturbing the
  // relationships between its own cases.
  const narrow = manipulators.find((m) => (m.conditions ?? []).length === 2)!;
  assert.equal(narrow.to_if_held_down !== undefined, true);
  assert.equal(narrow.to_if_alone !== undefined, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Options and timing
// ─────────────────────────────────────────────────────────────────────────────

test("withOptions supplies defaults and never overrides the binding", () => {
  const [defaulted, explicit] = withOptions({ suppressCancelFallback: true }, [
    bind(from("a"), to(press(key("b")))),
    bind(from("c"), to(press(key("d"))), { suppressCancelFallback: false }),
  ]);
  assert.equal(defaulted!.suppressCancelFallback, true);
  assert.equal(explicit!.suppressCancelFallback, false);
});

test("withTiming merges field-by-field, so one key can differ on one threshold", () => {
  const [plain, tweaked] = withTiming("snappy", [
    bind(from("a"), to(release(key("b")), hold(key("c")))),
    bind(from("d"), to(release(key("e")), hold(key("f"))), timing({ delayedMs: 500 })),
  ]);
  assert.deepEqual(plain!.timing, TIMING_PROFILES.snappy);
  assert.equal(tweaked!.timing?.aloneMs, TIMING_PROFILES.snappy.aloneMs);
  assert.equal(tweaked!.timing?.delayedMs, 500);
});

test("withTiming also takes an explicit timing object", () => {
  const [b] = withTiming({ aloneMs: 175, holdMs: 175 }, [bind(from("a"), to(release(key("b"))))]);
  assert.deepEqual(b!.timing, { aloneMs: 175, holdMs: 175 });
});

test("group() merges a block into one GUI rule", () => {
  const bindings = group("Window management", bindTable("release", { h: key("a"), l: key("b") }));
  assert.deepEqual(
    [...new Set(bindings.map((b) => b.ruleGroup?.id))],
    ["window_management"],
  );
  assert.equal(bindings[0]!.ruleGroup?.description, "Window management");
});

test("group() takes an explicit id when the derived slug is not wanted", () => {
  const [b] = group({ id: "win", description: "Windows" }, [bind(from("a"), to(press(key("b"))))]);
  assert.equal(b!.ruleGroup?.id, "win");
});

// ─────────────────────────────────────────────────────────────────────────────
// timing() profiles
// ─────────────────────────────────────────────────────────────────────────────

test("timing() expands a profile name to a complete timing set", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing("balanced"));
  assert.deepEqual(b.timing, TIMING_PROFILES.balanced);
});

test("timing() applies overrides on top of a profile", () => {
  const b = bind(from("a"), to(release(key("b")), hold(key("c"))), timing("snappy", { holdMs: 260 }));
  assert.equal(b.timing?.aloneMs, TIMING_PROFILES.snappy.aloneMs);
  assert.equal(b.timing?.holdMs, 260);
});

test("timing() still accepts an explicit object", () => {
  const b = bind(from("a"), to(release(key("b"))), timing({ aloneMs: 175 }));
  assert.deepEqual(b.timing, { aloneMs: 175 });
});

test("no profile carries simultaneousMs — the chord window is not part of a feel", () => {
  for (const profile of Object.values(TIMING_PROFILES)) {
    assert.equal("simultaneousMs" in profile, false);
  }
});
