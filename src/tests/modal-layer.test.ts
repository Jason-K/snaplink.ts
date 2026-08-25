import assert from "node:assert/strict";
import test from "node:test";

import { APPS, URLS } from "../data";
import {
  analyzeConflictsInOrder,
  bind,
  buildManipulators,
  from,
  key,
  lintBindings,
  modalLayer,
  planRules,
  press,
  to,
  type Binding,
  type ModalLayerConfig,
} from "../engine";
import type { Manipulator } from "../types/karabiner";

const layerOf = (overrides: Partial<ModalLayerConfig> = {}) =>
  modalLayer({
    leader: "spacebar",
    sublayers: {
      w: {
        description: "Window management",
        mappings: { h: URLS.hsWinLeftTop, l: URLS.hsWinRightBottom },
      },
    },
    mappings: { q: APPS.qspace },
    ...overrides,
  });

/** Emit the layer as its own set, the way `config.ts` is required to plan it. */
function emittedManipulators(bindings: readonly Binding[]): Manipulator[] {
  return planRules([{ name: "layer", bindings: [...bindings] }]).flatMap((plan) =>
    plan.bindings.flatMap((p) => buildManipulators(p.binding)),
  );
}

const setVarsIn = (events: unknown[] | undefined) =>
  (events ?? [])
    .map((e) => (e as { set_variable?: { name: string; value: unknown } }).set_variable)
    .filter((v): v is { name: string; value: unknown } => Boolean(v));

// ─────────────────────────────────────────────────────────────────────────────
// Shape
// ─────────────────────────────────────────────────────────────────────────────

test("the layer owns one variable per level", () => {
  const layer = layerOf();
  assert.deepEqual(
    layer.variables.map((v) => v.name),
    ["spacebar_mod", "spacebar_w_sublayer"],
  );
});

test("an explicit prefix replaces the leader-derived one", () => {
  assert.equal(layerOf({ prefix: "nav" }).variables[0]!.name, "nav_mod");
});

