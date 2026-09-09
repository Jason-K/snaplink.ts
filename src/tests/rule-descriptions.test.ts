import assert from 'node:assert/strict';
import test from 'node:test';

import { formatRuleDescription } from "../engine/resolve-description/rule-descriptions";

test('formats modifier chords with symbol brackets', () => {
  assert.equal(
    formatRuleDescription("right_option+a", "Antinote", "tap"),
    "[⌥>]+[A]        →    Antinote (on tap)",
  );
});

test('formats plain keys with short labels', () => {
  assert.equal(
    formatRuleDescription("return_or_enter", "Evaluate selection", "hold"),
    "[⏎]        →    Evaluate selection (on hold)",
  );
});

test('formats multi-step layer chords as bracketed sequences', () => {
  assert.equal(
    formatRuleDescription(["spacebar", "a", "w"], "Work layer", "tap"),
    "[␣]+[A]+[W]        →    Work layer (on tap)",
  );
});
