import assert from "node:assert/strict";
import test from "node:test";

import { APPS, PATHS } from "../data";
import { buildManipulators, defineBindings, normalizeModifier, resolveCondition, resolveModifiers, triggerToFrom } from "../engine/emit-manipulators/compile-binding";
import type { Binding } from "../data";

test("resolveCondition app if -> frontmost_application_if (AppRef)", () => {
  const c = resolveCondition({
    app: APPS.excel,
  }) as any;
  assert.equal(c.type, "frontmost_application_if");
  assert.deepEqual(c.bundle_identifiers, ["com.microsoft.Excel"]);
  assert.equal(c.file_paths, undefined);
});

test("resolveCondition path if -> frontmost_application_if (PathRef)", () => {
  const c = resolveCondition({
    app: PATHS.appsDir,
  }) as any;
  assert.equal(c.type, "frontmost_application_if");
  assert.deepEqual(c.file_paths, ["/Applications"]);
  assert.equal(c.bundle_identifiers, undefined);
});

test("resolveCondition app + path if -> frontmost_application_if (AppRef and PathRef)", () => {
  const c = resolveCondition({
    app: [APPS.excel, PATHS.appsDir],
  }) as any;
  assert.equal(c.type, "frontmost_application_if");
  assert.deepEqual(c.bundle_identifiers, ["com.microsoft.Excel"]);
  assert.deepEqual(c.file_paths, ["/Applications"]);
});

test("resolveCondition app unless -> frontmost_application_unless", () => {
  const c = resolveCondition({
    app: [
      { type: "app", bundleId: "a", refDesc: "A" },
      { type: "app", bundleId: "b", refDesc: "B" },
    ],
    unless: true,
  }) as any;
  assert.equal(c.type, "frontmost_application_unless");
  assert.deepEqual(c.bundle_identifiers, ["a", "b"]);
});

test("resolveCondition var if/unless -> variable_if/unless", () => {
  assert.deepEqual(
    resolveCondition({ var: { name: "x", varDesc: "x" }, equals: 1 }) as any,
    { type: "variable_if", name: "x", value: 1 },
  );
  assert.deepEqual(
    resolveCondition({ var: { name: "x", varDesc: "x" }, equals: 1, unless: true }) as any,
    { type: "variable_unless", name: "x", value: 1 },
  );
});

test("triggerToFrom single key without modifiers has no modifiers property", () => {
  assert.deepEqual(triggerToFrom({ keys: ["c"] }) as any, { key_code: "c" });
});

test("triggerToFrom single key with modifiers", () => {
  assert.deepEqual(
    triggerToFrom({ keys: ["a"], modifiers: ["left_command"] }) as any,
    { key_code: "a", modifiers: { mandatory: ["left_command"] } },
  );
});

test("triggerToFrom simultaneous chord", () => {
  const from = triggerToFrom({ keys: ["j", "k"] }) as any;
  assert.deepEqual(from.simultaneous, [{ key_code: "j" }, { key_code: "k" }]);
  assert.deepEqual(from.modifiers, { optional: ["any"] });
});

test("defineBindings remap: one press case -> single manipulator with to", () => {
  const rules = defineBindings([
    {
      description: "[HOME]        →    Move to line start (on tap)",
      trigger: { keys: ["home"] },
      cases: [
        {
          phase: "press",
          do: [{ type: "key", key: "left_arrow", modifiers: ["left_command"] }],
        },
      ],
    },
  ]);
  assert.equal(rules.length, 1);
  // Plan returns BasicRuleBuilder cast as Rule (codebase convention); inspect builder
  // fields directly rather than calling .build(), which would drop description/manipulators.
  const built = rules[0] as any;
  assert.equal(built.description, "[HOME]        →    Move to line start (on tap)");
  const m = built.manipulators[0];
  assert.deepEqual(m.from, { key_code: "home" });
  assert.deepEqual(m.to, [{ key_code: "left_arrow", modifiers: ["left_command"] }]);
});

