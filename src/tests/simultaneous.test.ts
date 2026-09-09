import assert from "node:assert/strict";
import test from "node:test";
import {
  bind,
  chord,
  detectKeyDownUninterruptedly,
  from,
  generateSimultaneousRules,
  hold,
  key,
  options,
  press,
  release,
  simultaneous,
  simultaneousTiming,
  threshold,
  timing,
  to,
  uninterrupted,
  withOptions,
  withTiming,
} from "../engine";
import type { Binding } from "../engine";

function toRule(input: any): any {
  return typeof input?.build === "function" ? input.build() : input;
}

const noTapHold: Binding[] = [];

// ── Direct remap (to) path ───────────────────────────────────────────────────

test("generateSimultaneousRules accepts Binding[] constructed via simultaneous DSL", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("left_option", "right_option"),
        to(press(key("slash", ["right_control"]))),
      ),
    ],
    noTapHold,
  );
  assert.equal(rules.length, 1);
  const rule = toRule(rules[0]);
  assert.equal(rule.description, "[⌥]+[⌥]:\n---\n\tOn Tap:\n\t\tAlways:\tEmit ⌃> + '/'");
  const m = rule.manipulators[0];
  assert.equal(m.type, "basic");
  assert.deepEqual(m.from.simultaneous, [
    { key_code: "left_option" },
    { key_code: "right_option" },
  ]);
  assert.deepEqual(m.from.modifiers, { optional: ["any"] });
  assert.deepEqual(m.to, [
    {
      key_code: "slash",
      modifiers: ["right_control"],
      repeat: false,
    },
  ]);
});

test("direct remap (to): produces basic simultaneous manipulator with to property and no tap-hold parameters", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("left_option", "right_option"),
        to(press(key("slash", ["right_control"]))),
        options({ description: "Both ⌥ keys pressed" }),
      ),
    ],
    noTapHold,
  );
  const rule = toRule(rules[0]);
  assert.equal(rule.description, "Both ⌥ keys pressed");
  assert.equal(rule.manipulators.length, 1);
  const m = rule.manipulators[0];
  assert.equal(m.type, "basic");
  assert.deepEqual(m.from.simultaneous, [
    { key_code: "left_option" },
    { key_code: "right_option" },
  ]);
  assert.deepEqual(m.from.modifiers, { optional: ["any"] });
  assert.deepEqual(m.to, [
    {
      key_code: "slash",
      modifiers: ["right_control"],
      repeat: false,
    },
  ]);
  assert.equal(m.parameters, undefined);
  assert.equal(m.to_if_alone, undefined);
  assert.equal(m.to_if_held_down, undefined);
  assert.equal(m.to_delayed_action, undefined);
});

// ── Tap-hold path ─────────────────────────────────────────────────────────────

test("tap-hold: from.simultaneous contains the chord keys", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape"))),
        options({ description: "J+K" }),
      ),
    ],
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
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape")), hold(key("f1"))),
        options({ description: "J+K" }),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.ok(Array.isArray(m.to_if_alone) && m.to_if_alone.length > 0, "should have to_if_alone");
  assert.ok(Array.isArray(m.to_if_held_down) && m.to_if_held_down.length > 0, "should have to_if_held_down");
});

// ── Multi-tap path ─────────────────────────────────────────────────────────────

test("multi-tap: produces two manipulators", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape")), release(key("f1")).withTapCount(2)),
        options({ description: "J+K", timing: { aloneMs: 300, heldThresholdMs: 300 } }),
      ),
    ],
    noTapHold,
  );
  const rule = toRule(rules[0]);
  assert.equal(rule.manipulators.length, 2);
});

test("multi-tap: second manipulator has sim_tap_{label} variable condition", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("f1")).withTapCount(2)),
        options({ description: "J+K", timing: { aloneMs: 300, heldThresholdMs: 300 } }),
      ),
    ],
    noTapHold,
  );
  const secondManipulator = toRule(rules[0]).manipulators[0]; // [0] = secondTap
  assert.ok(
    secondManipulator?.conditions?.some((c: any) => c.type === "variable_if" && c.name.startsWith("sim_tap_jk")),
    "Expected sim_tap_jk variable condition on second manipulator",
  );
});

test("multi-tap: chord from event appears on both manipulators", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("f1")).withTapCount(2)),
        options({ description: "J+K", timing: { aloneMs: 300, heldThresholdMs: 300 } }),
      ),
    ],
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
    [
      bind(
        simultaneous("j", "k", "strict"),
        to(release(key("escape"))),
        options({ description: "J+K" }),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.key_down_order, "strict");
});

test("simultaneous_options: absent when config has none", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape"))),
        options({ description: "J+K" }),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options, undefined);
});

test("simultaneous_options: to_after_key_up is resolved and emitted", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape"))),
        options({ description: "J+K", afterKeyUp: [key("f2")] }),
      ),
    ],
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
    [
      bind(
        simultaneous("j", "k"),
        to(release(key("escape"))),
        options({ description: "J+K", timing: { simultaneousMs: 100 } }),
      ),
    ],
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
        [
          bind(simultaneous("j", "k"), to(release(key("escape"))), options({ description: "First" })),
          bind(simultaneous("k", "j"), to(release(key("f1"))), options({ description: "Second" })),
        ],
        noTapHold,
      ),
    /duplicate/i,
  );
});

