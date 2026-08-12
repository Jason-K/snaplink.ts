/**
 * Drift guard between the hand-written AST in `src/types/karabiner.ts` and
 * `schema/karabiner-rule.schema.json`.
 *
 * The types cannot express everything the schema does (clamps, cross-field
 * rules), and the schema is not a compiler. This test covers the one gap that
 * bites hardest: unknown keys are ignored at file and rule level but are hard
 * errors inside `manipulators` (gotcha 10.5), so a stray key we emit fails at
 * load time with no warning from `tsc`.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildRules } from "../config";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

type SchemaDef = { properties?: Record<string, unknown> };
type Schema = { $defs: Record<string, SchemaDef> };

const schema = JSON.parse(
  readFileSync(join(REPO, "schema", "karabiner-rule.schema.json"), "utf8"),
) as Schema;

function allowedKeys(def: string): Set<string> {
  const properties = schema.$defs[def]?.properties;
  assert.ok(properties, `schema is missing $defs.${def}.properties`);
  return new Set(Object.keys(properties));
}

const MANIPULATOR_DEF: Record<string, string> = {
  basic: "manipulatorBasic",
  mouse_basic: "manipulatorMouseBasic",
  mouse_motion_to_scroll: "manipulatorMouseMotionToScroll",
};

test("every manipulator key we emit is known to the schema", () => {
  const { rules } = buildRules();
  assert.ok(rules.length > 0, "buildRules() produced no rules");

  for (const rule of rules) {
    for (const manipulator of rule.manipulators) {
      const def = MANIPULATOR_DEF[manipulator.type];
      assert.ok(def, `unknown manipulator type "${manipulator.type}" in "${rule.description}"`);
      const allowed = allowedKeys(def);
      for (const key of Object.keys(manipulator)) {
        assert.ok(
          allowed.has(key),
          `unknown ${manipulator.type} key "${key}" in rule "${rule.description}"`,
        );
      }
    }
  }
});

test("every parameter name we emit is a real parameter", () => {
  // Unrecognized parameter names are silently ignored by the parser (9.3), so
  // a typo here is invisible at runtime and at build time.
  const allowed = allowedKeys("parameters");
  for (const rule of buildRules().rules) {
    for (const manipulator of rule.manipulators) {
      if (manipulator.type !== "basic" || !manipulator.parameters) continue;
      for (const key of Object.keys(manipulator.parameters)) {
        assert.ok(allowed.has(key), `unknown parameter "${key}" in rule "${rule.description}"`);
      }
    }
  }
});

test("no `to` entry is emitted without an action", () => {
  // An entry with no event key parses but does nothing (5.1).
  const options = new Set([
    "modifiers",
    "lazy",
    "repeat",
    "halt",
    "hold_down_milliseconds",
    "held_down_milliseconds",
    "conditions",
    "description",
  ]);
  const channels = ["to", "to_if_alone", "to_if_held_down", "to_after_key_up"] as const;

  for (const rule of buildRules().rules) {
    for (const manipulator of rule.manipulators) {
      if (manipulator.type !== "basic") continue;
      for (const channel of channels) {
        for (const event of manipulator[channel] ?? []) {
          const actions: string[] = Object.keys(event).filter((k) => !options.has(k));
          assert.equal(
            actions.length,
            1,
            `${channel} entry in "${rule.description}" has ${actions.length} actions: ${actions.join(", ") || "none"}`,
          );
        }
      }
    }
  }
});