test("defineBindings remap: noop case -> manipulator with no `to` key", () => {
  const rules = defineBindings([
    {
      description: "swallow",
      trigger: { keys: ["h"], modifiers: ["left_command"] },
      cases: [{ phase: "press", do: [{ type: "noop" }] }],
    },
  ]);
  const built = rules[0] as any;
  const m = built.manipulators[0];
  assert.equal("to" in m, false, "noop must omit the `to` key");
});

test("defineBindings tap-hold: unconditional tap + conditional holds -> no competing unconditional manipulator", () => {
  // Mirrors return_or_enter / keypad_enter: tap passes the key through; hold
  // runs one action outside Excel and another inside. The unconditional tap
  // must NOT become its own no-conditions manipulator, which would intercept
  // the key and block both the normal tap and the conditional holds. Each
  //conditional group carries its own default-alone pass-through instead.
  const rules = defineBindings([
    {
      trigger: { keys: ["return_or_enter"] },
      cases: [
        { phase: "release", do: [{ type: "key", key: "return_or_enter", options: { halt: true } }] },
        {
          phase: "hold",
          conditions: [{ app: APPS.excel, unless: true }],
          do: [{ type: "shell", command: "format-cut-seed" }],
        },
        {
          phase: "hold",
          conditions: [{ app: APPS.excel }],
          do: [{ type: "key", key: "f2", options: { repeat: false } }],
        },
      ],
    },
  ]);
  const built = rules[0] as any;
  // Exactly the two conditional groups — no third, unconditional manipulator.
  assert.equal(built.manipulators.length, 2);
  assert.equal(
    built.manipulators.filter((m: any) => !m.conditions?.length).length,
    0,
    "no manipulator may lack a condition",
  );
  // Every manipulator still passes the key through on tap.
  for (const m of built.manipulators) {
    assert.ok(
      m.to_if_alone.some((e: any) => e.key_code === "return_or_enter"),
      "tap must still emit return_or_enter",
    );
  }
});