test("conflict 1: strict-order [j,k] and [k,j] are NOT duplicates", () => {
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      [
        bind(simultaneous("j", "k", "strict"), to(release(key("escape"))), options({ description: "First" })),
        bind(simultaneous("k", "j", "strict"), to(release(key("f1"))), options({ description: "Second" })),
      ],
      noTapHold,
    ),
  );
});

test("conflict 1: same keys with different key_down_order are NOT duplicates", () => {
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      [
        bind(simultaneous("j", "k", "strict"), to(release(key("escape"))), options({ description: "Strict" })),
        bind(simultaneous("j", "k"), to(release(key("f1"))), options({ description: "Insensitive" })),
      ],
      noTapHold,
    ),
  );
});

// ── Tap-hold key overlap ──────────────────────────────────────────────────────

test("tap-hold overlap: simultaneous chord key can match a bare tap-hold key without conflict", () => {
  const jBare: Binding[] = [
    bind("j", to(hold(key("j")))),
  ];
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      [
        bind(simultaneous("j", "k"), to(release(key("escape"))), options({ description: "J+K" })),
      ],
      jBare,
    ),
  );
  const rules = generateSimultaneousRules(
    [
      bind(simultaneous("j", "k"), to(release(key("escape"))), options({ description: "J+K" })),
    ],
    jBare,
  );
  assert.equal(rules.length, 1);
});

test("tap-hold overlap: modifier-prefixed tap-hold key does NOT conflict", () => {
  const jModded: Binding[] = [
    bind(from("j", ["left_command"]), to(hold(key("f1")))),
  ];
  assert.doesNotThrow(() =>
    generateSimultaneousRules(
      [
        bind(simultaneous("j", "k"), to(release(key("escape"))), options({ description: "J+K" })),
      ],
      jModded,
    ),
  );
});

// ── Input validation ───────────────────────────────────────────────────────────

test("throws when keys has fewer than 2 entries", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        [{ trigger: { keys: ["j"] }, cases: [{ phase: "release", do: [key("escape")] }] } as any],
        noTapHold,
      ),
    /at least 2 keys/i,
  );
});

test("throws when no action cases are specified", () => {
  assert.throws(
    () =>
      generateSimultaneousRules(
        [{ trigger: { keys: ["j", "k"] }, cases: [] } as any],
        noTapHold,
      ),
    /no action cases/i,
  );
});

// ── Ergonomic Syntax & Per-Rule Tuning ──────────────────────────────────────────

test("fluent chaining: .uninterrupted().timing(30) sets options and threshold", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k").uninterrupted().timing(30),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("fluent chaining: .detectKeyDownUninterruptedly().threshold(25) sets options and threshold", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k").detectKeyDownUninterruptedly().threshold(25),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 25);
});

test("fluent chaining: chord().strict().uninterrupted()", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        chord("e", "k").strict().uninterrupted(),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.key_down_order, "strict");
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
});

test("trigger options object: { uninterrupted: true, timing: 30 }", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous({ keys: ["e", "k"], uninterrupted: true, timing: 30 }),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("trigger options object: { detect_key_down_uninterruptedly: true, simultaneousMs: 25 }", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous({
          keys: ["e", "k"],
          detect_key_down_uninterruptedly: true,
          simultaneousMs: 25,
        }),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 25);
});

test("trigger options object: { detectUninterrupted: true, thresholdMs: 35 }", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous({
          keys: ["e", "k"],
          detectUninterrupted: true,
          thresholdMs: 35,
        }),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 35);
});

test("shorthand arguments: simultaneous('e', 'k', 'uninterrupted', 30)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k", "uninterrupted", 30),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("shorthand arguments: simultaneous('e', 'k', 30)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k", 30),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("shorthand arguments: simultaneous(['e', 'k'], 'uninterrupted', 30)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous(["e", "k"], "uninterrupted", 30),
        to(press(key("a"))),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("helper wrappers in bind(): uninterrupted(), timing(30)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k"),
        to(press(key("a"))),
        uninterrupted(),
        timing(30),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("helper wrappers in bind(): detectKeyDownUninterruptedly(), threshold(25)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k"),
        to(press(key("a"))),
        detectKeyDownUninterruptedly(),
        threshold(25),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 25);
});

test("helper wrappers in bind(): simultaneousTiming(35)", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k"),
        to(press(key("a"))),
        simultaneousTiming(35),
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 35);
});

test("inline options in bind(): { detect_key_down_uninterruptedly: true, simultaneousMs: 30 }", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k"),
        to(press(key("a"))),
        { detect_key_down_uninterruptedly: true, simultaneousMs: 30 },
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("inline options in bind(): { uninterrupted: true, thresholdMs: 25 }", () => {
  const rules = generateSimultaneousRules(
    [
      bind(
        simultaneous("e", "k"),
        to(press(key("a"))),
        { uninterrupted: true, thresholdMs: 25 },
      ),
    ],
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 25);
});

test("scoped combinators: withTiming(30, [...])", () => {
  const rules = generateSimultaneousRules(
    withTiming(30, [
      bind(simultaneous("e", "k"), to(press(key("a")))),
    ]),
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

test("scoped combinators: withOptions({ uninterrupted: true, simultaneousMs: 30 }, [...])", () => {
  const rules = generateSimultaneousRules(
    withOptions({ uninterrupted: true, simultaneousMs: 30 }, [
      bind(simultaneous("e", "k"), to(press(key("a")))),
    ]),
    noTapHold,
  );
  const m = toRule(rules[0]).manipulators[0];
  assert.equal(m.from.simultaneous_options?.detect_key_down_uninterruptedly, true);
  assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], 30);
});

