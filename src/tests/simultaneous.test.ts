import assert from "node:assert/strict";
import test from "node:test";
import { generateSimultaneousRules } from "../engine";
import type { Binding, SimultaneousConfig } from "../engine";

function toRule(input: any): any {
  return typeof input?.build === "function" ? input.build() : input;
}

const noTapHold: Binding[] = [];

// ── Tap-hold path ─────────────────────────────────────────────────────────────

test("tap-hold: from.simultaneous contains the chord keys", () => {
  const rules = generateSimultaneousRules(
    { jk: { keys: ["j", "k"], description: "J+K", alone: [{ type: "key", key: "escape" }] } },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.ok(Array.isArray(m.from.simultaneous), "from.simultaneous should be an array");
  assert.deepEqual(
    m.from.simultaneous.map((e: any) => e.key_code),
    ["j", "k"],
  );
});

test("tap-hold: produces to_if_alone and to_if_held_down", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        alone: [{ type: "key", key: "escape" }],
        hold: [{ type: "key", key: "f1" }],
      },
    },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.ok(Array.isArray(m.to_if_alone) && m.to_if_alone.length > 0, "should have to_if_alone");
  assert.ok(Array.isArray(m.to_if_held_down) && m.to_if_held_down.length > 0, "should have to_if_held_down");
});

// ── Multi-tap path ─────────────────────────────────────────────────────────────

test("multi-tap: produces two manipulators", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        alone: [{ type: "key", key: "escape" }],
        tapTap: [{ type: "key", key: "f1" }],
        thresholdMs: 300,
      },
    },
    noTapHold,
  );
  const rule = toRule(rules[0]);
  assert.equal(rule.manipulators.length, 2);
});

test("multi-tap: second manipulator has sim_tap_{label} variable condition", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        tapTap: [{ type: "key", key: "f1" }],
        thresholdMs: 300,
      },
    },
    noTapHold,
  );
  const secondManipulator = toRule(rules[0]).manipulators[0]; // [0] = secondTap (varTapTapHoldFrom returns [secondTap, firstTap])
  assert.ok(
    secondManipulator?.conditions?.some((c: any) => c.type === "variable_if" && c.name.startsWith("sim_tap_jk")),
    "Expected sim_tap_jk variable condition on second manipulator",
  );
});

test("multi-tap: chord from event appears on both manipulators", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        tapTap: [{ type: "key", key: "f1" }],
        thresholdMs: 300,
      },
    },
    noTapHold,
  );
  const { manipulators } = toRule(rules[0]);
  for (const m of manipulators) {
    assert.ok(Array.isArray(m.from.simultaneous), "Both manipulators must have from.simultaneous");
  }
});

// ── simultaneous_options ───────────────────────────────────────────────────────

test("simultaneous_options: key_down_order is emitted when set", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        alone: [{ type: "key", key: "escape" }],
        simultaneousOptions: { key_down_order: "strict" },
      },
    },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.key_down_order, "strict");
});

test("simultaneous_options: absent when config has none", () => {
  const rules = generateSimultaneousRules(
    { jk: { keys: ["j", "k"], description: "J+K", alone: [{ type: "key", key: "escape" }] } },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options, undefined);
});

test("simultaneous_options: to_after_key_up is resolved and emitted", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        alone: [{ type: "key", key: "escape" }],
        simultaneousOptions: {
          to_after_key_up: [{ type: "key", key: "f2" }],
        },
      },
    },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.ok(
    Array.isArray(m.from.simultaneous_options?.to_after_key_up) &&
      m.from.simultaneous_options.to_after_key_up.length > 0,
    "to_after_key_up should appear in from.simultaneous_options",
  );
});

// ── simultaneousThresholdMs ────────────────────────────────────────────────────

test("simultaneousThresholdMs: emitted as basic.simultaneous_threshold_milliseconds", () => {
  const rules = generateSimultaneousRules(
    {
      jk: {
        keys: ["j", "k"],
        description: "J+K",
        alone: [{ type: "key", key: "escape" }],
        simultaneousThresholdMs: 100,
      },
    },
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 100);
});

// ── Conflict check 1: duplicate chords ────────────────────────────────────────

test("conflict 1: throws on duplicate insensitive chords regardless of key order", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        {
          jk_a: { keys: ["j", "k"], description: "First", alone: [{ type: "key", key: "escape" }] },
          jk_b: { keys: ["k", "j"], description: "Second", alone: [{ type: "key", key: "f1" }] },
        },
        noTapHold,
      ),
    /duplicate/i,
  );
});

test("conflict 1: strict-order [j,k] and [k,j] are NOT duplicates", () => {
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      {
        jk: {
          keys: ["j", "k"],
          description: "First",
          alone: [{ type: "key", key: "escape" }],
          simultaneousOptions: { key_down_order: "strict" },
        },
        kj: {
          keys: ["k", "j"],
          description: "Second",
          alone: [{ type: "key", key: "f1" }],
          simultaneousOptions: { key_down_order: "strict" },
        },
      },
      noTapHold,
    ),
  );
});

test("conflict 1: same keys with different key_down_order are NOT duplicates", () => {
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      {
        jk_strict: {
          keys: ["j", "k"],
          description: "Strict",
          alone: [{ type: "key", key: "escape" }],
          simultaneousOptions: { key_down_order: "strict" },
        },
        jk_insensitive: {
          keys: ["j", "k"],
          description: "Insensitive",
          alone: [{ type: "key", key: "f1" }],
        },
      },
      noTapHold,
    ),
  );
});

// ── Conflict check 2: tap-hold key overlap ────────────────────────────────────

test("conflict 2: throws when a simultaneous key matches a bare tap-hold key", () => {
  const jBare: Binding[] = [
    { trigger: { keys: ["j"] }, cases: [{ phase: "hold", do: [{ type: "key", key: "j" }] }] },
  ];
  assert.throws(
    () =>
      generateSimultaneousRules(
        { jk: { keys: ["j", "k"], description: "J+K", alone: [{ type: "key", key: "escape" }] } },
        jBare,
      ),
    /conflict/i,
  );
});

test("conflict 2: modifier-prefixed tap-hold key does NOT conflict", () => {
  const jModded: Binding[] = [
    {
      trigger: { keys: ["j"], modifiers: ["left_command"] },
      cases: [{ phase: "hold", do: [{ type: "key", key: "f1" }] }],
    },
  ];
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      { jk: { keys: ["j", "k"], description: "J+K", alone: [{ type: "key", key: "escape" }] } },
      jModded,
    ),
  );
});

// ── Input validation ───────────────────────────────────────────────────────────

test("throws when tapTap and tapTapHold are both specified", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        {
          jk: {
            keys: ["j", "k"],
            description: "Bad",
            tapTap: [{ type: "key", key: "escape" }],
            tapTapHold: [{ type: "key", key: "f1" }],
            thresholdMs: 300,
          },
        },
        noTapHold,
      ),
    /mutually exclusive/i,
  );
});

test("throws when keys has fewer than 2 entries", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        { j: { keys: ["j"], description: "Single", alone: [{ type: "key", key: "escape" }] } },
        noTapHold,
      ),
    /at least 2 keys/i,
  );
});

test("throws when no action fields are specified", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        { jk: { keys: ["j", "k"], description: "No-op" } as SimultaneousConfig },
        noTapHold,
      ),
    /no action/i,
  );
});
