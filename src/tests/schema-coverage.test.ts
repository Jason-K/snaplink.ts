/**
 * Guards the DSL's coverage of Karabiner's capability surface.
 *
 * Two directions, both cheap:
 *   - a feature that loses its wrapper fails here rather than silently becoming
 *     unreachable;
 *   - a feature that gains one fails here too, until it is struck off
 *     {@link KNOWN_UNWIRED} — which keeps that list honest instead of letting it
 *     rot into a list of things that were unwired once.
 *
 * Run `npm run coverage` for the full table.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { schemaCoverage } from "../coverage";

/**
 * Karabiner features this configuration cannot currently emit, as
 * `group:name`. Every entry is a capability the schema documents and the DSL
 * has no wrapper for — a candidate to add, not a defect.
 */
const KNOWN_UNWIRED = new Set([
  "from:apple_vendor_keyboard_key_code",
  "from:apple_vendor_top_case_key_code",
  "from:generic_desktop",
  "from:integer_value",
  "to action:apple_vendor_keyboard_key_code",
  "to action:apple_vendor_top_case_key_code",
  "to action:generic_desktop",
  "to action:select_input_source",
  "to action:set_notification_message",
  "to option:held_down_milliseconds",
]);

const id = (f: { group: string; name: string }): string => `${f.group}:${f.name}`;

test("no wrapper regressed into unreachable", () => {
  for (const feature of schemaCoverage().features) {
    if (feature.wired) continue;
    assert.ok(
      KNOWN_UNWIRED.has(id(feature)),
      `${id(feature)} lost its wrapper — the DSL can no longer emit it`,
    );
  }
});

test("KNOWN_UNWIRED has no stale entries", () => {
  const unwired = new Set(
    schemaCoverage().features.filter((f) => !f.wired).map(id),
  );
  for (const entry of KNOWN_UNWIRED) {
    assert.ok(
      unwired.has(entry),
      `${entry} is wired now — remove it from KNOWN_UNWIRED`,
    );
  }
});

test("anything the build emits is reachable by definition", () => {
  // A self-check on the detection heuristics rather than on the DSL: if a
  // feature appears in karabiner-output.json, something in the emitter produced
  // it, so reporting it as unwired means the scan missed a construction site.
  for (const feature of schemaCoverage().features) {
    if (feature.emitted === 0) continue;
    assert.ok(
      feature.wired,
      `${id(feature)} is emitted ${feature.emitted}x but scanned as unwired — the coverage heuristic missed it`,
    );
  }
});
