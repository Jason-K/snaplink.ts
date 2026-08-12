import assert from "node:assert/strict";
import test from "node:test";

import { buildRules } from "../config";
import type { Binding } from "../data";
import {
  bind,
  compareTriggers,
  emitRules,
  from,
  hold,
  key,
  noop,
  planRules,
  press,
  ruleGroupSignature,
  to,
  when,
  condApp,
} from "../engine";
import type { BasicManipulator, Manipulator, Rule } from "../types/karabiner";

/**
 * How bindings become rules: which rule a binding lands in, in what order the
 * rules come out, and in what order the manipulators inside one rule run.
 *
 * A rule is the unit the Karabiner-Elements GUI shows and the user toggles, so
 * these are the properties that decide whether the generated config is legible
 * — and, because emit order *is* evaluation order, whether it is correct.
 */

function labels(rules: Rule[]): string[] {
  return rules.map((r) => r.description?.split("\n")[0] ?? "");
}

function order(bindings: Binding[]): string[] {
  return labels(emitRules(planRules([{ name: "test", bindings }])));
}

function isBasic(m: Manipulator): m is BasicManipulator {
  return m.type === "basic";
}

/** A minimal one-case binding body; only the trigger matters to these tests. */
const tap = () => to(press(noop()));

test("rules sort most-modified first, then ⌘ ⌥ ⌃ ⇧, then alphabetically", () => {
  // The whole worked example: ⌘⌥⌃⇧+A ▸ ⌘⌥⌃+A ▸ ⌘⌥+A ▸ ⌘+A ▸ ⌘+Z ▸ A ▸ Z.
  const declared: Binding[] = [
    bind(from("z"), tap()),
    bind(from("a"), tap()),
    bind(from("z", ["cmd"]), tap()),
    bind(from("a", ["cmd"]), tap()),
    bind(from("a", ["cmd", "opt"]), tap()),
    bind(from("a", ["cmd", "opt", "ctrl"]), tap()),
    bind(from("a", ["cmd", "opt", "ctrl", "shift"]), tap()),
  ];

  assert.deepEqual(order(declared), [
    "[⌘⌥⌃⇧]+[A]:",
    "[⌘⌥⌃]+[A]:",
    "[⌘⌥]+[A]:",
    "[⌘]+[A]:",
    "[⌘]+[Z]:",
    "[A]:",
    "[Z]:",
  ]);
});

test("at equal modifier count, ⌘ outranks ⌥ outranks ⌃ outranks ⇧", () => {
  const declared: Binding[] = [
    bind(from("a", ["ctrl", "shift"]), tap()),
    bind(from("a", ["opt", "shift"]), tap()),
    bind(from("a", ["cmd", "shift"]), tap()),
    bind(from("a", ["opt", "ctrl"]), tap()),
    bind(from("a", ["cmd", "ctrl"]), tap()),
    bind(from("a", ["cmd", "opt"]), tap()),
  ];

  assert.deepEqual(order(declared), [
    "[⌘⌥]+[A]:",
    "[⌘⌃]+[A]:",
    "[⌘⇧]+[A]:",
    "[⌥⌃]+[A]:",
    "[⌥⇧]+[A]:",
    "[⌃⇧]+[A]:",
  ]);
});

test("numbered keys sort numerically, not lexically", () => {
  const declared = ["f10", "f2", "f1"].map((k) => bind(from(k), tap()));
  assert.deepEqual(order(declared), ["[F1]:", "[F2]:", "[F10]:"]);
});

test("a chord's modifier members rank like mandatory modifiers", () => {
  // `vmod()` emits both encodings of one physical combination; they must not
  // drift apart in the output.
  assert.equal(
    compareTriggers(from("caps_lock", ["L.shift"]), from(["caps_lock", "L.shift"])),
    0,
  );
  assert.ok(
    compareTriggers(from(["caps_lock", "L.cmd", "L.shift"]), from(["caps_lock", "L.shift"])) < 0,
    "the two-modifier chord must be evaluated before the one-modifier chord",
  );
});

