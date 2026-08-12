import assert from "node:assert/strict";
import test from "node:test";

import { buildRules } from "../config";
import type { BasicManipulator, Manipulator, Rule } from "../types/karabiner";

/**
 * Structural invariants over the compiled configuration.
 *
 * These assert properties that must hold for *any* keymap, so they keep
 * signalling as the personal configuration changes. Assertions about which
 * specific rules exist belong in the golden file, not here.
 */

const { rules } = buildRules();

function allManipulators(): Array<{ rule: Rule; manipulator: Manipulator }> {
  return rules.flatMap((rule) =>
    rule.manipulators.map((manipulator) => ({ rule, manipulator })),
  );
}

function isBasic(m: Manipulator): m is BasicManipulator {
  return m.type === "basic";
}

/** First line of a rule description, for readable failure messages. */
function label(rule: Rule): string {
  return rule.description?.split("\n")[0] ?? "(no description)";
}

test("the configuration compiles to a non-empty rule list", () => {
  assert.ok(rules.length > 0, "no rules were generated");
});

test("every rule carries a description", () => {
  for (const rule of rules) {
    assert.ok(
      rule.description && rule.description.trim().length > 0,
      `rule at index ${rules.indexOf(rule)} has no description`,
    );
  }
});

test("every rule has at least one manipulator", () => {
  for (const rule of rules) {
    assert.ok(
      Array.isArray(rule.manipulators) && rule.manipulators.length > 0,
      `rule "${label(rule)}" has no manipulators`,
    );
  }
});

test("every manipulator declares a type and a from event", () => {
  for (const { rule, manipulator } of allManipulators()) {
    assert.ok(manipulator.type, `manipulator in "${label(rule)}" has no type`);
    if (isBasic(manipulator)) {
      assert.ok(manipulator.from, `basic manipulator in "${label(rule)}" has no from`);
    }
  }
});

test("every from event matches exactly one input shape", () => {
  const shapes = ["key_code", "consumer_key_code", "pointing_button", "any", "simultaneous"];
  for (const { rule, manipulator } of allManipulators()) {
    if (!isBasic(manipulator)) continue;
    const present = shapes.filter((k) => k in manipulator.from);
    assert.equal(
      present.length,
      1,
      `"${label(rule)}": from must declare exactly one of ${shapes.join("/")}, got [${present}]`,
    );
  }
});

/** Keys that identify what a `to` event *does*; exactly one must be present. */
const TO_EVENT_KEYS = [
  "key_code",
  "consumer_key_code",
  "pointing_button",
  "shell_command",
  "select_input_source",
  "set_variable",
  "set_notification_message",
  "mouse_key",
  "sticky_modifier",
  "software_function",
  "generic_desktop",
  "send_user_command",
  "from_event",
];

test("every emitted to-event declares exactly one event kind", () => {
  for (const { rule, manipulator } of allManipulators()) {
    if (!isBasic(manipulator)) continue;
    const channels: Array<[string, unknown]> = [
      ["to", manipulator.to],
      ["to_if_alone", manipulator.to_if_alone],
      ["to_if_held_down", manipulator.to_if_held_down],
      ["to_after_key_up", manipulator.to_after_key_up],
      ["to_if_other_key_pressed", manipulator.to_if_other_key_pressed],
      ["to_delayed_action.to_if_invoked", manipulator.to_delayed_action?.to_if_invoked],
      ["to_delayed_action.to_if_canceled", manipulator.to_delayed_action?.to_if_canceled],
    ];

    for (const [channel, events] of channels) {
      if (!Array.isArray(events)) continue;
      events.forEach((event, i) => {
        const present = TO_EVENT_KEYS.filter((k) => k in (event as object));
        assert.equal(
          present.length,
          1,
          `"${label(rule)}" ${channel}[${i}]: expected exactly one event kind, got [${present}]`,
        );
      });
    }
  }
});

test("every variable read by a condition is written somewhere in the config", () => {
  // Karabiner populates its own namespaced variables (frontmost_application.*,
  // accessibility.*, system.*, …); only unqualified names are ours to set.
  const isKarabinerBuiltIn = (name: string) => name.includes(".");

  const written = new Set<string>();
  const read = new Map<string, string>();

  const collectWrites = (events: unknown): void => {
    if (!events || typeof events !== "object") return;
    if (Array.isArray(events)) {
      events.forEach(collectWrites);
      return;
    }
    const record = events as Record<string, unknown>;
    const setVariable = record.set_variable as { name?: string } | undefined;
    if (setVariable?.name) written.add(setVariable.name);
    Object.values(record).forEach(collectWrites);
  };

  for (const { rule, manipulator } of allManipulators()) {
    collectWrites(manipulator);
    if (!isBasic(manipulator)) continue;
    for (const condition of manipulator.conditions ?? []) {
      if (condition.type === "variable_if" || condition.type === "variable_unless") {
        const name = (condition as any).name;
        if (!read.has(name)) read.set(name, label(rule));
      }
      if (condition.type === "expression_if" || condition.type === "expression_unless") {
        const name = (condition as any).expression.split(" ")[0];
        if (!read.has(name)) read.set(name, label(rule));
      }
    }
  }

  const dangling = [...read].filter(
    ([name]) => !written.has(name) && !isKarabinerBuiltIn(name),
  );
  assert.deepEqual(
    dangling,
    [],
    "conditions read variables that no rule ever sets — these conditions can never become true:\n" +
      dangling.map(([name, where]) => `  ${name} (first read in "${where}")`).join("\n"),
  );
});

test("timing parameters are non-negative integers", () => {
  // 0 is meaningful: a zero hold threshold asserts the hold branch immediately,
  // which is how a button signals "held" state without a delay.
  for (const { rule, manipulator } of allManipulators()) {
    if (!isBasic(manipulator)) continue;
    for (const [key, value] of Object.entries(manipulator.parameters ?? {})) {
      assert.ok(
        Number.isInteger(value) && (value as number) >= 0,
        `"${label(rule)}": parameter ${key} is ${value}, expected a non-negative integer`,
      );
    }
  }
});

test("no leader-suppression variables leak in when no leader is configured", () => {
  assert.ok(
    !JSON.stringify(rules).includes("space_"),
    "output contains space_ leader variables although no leader is active",
  );
});
