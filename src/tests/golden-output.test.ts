import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildRules } from "../config";
import type { Rule } from "../types/karabiner";

/**
 * Golden-file regression test.
 *
 * `karabiner-output.json` is committed, so any engine change that alters the
 * compiled configuration shows up as a reviewable diff instead of silently
 * changing what gets written to `~/.config/karabiner/karabiner.json`.
 *
 * When a diff is intentional, regenerate with:
 *
 *     UPDATE_GOLDEN=1 npm test
 *
 * and review the resulting `karabiner-output.json` diff before committing.
 */

const PROJECT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const GOLDEN_PATH = join(PROJECT_ROOT, "karabiner-output.json");

function serialize(rules: Rule[]): string {
  return `${JSON.stringify({ complex_modifications: { rules } }, null, 2)}\n`;
}

test("compiled rules match the committed karabiner-output.json golden file", () => {
  const actual = serialize(buildRules().rules);

  if (process.env.UPDATE_GOLDEN) {
    writeFileSync(GOLDEN_PATH, actual);
    return;
  }

  const expected = readFileSync(GOLDEN_PATH, "utf8");
  if (actual === expected) return;

  // A full-file diff is unreadable; report the first divergent rule instead.
  const actualRules = JSON.parse(actual).complex_modifications.rules as Rule[];
  const expectedRules = JSON.parse(expected).complex_modifications.rules as Rule[];

  assert.equal(
    actualRules.length,
    expectedRules.length,
    `rule count changed (${expectedRules.length} → ${actualRules.length}). ` +
      "Re-run with UPDATE_GOLDEN=1 if intentional.",
  );

  for (let i = 0; i < expectedRules.length; i++) {
    const a = JSON.stringify(actualRules[i]);
    const e = JSON.stringify(expectedRules[i]);
    if (a !== e) {
      assert.fail(
        `rule ${i} ("${expectedRules[i]?.description?.split("\n")[0]}") changed.\n` +
          `  expected: ${e.slice(0, 400)}\n` +
          `  actual:   ${a.slice(0, 400)}\n` +
          "Re-run with UPDATE_GOLDEN=1 if intentional.",
      );
    }
  }

  assert.fail("golden file differs only in formatting; re-run with UPDATE_GOLDEN=1");
});