test("bindings that share a trigger become one rule, conditional manipulators first", () => {
  const rules = emitRules(
    planRules([
      { name: "disabled", bindings: [bind(from("h", ["L.cmd"]), to(press(noop())))] },
      {
        name: "app-specific",
        bindings: [
          bind(from("h", ["L.cmd"]), tap(), when(condApp("com.example.app"))),
        ],
      },
    ]),
  );

  assert.equal(rules.length, 1, "one trigger must produce exactly one rule");
  const manipulators = rules[0]!.manipulators.filter(isBasic);
  assert.equal(manipulators.length, 2);
  assert.ok(
    manipulators[0]!.conditions?.length,
    "the conditional manipulator must come first, or the unconditional one eats every event",
  );
  assert.equal(manipulators[1]!.conditions, undefined);

  // The merged rule describes both bindings, since it is the only label shown.
  assert.match(rules[0]!.description!, /In com\.example\.app/);
  assert.match(rules[0]!.description!, /No operation/);
});

test("optional modifiers do not split a trigger across two rules", () => {
  // `{optional: []}` and `{optional: ["any"]}` are one entry in the GUI.
  assert.equal(
    ruleGroupSignature(from("j", { mandatory: ["cmd"], optional: ["any"] })),
    ruleGroupSignature(from("j", { mandatory: ["cmd"] })),
  );
  assert.notEqual(
    ruleGroupSignature(from("j", { mandatory: ["cmd"] })),
    ruleGroupSignature(from("j", { mandatory: ["L.cmd"] })),
  );
});

test("a ruleGroup merges distinct triggers into one labelled rule", () => {
  const ruleGroup = { id: "demo", description: "[DEMO]:\n---\n\tOn Tap:\n\t\tAlways:\tDemo" };
  const rules = emitRules(
    planRules([
      {
        name: "demo",
        bindings: [
          bind(from("j"), to(hold(key("a"))), { ruleGroup }),
          bind(from("j", ["cmd"]), to(hold(key("b"))), { ruleGroup }),
        ],
      },
    ]),
  );

  assert.equal(rules.length, 1);
  assert.equal(rules[0]!.description, ruleGroup.description);
  // Even inside a group, the more qualified trigger is evaluated first.
  const [firstManipulator] = rules[0]!.manipulators.filter(isBasic);
  assert.deepEqual(firstManipulator!.from.modifiers?.mandatory, ["command"]);
});

test("the whole caps lock layer occupies a single rule", () => {
  const { rules } = buildRules();
  const triggersCapsLock = (m: Manipulator) =>
    isBasic(m) && (m.from as { key_code?: string }).key_code === "caps_lock";
  const caps = rules.filter((r) => r.manipulators.some(triggersCapsLock));

  assert.equal(caps.length, 1, "caps lock must not spread across several GUI rows");
  assert.ok(
    caps[0]!.manipulators.length > 1,
    "the merged rule should still carry every translation",
  );

  // Everything in the rule is either the layer key or gated on it — nothing
  // unrelated may be swept into the group, least of all its catch-all.
  for (const m of caps[0]!.manipulators) {
    if (triggersCapsLock(m)) continue;
    assert.ok(
      isBasic(m) &&
        m.conditions?.some(
          (c) => c.type === "variable_if" && (c as any).name === "caps_lock_pressed"
        ),
      `manipulator ${JSON.stringify(isBasic(m) ? m.from : m)} is in the caps rule but not gated on the layer`,
    );
  }
});

test("no two emitted rules claim the same trigger", () => {
  const { rules } = buildRules();
  const seen = new Map<string, string>();
  for (const rule of rules) {
    const label = rule.description?.split("\n")[0] ?? "";
    for (const m of rule.manipulators.filter(isBasic)) {
      const signature = JSON.stringify(m.from);
      const owner = seen.get(signature);
      assert.ok(
        owner === undefined || owner === label,
        `trigger ${signature} is claimed by both "${owner}" and "${label}"`,
      );
      seen.set(signature, label);
    }
  }
});
