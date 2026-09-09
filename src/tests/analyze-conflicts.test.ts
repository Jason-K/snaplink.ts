import assert from "node:assert/strict";
import test from "node:test";

import type { AppSpec, Binding, DeviceSpec, VarSpec } from "../data";
import {
  analyzeConflicts,
  assertNoConflicts,
  bind,
  condApp,
  condDevice,
  condNotVar,
  condVar,
  from,
  hold,
  inputDomainContains,
  inputDomainsIntersect,
  key,
  noop,
  press,
  RuleConflictError,
  sameInputDomain,
  to,
  toInputDomain,
  when,
} from "../engine";

const appA: AppSpec = { type: "app", bundleId: "com.example.a", refDesc: "App A" };
const appB: AppSpec = { type: "app", bundleId: "com.example.b", refDesc: "App B" };
const flag: VarSpec = { name: "test_flag", varDesc: "Test flag" };
const mouse: DeviceSpec = {
  name: "testMouse",
  deviceDesc: "Test mouse",
  vendor_id: 1,
  product_id: 2,
  is_pointing_device: true,
};

const set = (name: string, bindings: Binding[]) => ({ name, bindings });

// ---------------------------------------------------------------------------
// Input domains
// ---------------------------------------------------------------------------

test("input domain: a bare key matches only when no modifiers are held", () => {
  const bare = toInputDomain(from("s"));
  const shifted = toInputDomain(from("s", ["shift"]));

  assert.equal(inputDomainsIntersect(bare, shifted), false);
  assert.equal(inputDomainContains(bare, shifted), false);
});

test("input domain: optional 'any' contains every modifier combination", () => {
  const anyMods = toInputDomain(from("s", { optional: ["any"] }));
  const shifted = toInputDomain(from("s", ["shift"]));

  assert.equal(inputDomainContains(anyMods, shifted), true);
  assert.equal(inputDomainContains(shifted, anyMods), false);
});

test("input domain: fewer mandatory modifiers is the broader domain", () => {
  const cmd = toInputDomain(from("q", { mandatory: ["command"], optional: ["any"] }));
  const cmdShift = toInputDomain(from("q", ["command", "shift"]));

  assert.equal(inputDomainContains(cmd, cmdShift), true);
  assert.equal(inputDomainContains(cmdShift, cmd), false);
});

test("input domain: different keys never intersect", () => {
  assert.equal(
    inputDomainsIntersect(toInputDomain(from("a")), toInputDomain(from("b"))),
    false,
  );
});

test("input domain: chords compare order-insensitively", () => {
  assert.equal(
    inputDomainsIntersect(toInputDomain(from(["a", "b"])), toInputDomain(from(["b", "a"]))),
    true,
  );
});

// ---------------------------------------------------------------------------
// Duplicate and shadowing detection
// ---------------------------------------------------------------------------

test("detects an exact duplicate across two different binding sets", () => {
  const report = analyzeConflicts([
    set("first", [bind(from("d", ["L.cmd"]), to(press(key("d", ["L.cmd"]))), when(condApp(appA)))]),
    set("second", [bind(from("d", ["L.cmd"]), to(press(noop())), when(condApp(appA)))]),
  ]);

  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]?.kind, "duplicate");
  assert.equal(report.errors[0]?.later.set, "second");
});

test("detects a later rule shadowed by an earlier unconditional one", () => {
  const report = analyzeConflicts([
    set("broad", [bind(from("h", ["L.cmd"]), to(press(noop())))]),
    set("narrow", [bind(from("h", ["L.cmd"]), to(press(key("x"))), when(condApp(appA)))]),
  ]);

  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]?.kind, "shadowed");
});

test("a conditional rule placed before an unconditional one is not a conflict", () => {
  // This is the correct ordering: the specific case is tried first and the
  // general case still handles everything else.
  const report = analyzeConflicts([
    set("narrow", [bind(from("h", ["L.cmd"]), to(press(key("x"))), when(condApp(appA)))]),
    set("broad", [bind(from("h", ["L.cmd"]), to(press(noop())))]),
  ]);

  assert.deepEqual(report.errors, []);
});

test("a broader modifier domain shadows a narrower one that follows it", () => {
  const report = analyzeConflicts([
    set("any", [bind(from("q", { mandatory: ["L.cmd"], optional: ["any"] }), to(press(noop())))]),
    set("exact", [bind(from("q", ["L.cmd", "shift"]), to(press(key("x"))))]),
  ]);

  assert.equal(report.errors[0]?.kind, "shadowed");
});

// ---------------------------------------------------------------------------
// Condition disjointness — the false-positive guard
// ---------------------------------------------------------------------------

test("same trigger with opposite variable polarity is not a conflict", () => {
  const report = analyzeConflicts([
    set("mouse", [
      bind(from("left"), to(press(key("a"))), when(condDevice(mouse), condVar(flag, 1))),
      bind(from("left"), to(press(key("b"))), when(condDevice(mouse), condNotVar(flag, 1))),
    ]),
  ]);

  assert.deepEqual(report.errors, []);
});