test("defineBindings tap-hold: unconditional tap kept when paired with a conditional remap (press)", () => {
  // An unconditional tap next to a conditional *press* (remap) must remain a
  // separate manipulator: a remap has no default-alone pass-through, so folding
  // the tap away would drop it.
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      cases: [
        { phase: "press", conditions: [{ app: APPS.excel }], do: [{ type: "key", key: "down_arrow" }] },
        { phase: "release", do: [{ type: "key", key: "up_arrow" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
});

test("defineBindings tap-hold: conditional taps inherit the unconditional hold", () => {
  // The G9 (middle-back) shape: two mutually exclusive tap cases plus one
  // unconditional hold. Karabiner runs the first matching manipulator and stops,
  // so a hold emitted as its own third manipulator can never be reached — the
  // two tap manipulators between them claim every state. The hold has to be
  // folded into both instead, and the now-covered fallback dropped.
  const held = { var: { name: "l", varDesc: "L" }, equals: 1 } as const;
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      cases: [
        { phase: "release", conditions: [{ ...held, unless: true }], do: [{ type: "key", key: "1" }] },
        { phase: "release", conditions: [held], do: [{ type: "key", key: "2" }] },
        { phase: "hold", do: [{ type: "key", key: "3" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2, "the covered fallback must be dropped");
  for (const m of built.manipulators) {
    assert.ok(m.conditions?.length, "no manipulator may lack a condition");
    assert.equal(m.to_if_held_down[0].key_code, "3", "each tap group carries the hold");
  }
  assert.deepEqual(
    built.manipulators.map((m: any) => m.to_if_alone[0].key_code),
    ["1", "2"],
  );
});

test("defineBindings tap-hold: a conditional hold inherits the unconditional tap", () => {
  // The mirror of the case above — the phases swapped. Shadowing is a property
  // of manipulator matching, not of any one phase, so the fold has to work in
  // both directions. Here the two groups do NOT cover the domain between them
  // (In Excel / In Word leaves every other app uncovered), so the unconditional
  // fallback stays, last.
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      cases: [
        { phase: "release", do: [{ type: "key", key: "1" }] },
        { phase: "hold", conditions: [{ app: APPS.excel }], do: [{ type: "key", key: "2" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
  const [conditional, fallback] = built.manipulators;
  assert.ok(conditional.conditions?.length, "the narrower group is emitted first");
  assert.equal(conditional.to_if_held_down[0].key_code, "2");
  assert.equal(conditional.to_if_alone[0].key_code, "1", "hold group inherits the tap");
  assert.equal(fallback.conditions, undefined);
  assert.equal(fallback.to_if_alone[0].key_code, "1");
});

test("defineBindings tap-hold: a press-only override inherits nothing", () => {
  // The mouse chord idiom: while the right button is held, the button does one
  // immediate thing *instead of* its usual tap/hold. `to` resolves the input on
  // key-down, before any tap/hold arbitration, so stapling the broader group's
  // to_if_alone / to_if_held_down onto it would put the usual gesture back.
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      cases: [
        { phase: "press", conditions: [{ app: APPS.excel }], do: [{ type: "key", key: "1" }] },
        { phase: "release", do: [{ type: "key", key: "2" }] },
        { phase: "hold", do: [{ type: "key", key: "3" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
  const [override, base] = built.manipulators;
  assert.deepEqual(override.to.map((e: any) => e.key_code), ["1"]);
  assert.equal(override.to_if_alone, undefined);
  assert.equal(override.to_if_held_down, undefined);
  assert.equal(base.to_if_alone[0].key_code, "2");
  assert.equal(base.to_if_held_down[0].key_code, "3");
});

test("defineBindings tap-hold: a broader group is never emitted ahead of a narrower one", () => {
  // Declaration order puts the unconditional group first, where it would swallow
  // every press before the conditional group is reached.
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      cases: [
        { phase: "hold", do: [{ type: "key", key: "1" }] },
        { phase: "release", conditions: [{ app: APPS.excel }], do: [{ type: "key", key: "2" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
  assert.ok(
    built.manipulators[0].conditions?.length,
    "the conditional manipulator must come first",
  );
  assert.equal(built.manipulators[1].conditions, undefined);
});

test("defineBindings remap: two press cases with different conditions -> two manipulators", () => {
  const rules = defineBindings([
    {
      description: "conditional",
      trigger: { keys: ["x"] },
      cases: [
        { phase: "press", conditions: [{ app: { type: "app", bundleId: "com.a", refDesc: "A" } }], do: [{ type: "key", key: "1" }] },
        { phase: "press", conditions: [{ app: { type: "app", bundleId: "com.b", refDesc: "B" } }], do: [{ type: "key", key: "2" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
});

test("defineBindings tapHold: hold case -> to_if_held_down + default-alone pass-through", () => {
  const rules = defineBindings([
    {
      description: "[A]        →    X (on hold)",
      trigger: { keys: ["a"] },
      timing: { aloneMs: 400, heldThresholdMs: 400 },
      cases: [{ phase: "hold", do: [{ type: "key", key: "f18", modifiers: ["COC_"], options: { repeat: false } }] }],
    },
  ]);
  const built = rules[0] as any;
  const m = built.manipulators[0];
  // default-alone pass-through: the key itself with halt:true.
  assert.deepEqual(m.to_if_alone, [{ halt: true, key_code: "a" }]);
  // to_if_held_down gets halt:true by default too: it cancels the subsequent
  // to_delayed_action so a release after a genuine hold doesn't replay the
  // to_if_canceled fallback below.
  assert.deepEqual(m.to_if_held_down, [
    {
      halt: true,
      repeat: false,
      key_code: "f18",
      modifiers: ["command", "option", "control"],
    },
  ]);
  // to_if_canceled mirrors to_if_alone: this is what lets a fast-typed next
  // key commit the previous key as "tap" immediately instead of waiting out
  // the full alone-timeout. halt:true on to_if_held_down (above) prevents it
  // from re-firing once a hold has already committed.
  assert.deepEqual(m.to_delayed_action, {
    to_if_invoked: [],
    to_if_canceled: [{ halt: true, key_code: "a" }],
  });
});

test("defineBindings multiTap: escape tap/hold/doubleTapHold -> 2 var-dance manipulators", () => {
  const rules = defineBindings([
    {
      description: "[␛]        →    Escape / Kill app (on multi-tap)",
      trigger: { keys: ["escape"] },
      timing: { aloneMs: 400, heldThresholdMs: 400 },
      cases: [
        { phase: "release", do: [{ type: "key", key: "escape" }] },
        { phase: "hold", do: [{ type: "shell", command: "kill fg" }] },
        { tapCount: 2, phase: "hold", do: [{ type: "shell", command: "kill all" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  // varTapTapHold emits [secondTap, firstTap]
  assert.equal(built.manipulators.length, 2);
  const first = built.manipulators.find((m: any) => m.to_if_alone?.some((e: any) => e.key_code === "escape"));
  assert.ok(first, "first tap carries the escape alone action");
});

test("buildMultiTap: the trigger's modifiers reach every manipulator's from", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["a"], modifiers: ["command", "option", "control", "shift"] },
      cases: [
        { phase: "release", do: [{ type: "shell", command: "tap" }] },
        { tapCount: 2, phase: "release", do: [{ type: "shell", command: "double" }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2);
  for (const m of built.manipulators) {
    // Building `from` from the key code alone dropped these, leaving a
    // manipulator on bare `a` that claimed every press of the key.
    assert.deepEqual(m.from.modifiers, {
      mandatory: ["command", "option", "control", "shift"],
    });
  }
});

test("buildMultiTap: multiTap.mods still overrides the trigger's modifiers", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["left_shift"] },
      multiTap: { mods: [] },
      cases: [
        { phase: "release", do: [{ type: "key", key: "left_shift" }] },
        { tapCount: 2, phase: "release", do: [{ type: "shell", command: "x" }] },
      ],
    },
  ]);
  for (const m of (rules[0] as any).manipulators) {
    assert.equal(m.from.modifiers, undefined, "mods: [] means no modifiers at all");
  }
});

test("buildMultiTap: a press case lands on every tap manipulator's to", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["a"] },
      cases: [
        { phase: "press", do: [{ type: "setVar", var: { name: "seen", varDesc: "Seen" }, value: 1 }] },
        { phase: "release", do: [{ type: "shell", command: "tap" }] },
        { tapCount: 2, phase: "release", do: [{ type: "shell", command: "double" }] },
      ],
    },
  ]);
  for (const m of (rules[0] as any).manipulators) {
    assert.ok(
      m.to?.some((e: any) => e.set_variable?.name === "seen"),
      "press fires on key-down whichever tap the manipulator represents",
    );
  }
});

test("defineBindings auto-derives rule description + slice-label when description absent", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      conditions: [{ app: { type: "app", bundleId: "com.a", refDesc: "A" } }],
      cases: [{ phase: "press", do: [{ type: "key", key: "y" }] }],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.description, "[X]:\n---\n\tOn Tap:\n\t\tIn A:\tEmit 'Y'");
  assert.equal(built.manipulators[0].description, "In A");
});

test("defineBindings auto-derived description omits slice-label when unconditional", () => {
  const rules = defineBindings([
    { trigger: { keys: ["x"] }, cases: [{ phase: "press", do: [{ type: "key", key: "y" }] }] },
  ]);
  const built = rules[0] as any;
  assert.equal(built.description, "[X]:\n---\n\tOn Tap:\n\t\tAlways:\tEmit 'Y'");
  assert.equal("description" in built.manipulators[0], false);
});

test("defineBindings: device-specific button alias auto-scopes via nameScope", () => {
  const rules = defineBindings([
    { trigger: { pointer: "shift_button" }, cases: [{ phase: "press", do: [{ type: "noop" }] }] },
  ]);
  const m = (rules[0] as any).manipulators[0];
  const devCond = m.conditions?.find((c: any) => c.type === "device_if");
  assert.deepEqual(devCond?.identifiers, [{ product_id: 49305, vendor_id: 1133, is_pointing_device: true }]);
});

test("defineBindings: global button alias adds no device condition", () => {
  const rules = defineBindings([
    { trigger: { pointer: "left" }, cases: [{ phase: "press", do: [{ type: "noop" }] }] },
  ]);
  const m = (rules[0] as any).manipulators[0];
  assert.equal(m.conditions?.some((c: any) => c.type === "device_if") ?? false, false);
});

test("buildTapHold: whileHoldVar sets var on down + suppressCancelFallback empties to_if_canceled", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["x"] },
      whileHoldVar: { name: "x_down", varDesc: "X down" },
      suppressCancelFallback: true,
      cases: [{ phase: "release", do: [{ type: "key", key: "x" }] }],
    },
  ]);
  const m = (rules[0] as any).manipulators[0];
  assert.ok(m.to?.some((e: any) => e.set_variable?.name === "x_down"));
  assert.deepEqual(m.to_delayed_action?.to_if_canceled, []);
});

test("resolveModifiers handles shorthand and explicit objects", () => {
  assert.deepEqual(resolveModifiers(undefined), { mandatory: [], optional: [] });
  assert.deepEqual(resolveModifiers(["left_shift", "CO_S"]), {
    mandatory: ["left_shift", "command", "option", "shift"],
    optional: [],
  });
  assert.deepEqual(
    resolveModifiers({ mandatory: ["left_shift"], optional: ["CO_S"] }),
    {
      mandatory: ["left_shift"],
      optional: ["command", "option", "shift"],
    },
  );
});

test("triggerToFrom with optional modifiers", () => {
  assert.deepEqual(
    triggerToFrom({ keys: ["a"], modifiers: { optional: ["left_shift"] } }) as any,
    { key_code: "a", modifiers: { optional: ["left_shift"] } },
  );
  assert.deepEqual(
    triggerToFrom({
      keys: ["a"],
      modifiers: { mandatory: ["left_command"], optional: ["left_shift"] },
    }) as any,
    {
      key_code: "a",
      modifiers: { mandatory: ["left_command"], optional: ["left_shift"] },
    },
  );
});

test("defineBindings: trigger with optional modifier resolves correctly", () => {
  const rules = defineBindings([
    {
      trigger: { keys: ["escape"], modifiers: { optional: ["left_shift"] } },
      cases: [{ phase: "press", do: [{ type: "key", key: "tab" }] }],
    },
  ]);
  const m = (rules[0] as any).manipulators[0];
  assert.deepEqual(m.from.modifiers, { optional: ["left_shift"] });
});

test("Binding type accepts modWhileDown option", () => {
  // Type-level check: modWhileDown is an accepted Binding field. Compiles only
  // if the flag exists on the type. Default-omitted binding must still typecheck.
  const withFlag: Binding = {
    trigger: { keys: ["caps_lock"] },
    modWhileDown: true,
    cases: [{ phase: "press", do: [{ type: "key", key: "left_command" }] }],
  };
  const withoutFlag: Binding = {
    trigger: { keys: ["caps_lock"] },
    cases: [{ phase: "press", do: [{ type: "key", key: "left_command" }] }],
  };
  assert.equal(withFlag.modWhileDown, true);
  assert.equal(withoutFlag.modWhileDown, undefined);
});

test("buildKeyTapHold: modWhileDown emits plain map().to().toIfAlone() (no delayed action)", () => {
  const rules = defineBindings([
    {
      description: "caps base",
      trigger: { keys: ["caps_lock"] },
      modWhileDown: true,
      whileHoldVar: { name: "caps_lock_pressed", varDesc: "Caps lock pressed" },
      cases: [
        { phase: "press", do: [{ type: "key", key: "left_command", modifiers: ["left_option", "left_control", "left_shift"] }] },
        { phase: "release", do: [{ type: "key", key: "f15", modifiers: ["left_command", "left_option", "left_control", "left_shift"] }] },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 1, "modWhileDown emits a single manipulator");
  const m = built.manipulators[0];
  // NO delayed action, NO held-down
  assert.equal("to_delayed_action" in m, false, "modWhileDown must not emit to_delayed_action");
  assert.equal("to_if_held_down" in m, false, "modWhileDown must not emit to_if_held_down");
  // var set on key-down (to), var cleared on key-up (to_after_key_up).
  // (toSetVar also emits undefined key_up_value/type keys; check name+value
  // directly like the existing whileHoldVar test does.)
  assert.equal(m.to[0].set_variable.name, "caps_lock_pressed");
  assert.equal(m.to[0].set_variable.value, 1);
  assert.equal(m.to_after_key_up[0].set_variable.name, "caps_lock_pressed");
  assert.equal(m.to_after_key_up[0].set_variable.value, 0);
  // held modifier in `to` (after the var)
  assert.deepEqual(m.to[1].key_code, "left_command");
  // tap combo in to_if_alone
  assert.deepEqual(m.to_if_alone[0].key_code, "f15");
});

test("buildGuard: double-tap guard emits two-manipulator arm/fire pattern", () => {
  const rules = defineBindings([
    {
      description: "guard test",
      trigger: { keys: ["q"], modifiers: ["left_command"] },
      cases: [
        {
          phase: "press",
          guard: true,
          do: [{ type: "key", key: "q", modifiers: ["left_command"] }],
        },
      ],
    },
  ]);
  const built = rules[0] as any;
  assert.equal(built.manipulators.length, 2, "guard emits two manipulators");
  const [secondPress, firstPress] = built.manipulators;
  // var name derived: guard_cmd_q
  const varName = "guard_cmd_q";
  // SECOND press: var=1, fires the real combo in `to`, resets var
  assert.deepEqual(secondPress.conditions[0], { type: "variable_if", name: varName, value: 1 } as any);
  // toSetVar emits extra undefined keys; check name/value directly.
  assert.equal(secondPress.to[0].key_code, "q");
  assert.equal(secondPress.to[1].set_variable.name, varName);
  assert.equal(secondPress.to[1].set_variable.value, 0);
  // mandatory from-modifiers
  assert.deepEqual(secondPress.from.modifiers, { mandatory: ["left_command"] });
  // FIRST press: var=0, arms guard, delayed-action disarms
  assert.deepEqual(firstPress.conditions[0], { type: "variable_if", name: varName, value: 0 } as any);
  assert.equal(firstPress.to[0].set_variable.name, varName);
  assert.equal(firstPress.to[0].set_variable.value, 1);
  assert.deepEqual(firstPress.parameters, { "basic.to_delayed_action_delay_milliseconds": 300 });
  assert.equal(firstPress.to_delayed_action.to_if_invoked[0].set_variable.name, varName);
  assert.equal(firstPress.to_delayed_action.to_if_canceled[0].set_variable.name, varName);
  assert.deepEqual(firstPress.from.modifiers, { mandatory: ["left_command"] });
});

test("buildGuard: guardVar/guardMs overrides flow through", () => {
  // The Binding.guardVar / guardMs options override the derived var name and
  // default 300ms timeout. Previously untested passthrough paths.
  const rules = defineBindings([
    {
      description: "override test",
      trigger: { keys: ["q"], modifiers: ["left_command"] },
      guardVar: "custom_guard",
      guardMs: 500,
      cases: [
        {
          phase: "press",
          guard: true,
          do: [{ type: "key", key: "q", modifiers: ["left_command"] }],
        },
      ],
    },
  ]);
  const built = rules[0] as any;
  const [secondPress, firstPress] = built.manipulators;
  // override var name used on both manipulators
  assert.equal((secondPress.conditions[0] as any).name, "custom_guard");
  assert.equal((firstPress.conditions[0] as any).name, "custom_guard");
  // override timeout emitted as the first-press delayed-action delay
  assert.deepEqual(firstPress.parameters, {
    "basic.to_delayed_action_delay_milliseconds": 500,
  });
});

test("buildGuard: throws on a guard mixed with another case (silent-drop footgun)", () => {
  // A guard binding must be exactly one guard() case. Mixing guard with another
  // case would silently drop the other case — fail loudly instead.
  assert.throws(
    () =>
      defineBindings([
        {
          trigger: { keys: ["q"] },
          cases: [
            { phase: "press", guard: true, do: [{ type: "key", key: "q" }] },
            { phase: "hold", do: [{ type: "key", key: "x" }] },
          ],
        },
      ]),
    /exactly one guard\(\) case/,
  );
});

test("buildGuard: throws on multiple guard cases", () => {
  assert.throws(
    () =>
      defineBindings([
        {
          trigger: { keys: ["q"] },
          cases: [
            { phase: "press", guard: true, do: [{ type: "key", key: "q" }] },
            { phase: "press", guard: true, do: [{ type: "key", key: "y" }] },
          ],
        },
      ]),
    /exactly one guard\(\) case/,
  );
});

test("normalizeModifier: strips side prefix and aliases command/control/option", () => {
  // Bespoke deriveGuardVar convention: left_/right_ stripped, then
  // command→cmd, control→ctrl, option→opt; everything else passes through.
  assert.equal(normalizeModifier("left_command"), "cmd");
  assert.equal(normalizeModifier("right_command"), "cmd");
  assert.equal(normalizeModifier("left_control"), "ctrl");
  assert.equal(normalizeModifier("left_option"), "opt");
  assert.equal(normalizeModifier("left_shift"), "shift");
  assert.equal(normalizeModifier("command"), "cmd");
  assert.equal(normalizeModifier("fn"), "fn");
});


test("buildKeyTapHold: modWhileDown without whileHoldVar omits all var signaling", () => {
  // Reachable but previously untested path: modWhileDown with no whileHoldVar
  // must not emit any set_variable / to_after_key_up events — the manipulator
  // is a bare map().to().toIfAlone() with just the held modifier + tap combo.
  const rules = defineBindings([
    {
      trigger: { keys: ["caps_lock"] },
      modWhileDown: true,
      cases: [
        { phase: "press", do: [{ type: "key", key: "f16" }] },
        { phase: "release", do: [{ type: "key", key: "f17" }] },
      ],
    },
  ]);
  const m = (rules[0] as any).manipulators[0];
  assert.equal("to_after_key_up" in m, false, "no whileHoldVar ⇒ no to_after_key_up");
  assert.equal(
    (m.to ?? []).some((e: any) => "set_variable" in e),
    false,
    "no whileHoldVar ⇒ no set_variable in to",
  );
  // held modifier (press) + tap combo (release) still present
  assert.equal(m.to[0].key_code, "f16");
  assert.equal(m.to_if_alone[0].key_code, "f17");
});

test("manipulator generation resolves R.cmd and L.cmd to right_command and left_command", () => {
  const manips = buildManipulators({
    trigger: { keys: ["R.cmd"] },
    cases: [
      { phase: "press", do: [{ type: "key", key: "c", modifiers: ["L.cmd"] }] },
    ],
  });
  const m = manips[0] as any;
  assert.equal(m.from.key_code, "right_command");
  assert.equal(m.to[0].key_code, "c");
  assert.deepEqual(m.to[0].modifiers, ["left_command"]);
});

