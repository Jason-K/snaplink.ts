import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_HANDLERS,
  ACTION_SPEC_TYPES,
  actionToEvents,
  describeAction,
  isActionSpec,
  resolveActionToEvents,
  key,
  resolveShellCommand,
} from "../engine";

/**
 * The action handler registry is the single source of truth for what each
 * `ActionSpec` variant compiles to, how it is described, and whether it runs a
 * shell command.
 *
 * Coverage is enforced at compile time by `satisfies ActionHandlers` in
 * action-handlers.ts — omitting a variant fails typecheck with the missing tag
 * named. These tests cover the runtime-observable half of that contract.
 */

test("ACTION_SPEC_TYPES is derived from the registry, not hand-maintained", () => {
  assert.deepEqual(
    [...ACTION_SPEC_TYPES].sort(),
    Object.keys(ACTION_HANDLERS).sort(),
  );
});

test("every handler supplies toEvents and describe", () => {
  for (const [type, handler] of Object.entries(ACTION_HANDLERS)) {
    assert.equal(typeof handler.toEvents, "function", `${type}.toEvents`);
    assert.equal(typeof handler.describe, "function", `${type}.describe`);
  }
});

test("isActionSpec distinguishes typed actions from raw ToEvents", () => {
  assert.equal(isActionSpec({ type: "copy" }), true);
  assert.equal(isActionSpec({ key_code: "a" }), false);
  // A raw event that happens to carry a `type` key is still not an ActionSpec.
  assert.equal(isActionSpec({ type: "not_a_real_action" } as never), false);
});

test("actions with no shell form report null rather than an empty command", () => {
  assert.equal(resolveShellCommand({ type: "copy" }), null);
  assert.equal(resolveShellCommand({ type: "key", key: "a" }), null);
  assert.equal(
    resolveShellCommand({ type: "shell", command: "echo hi" }),
    "echo hi",
  );
});

test("noop compiles to no events at all", () => {
  assert.deepEqual(actionToEvents({ type: "noop" }), []);
});

test("sequence flattens nested actions in order", () => {
  const events = actionToEvents({
    type: "sequence",
    actions: [{ type: "copy" }, { type: "paste" }],
  });

  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { key_code: "c", modifiers: ["command"] });
  assert.deepEqual(events[1], { key_code: "v", modifiers: ["command"] });
});

test("sequence describes its members joined by 'then'", () => {
  assert.equal(
    describeAction({
      type: "sequence",
      actions: [{ type: "cut" }, { type: "paste" }],
    }),
    "Cut selection then Paste selection",
  );
});

test("key actions expand virtual-modifier aliases", () => {
  const [event] = actionToEvents({ type: "key", key: "f5", modifiers: ["COCS"] });
  assert.deepEqual(event, {
    key_code: "f5",
    modifiers: ["command", "option", "control", "shift"],
  });
});

test("raw ToEvents pass through resolveActionToEvents untouched", () => {
  const raw = { pointing_button: "button1" } as const;
  assert.deepEqual(resolveActionToEvents(raw), [raw]);
});

test("shell commands are path-quote normalized on the way out", () => {
  const [event] = resolveActionToEvents({
    type: "shell",
    command: "open /Applications/Some App.app",
  });
  assert.match(String((event as { shell_command: string }).shell_command), /"/);
});

test("actionDesc is appended to the derived description", () => {
  assert.equal(
    describeAction({ type: "key", key: "a", actionDesc: "select all" }),
    "Emit 'A' | select all",
  );
});

/**
 * `to_if_alone` posts key_down and key_up together, so a key that must be
 * *held* to register does nothing without an explicit gap (gotchas 5.7, 5.8,
 * 7.4). `caps_lock` is the canonical case at roughly 200 ms.
 */
test("hold_down_milliseconds reaches the emitted event", () => {
  const [event] = resolveActionToEvents(
    key("caps_lock", { hold_down_milliseconds: 200 }),
  );
  assert.deepEqual(event, {
    key_code: "caps_lock",
    repeat: false,
    hold_down_milliseconds: 200,
  });
});

test("hold_down_milliseconds survives modifiers and coexists with halt", () => {
  const [event] = resolveActionToEvents(
    key("a", ["cmd"], { hold_down_milliseconds: 50, halt: true }),
  );
  assert.deepEqual(event, {
    key_code: "a",
    // `cmd` resolves to `command`; in a `to` event that name IS the left
    // variant, unlike in `from.modifiers` where it means either side (3.4).
    modifiers: ["command"],
    repeat: false,
    halt: true,
    hold_down_milliseconds: 50,
  });
});

test("omitting hold_down_milliseconds emits no such key", () => {
  const [event] = resolveActionToEvents(key("a"));
  assert.ok(event && !("hold_down_milliseconds" in event));
});