test("same trigger requiring two different variable values is not a conflict", () => {
  const report = analyzeConflicts([
    set("s", [
      bind(from("x"), to(press(key("a"))), when(condVar(flag, 1))),
      bind(from("x"), to(press(key("b"))), when(condVar(flag, 2))),
    ]),
  ]);

  assert.deepEqual(report.errors, []);
});

test("same trigger scoped to two different apps is not a conflict", () => {
  const report = analyzeConflicts([
    set("s", [
      bind(from("x"), to(press(key("a"))), when(condApp(appA))),
      bind(from("x"), to(press(key("b"))), when(condApp(appB))),
    ]),
  ]);

  assert.deepEqual(report.errors, []);
});

test("same trigger on two different devices is not a conflict", () => {
  const other: DeviceSpec = { ...mouse, name: "other", product_id: 99 };
  const report = analyzeConflicts([
    set("s", [
      bind(from("left"), to(press(key("a"))), when(condDevice(mouse))),
      bind(from("left"), to(press(key("b"))), when(condDevice(other))),
    ]),
  ]);

  assert.deepEqual(report.errors, []);
});

// ---------------------------------------------------------------------------
// Chord-member reachability
// ---------------------------------------------------------------------------

test("a bare single-key rule before a chord using that key warns", () => {
  const report = analyzeConflicts([
    set("single", [bind(from("j"), to(hold(key("a"))))]),
    set("chord", [bind(from(["j", "k"]), to(hold(key("b"))))]),
  ]);

  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0]?.kind, "chord-member");
  // Ambiguous by timing, so it must not fail the build.
  assert.deepEqual(report.errors, []);
});

test("a chord ordered before its member key is not flagged", () => {
  const report = analyzeConflicts([
    set("chord", [bind(from(["j", "k"]), to(hold(key("b"))))]),
    set("single", [bind(from("j"), to(hold(key("a"))))]),
  ]);

  assert.deepEqual(report.warnings, []);
});

test("modifier-form and chord-form of the same combination are alternate encodings", () => {
  // vmod() emits both so that whichever way Karabiner reports the combination,
  // one matches. That pairing must not be reported as a conflict.
  const report = analyzeConflicts([
    set("vmod", [
      bind(from("caps_lock", ["left_shift"]), to(press(key("left_command")))),
      bind(from(["caps_lock", "left_shift"]), to(press(key("left_command")))),
    ]),
  ]);

  assert.deepEqual(report.warnings, []);
  assert.deepEqual(report.errors, []);
});

// ---------------------------------------------------------------------------
// assertNoConflicts
// ---------------------------------------------------------------------------

test("assertNoConflicts throws with an actionable message on unreachable rules", () => {
  const sets = [
    set("a", [bind(from("d", ["L.cmd"]), to(press(key("d", ["L.cmd"]))))]),
    set("b", [bind(from("d", ["L.cmd"]), to(press(noop())))]),
  ];

  assert.throws(
    () => assertNoConflicts(sets),
    (error: unknown) => {
      assert.ok(error instanceof RuleConflictError);
      assert.equal(error.conflicts.length, 1);
      assert.match(error.message, /left_command\+d/);
      assert.match(error.message, /can never fire/);
      return true;
    },
  );
});

test("assertNoConflicts returns the report when the configuration is clean", () => {
  const report = assertNoConflicts([
    set("a", [bind(from("a"), to(hold(key("x"))))]),
    set("b", [bind(from("b"), to(hold(key("y"))))]),
  ]);

  assert.equal(report.bindings.length, 2);
  assert.deepEqual(report.errors, []);
});

test("conflict analysis: a from.any catch-all covers every key trigger of its kind", () => {
  const anyKey = toInputDomain({ any: "key_code", modifiers: { optional: ["any"] } });
  const oneKey = toInputDomain({ keys: ["a"] });
  const chord = toInputDomain({ keys: ["a", "b"] });
  const button = toInputDomain({ pointer: "button1" });

  assert.equal(inputDomainContains(anyKey, oneKey), true);
  assert.equal(inputDomainContains(anyKey, chord), true, "it consumes the chord's first key-down");
  assert.equal(inputDomainContains(anyKey, button), false, "a key catch-all is not a button one");
  assert.equal(
    inputDomainContains(oneKey, anyKey),
    false,
    "containment is directional: one key does not cover the catch-all",
  );
  assert.equal(inputDomainsIntersect(anyKey, oneKey), true);
  assert.equal(sameInputDomain(anyKey, oneKey), false);
});

test("conflict analysis: a conditional catch-all does not shadow the rules after it", () => {
  const layerVar = { name: "layer_held", varDesc: "Layer held" };
  const report = analyzeConflicts([
    set("layer", [
      {
        trigger: { any: "key_code", modifiers: { optional: ["any"] } },
        conditions: [{ var: layerVar, equals: 1 }],
        cases: [{ phase: "press", do: [{ type: "noop" }] }],
      },
    ]),
    set("keys", [
      { trigger: { keys: ["a"] }, cases: [{ phase: "press", do: [{ type: "key", key: "b" }] }] },
    ]),
  ]);
  assert.deepEqual(report.errors, [], "the catch-all is the narrower rule, not the shadowing one");
});