test("every binding shares one rule group, so the GUI shows one row", () => {
  const layer = layerOf();
  const ids = new Set(layer.bindings.map((b) => b.ruleGroup?.id));
  assert.deepEqual([...ids], ["spacebar_modal_layer"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Entering
// ─────────────────────────────────────────────────────────────────────────────

test("hold mode keeps the leader key typeable and clears the layer on the tap", () => {
  const [enter] = layerOf().bindings;
  const m = buildManipulators(enter!)[0] as {
    to_if_alone?: unknown[];
    to_if_held_down?: unknown[];
  };

  // The tap emits the key itself, then clears every variable — a hold that
  // never reached the threshold must not leave the layer half-open.
  assert.equal((m.to_if_alone?.[0] as { key_code?: string }).key_code, "spacebar");
  assert.deepEqual(
    setVarsIn(m.to_if_alone).map((v) => `${v.name}=${v.value}`),
    ["spacebar_mod=0", "spacebar_w_sublayer=0"],
  );
  assert.deepEqual(setVarsIn(m.to_if_held_down).map((v) => `${v.name}=${v.value}`), [
    "spacebar_mod=1",
  ]);
});

test("hold mode clears the cancel fallback, so opening the layer does not replay the tap", () => {
  const [enter] = layerOf().bindings;
  const m = buildManipulators(enter!)[0] as {
    to_delayed_action?: { to_if_canceled?: unknown[] };
  };
  assert.deepEqual(m.to_delayed_action?.to_if_canceled, []);
});

test("tap mode opens the layer on release and emits nothing else", () => {
  const [enter] = layerOf({ enterOn: "tap" }).bindings;
  const m = buildManipulators(enter!)[0] as { to_if_alone?: unknown[] };
  assert.deepEqual(setVarsIn(m.to_if_alone).map((v) => `${v.name}=${v.value}`), [
    "spacebar_mod=1",
  ]);
  assert.equal(m.to_if_alone?.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// The sublayer hand-off — the failure this builder exists to prevent
// ─────────────────────────────────────────────────────────────────────────────

test("entering a sublayer clears the root variable in the same to array", () => {
  const layer = layerOf();
  const entry = layer.bindings.find(
    (b) =>
      b.trigger &&
      "keys" in b.trigger &&
      b.trigger.keys[0] === "w" &&
      b.conditions?.some((c) => "var" in c && c.var.name === "spacebar_mod"),
  );
  const m = buildManipulators(entry!)[0] as { to?: unknown[] };

  // Both writes on one key-down: two live layer variables would mean two live
  // sets of mappings for the same key.
  assert.deepEqual(setVarsIn(m.to).map((v) => `${v.name}=${v.value}`), [
    "spacebar_w_sublayer=1",
    "spacebar_mod=0",
  ]);
});

test("a one-shot mapping fires and closes the layer in one to array", () => {
  const layer = layerOf();
  const mapping = layer.bindings.find(
    (b) =>
      "keys" in b.trigger &&
      b.trigger.keys[0] === "h" &&
      b.conditions?.some((c) => "var" in c && c.var.name === "spacebar_w_sublayer"),
  );
  const m = buildManipulators(mapping!)[0] as { to?: unknown[] };

  assert.equal((m.to?.[0] as { shell_command?: string }).shell_command !== undefined, true);
  assert.deepEqual(setVarsIn(m.to).map((v) => `${v.name}=${v.value}`), [
    "spacebar_mod=0",
    "spacebar_w_sublayer=0",
  ]);
});

test("a sticky mapping leaves the layer up", () => {
  const layer = modalLayer({
    leader: "spacebar",
    sublayers: {
      w: { sticky: true, mappings: { h: URLS.hsWinLeftTop } },
    },
  });
  const mapping = layer.bindings.find(
    (b) => "keys" in b.trigger && b.trigger.keys[0] === "h",
  );
  const m = buildManipulators(mapping!)[0] as { to?: unknown[] };
  assert.deepEqual(setVarsIn(m.to), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Exits
// ─────────────────────────────────────────────────────────────────────────────

test("every exit path clears every variable, not just its own level", () => {
  const layer = layerOf();
  const exits = layer.bindings.filter((b) =>
    b.cases.some((c) =>
      (c.do ?? []).every((a) => (a as { type?: string }).type === "setVar"),
    ),
  );
  assert.equal(exits.length > 0, true);
  for (const exit of exits) {
    const cleared = exit.cases
      .flatMap((c) => c.do ?? [])
      .map((a) => (a as { var?: { name: string } }).var?.name);
    for (const v of layer.variables) {
      assert.equal(cleared.includes(v.name), true, `${v.name} not cleared by an exit path`);
    }
  }
});

test("escape and the leader each get one exit binding per variable", () => {
  // Conditions on a manipulator are ANDed, so one binding listing every
  // variable would only exit when all of them were set at once.
  const layer = layerOf();
  const escapes = layer.bindings.filter(
    (b) => "keys" in b.trigger && b.trigger.keys[0] === "escape",
  );
  assert.equal(escapes.length, layer.variables.length);
  for (const b of escapes) assert.equal(b.conditions?.length, 1);
});

test("escapeKey: false omits the escape bindings", () => {
  const layer = layerOf({ escapeKey: false });
  assert.equal(
    layer.bindings.some((b) => "keys" in b.trigger && b.trigger.keys[0] === "escape"),
    false,
  );
});

test("a sticky layer with no way out is refused", () => {
  assert.throws(
    () =>
      modalLayer({
        leader: "spacebar",
        escapeKey: false,
        sticky: true,
        mappings: { q: APPS.qspace },
      }),
    /has no exit/,
  );
});

test("a layer with nothing to select is refused", () => {
  assert.throws(() => modalLayer({ leader: "spacebar" }), /would open onto nothing/);
});

// ─────────────────────────────────────────────────────────────────────────────
// The catch-all, and the ordering constraint it depends on
// ─────────────────────────────────────────────────────────────────────────────

test("the catch-all is emitted after every mapping it would otherwise swallow", () => {
  const manipulators = emittedManipulators(layerOf().bindings);
  const firstCatchAll = manipulators.findIndex(
    (m) => (m as { from?: { any?: string } }).from?.any !== undefined,
  );
  const lastMapping = manipulators.reduce(
    (acc, m, i) => ((m as { from?: { key_code?: string } }).from?.key_code ? i : acc),
    -1,
  );

  assert.notEqual(firstCatchAll, -1, "no catch-all was emitted");
  assert.equal(
    firstCatchAll > lastMapping,
    true,
    "a from.any catch-all reached before the layer's own mappings would eat them",
  );
});

test('onUnmapped: "swallow" emits nothing and leaves the layer up', () => {
  const layer = layerOf();
  const catchAll = layer.bindings.filter((b) => "any" in b.trigger);
  assert.equal(catchAll.length, layer.variables.length);
  for (const b of catchAll) {
    assert.deepEqual(
      b.cases.flatMap((c) => c.do ?? []).map((a) => (a as { type?: string }).type),
      ["noop"],
    );
  }
});

test('onUnmapped: "exit" closes the layer instead', () => {
  const layer = layerOf({ onUnmapped: "exit" });
  const catchAll = layer.bindings.find((b) => "any" in b.trigger)!;
  assert.deepEqual(
    catchAll.cases.flatMap((c) => c.do ?? []).map((a) => (a as { var?: { name: string } }).var?.name),
    layer.variables.map((v) => v.name),
  );
});

test('onUnmapped: "passthrough" emits no catch-all at all', () => {
  assert.equal(layerOf({ onUnmapped: "passthrough" }).bindings.some((b) => "any" in b.trigger), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suppression
// ─────────────────────────────────────────────────────────────────────────────

test("suppress() gates other bindings on every layer variable being down", () => {
  const layer = layerOf();
  const [suppressed] = layer.suppress([bind(from("a"), to(press(key("b"))))]);

  assert.deepEqual(
    suppressed!.conditions?.map((c) => ("var" in c ? `${c.var.name}!=${c.equals}` : "?")),
    ["spacebar_mod!=1", "spacebar_w_sublayer!=1"],
  );
});

test("suppress() leaves the input bindings untouched", () => {
  const original = bind(from("a"), to(press(key("b"))));
  layerOf().suppress([original]);
  assert.equal(original.conditions, undefined);
});

test("suppress() keeps the binding's own conditions", () => {
  const layer = layerOf();
  const [suppressed] = layer.suppress([
    bind(from("a"), to(press(key("b"))), { conditions: [{ app: APPS.word }] }),
  ]);
  assert.equal(suppressed!.conditions?.length, 3);
  assert.equal("app" in suppressed!.conditions!.at(-1)!, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// The layer must survive the analyses the build runs over it
// ─────────────────────────────────────────────────────────────────────────────

test("a modal layer has no unreachable rules once planned", () => {
  const ordered = planRules([{ name: "layer", bindings: layerOf().bindings }]).flatMap(
    (p) => p.bindings,
  );
  assert.deepEqual(analyzeConflictsInOrder(ordered).errors.map((e) => e.message), []);
});

test("a modal layer is gesture-lint clean", () => {
  const ordered = planRules([{ name: "layer", bindings: layerOf().bindings }]).flatMap(
    (p) => p.bindings,
  );
  assert.deepEqual(lintBindings(ordered).diagnostics.map((d) => `${d.rule}: ${d.message}`), []);
});

test("a key that is both a sublayer and a root mapping is refused", () => {
  // Both would compile to `from: w` gated on the root variable — the shape
  // analyze-conflicts reports as `duplicate`, two passes further downstream.
  assert.throws(
    () =>
      modalLayer({
        leader: "spacebar",
        mappings: { w: APPS.qspace },
        sublayers: { w: { mappings: { h: URLS.hsWinLeftTop } } },
      }),
    /appears both as a sublayer and as a root mapping/,
  );
});
