import assert from "node:assert/strict";
import test from "node:test";

import type { Binding } from "../data";
import type { CapsLayerConfig } from "../engine/caps-layer";
import type { BasicManipulator, KeyCode, Manipulator } from "../types/karabiner";
import {
  CAPS_LAYER_KEYS,
  CAPS_LAYER_STATES,
  HYPER,
  bind,
  capsLayer,
  defineBindings,
  from,
  guard,
  hold,
  ifApp,
  key,
  press,
  release,
  shell,
  to,
  when,
} from "../engine";

/**
 * The generated modifier layer.
 *
 * Driven by calling `capsLayer()` directly rather than by reading
 * `capsLockBindings`, so these test the generator rather than the current
 * personal keymap. A trimmed key set keeps the assertions readable; coverage of
 * the real key list is asserted separately against `CAPS_LAYER_KEYS`.
 */
const PRESSED = { name: "test_layer_pressed", varDesc: "Test layer pressed" };
const USED = { name: "test_layer_used", varDesc: "Test layer used" };

const CONFIG = {
  triggerKey: "caps_lock",
  pressedVar: PRESSED,
  usedVar: USED,
  tapKey: "f24",
  keys: ["a", "spacebar"],
} satisfies CapsLayerConfig;

function manipulators(): BasicManipulator[] {
  return defineBindings(capsLayer(CONFIG)).flatMap(
    (rule) => rule.manipulators as Manipulator[],
  ) as BasicManipulator[];
}

/** The manipulator for `key`, in the layer state selected by `selector`. */
function translationFor(key: string, selector: string | null): BasicManipulator {
  const found = manipulators().find((m) => {
    if ((m.from as { key_code?: string }).key_code !== key) return false;
    const mandatory = m.from.modifiers?.mandatory ?? [];
    return selector
      ? mandatory.length === 1 && mandatory[0] === selector
      : mandatory.length === 0;
  });
  assert.ok(found, `no manipulator for ${key} in layer ${selector ?? "(base)"}`);
  return found;
}

function layerKey(): BasicManipulator {
  const found = manipulators().find(
    (m) => (m.from as { key_code?: string }).key_code === "caps_lock",
  );
  assert.ok(found, "no manipulator for the layer key itself");
  return found;
}

test("the layer key emits no key event while held, only its state variables", () => {
  const m = layerKey();
  assert.deepEqual(
    m.to?.map((e) => (e as { set_variable?: { name: string; value: unknown } }).set_variable),
    [
      { name: PRESSED.name, value: 1 },
      { name: USED.name, value: 0 },
    ],
    "key-down must set the layer flag and arm the used flag, and nothing else",
  );
  assert.equal(
    m.to?.some((e) => "key_code" in e),
    false,
    "a key event here would be added to every key the layer translates",
  );
});

test("the layer key matches whatever modifiers are already held", () => {
  assert.deepEqual(layerKey().from.modifiers, { optional: ["any"] });
});

test("the tap output is the full hyper set, gated on the layer not having been used", () => {
  const [tap] = layerKey().to_after_key_up ?? [];
  assert.ok(tap, "key-up must carry the tap output");
  assert.equal((tap as { key_code?: string }).key_code, "f24");
  assert.deepEqual(tap.modifiers, [...HYPER]);
  assert.deepEqual(tap.conditions, [
    { type: "variable_if", name: USED.name, value: 0 },
  ]);
});

test("the tap is not to_if_alone, which an intervening modifier press would cancel", () => {
  const m = layerKey();
  assert.equal("to_if_alone" in m, false);
  assert.equal("to_delayed_action" in m, false);
  assert.equal("to_if_held_down" in m, false);
});

test("key-up clears both state variables", () => {
  const writes = (layerKey().to_after_key_up ?? [])
    .map((e) => (e as { set_variable?: { name: string; value: unknown } }).set_variable)
    .filter(Boolean);
  assert.deepEqual(writes, [
    { name: PRESSED.name, value: 0 },
    { name: USED.name, value: 0 },
  ]);
});

test("each layer state emits the hyper set minus the modifier that selects it", () => {
  assert.equal(CAPS_LAYER_STATES.length, 5, "base layer plus one per left modifier");

  for (const state of CAPS_LAYER_STATES) {
    const label = state.selector ?? "(base)";
    const m = translationFor("a", state.selector);
    const emitted = m.to?.find((e) => "key_code" in e);
    assert.ok(emitted, `${label}: no key event emitted`);
    assert.equal((emitted as { key_code: string }).key_code, "a");
    assert.deepEqual(
      emitted.modifiers,
      HYPER.filter((mod) => mod !== state.selector),
      `${label}: emitted modifiers must be the hyper set minus the selector`,
    );
  }
});

test("the selecting modifier is mandatory, so Karabiner consumes it", () => {
  for (const state of CAPS_LAYER_STATES) {
    if (!state.selector) continue;
    assert.deepEqual(
      translationFor("a", state.selector).from.modifiers?.mandatory,
      [state.selector],
      `${state.selector}: must be mandatory, not optional — optional modifiers survive into the output`,
    );
  }
});

test("no layer state accepts another state's selector, so two of them fall through", () => {
  const selectors = CAPS_LAYER_STATES.flatMap((s) => (s.selector ? [s.selector] : []));

  for (const state of CAPS_LAYER_STATES) {
    const m = translationFor("a", state.selector);
    const optional = m.from.modifiers?.optional ?? [];
    for (const other of selectors) {
      if (other === state.selector) continue;
      assert.equal(
        optional.includes(other as never),
        false,
        `layer ${state.selector ?? "(base)"} must not accept ${other}`,
      );
    }
  }
});

test("right-side modifiers and fn pass through every layer state", () => {
  for (const state of CAPS_LAYER_STATES) {
    const optional = translationFor("a", state.selector).from.modifiers?.optional ?? [];
    for (const passthrough of ["right_command", "right_option", "right_control", "right_shift", "fn"]) {
      assert.ok(
        optional.includes(passthrough as never),
        `layer ${state.selector ?? "(base)"} must pass ${passthrough} through`,
      );
    }
  }
});

test("every translation is gated on the layer flag and marks the layer used", () => {
  for (const state of CAPS_LAYER_STATES) {
    const m = translationFor("spacebar", state.selector);
    assert.deepEqual(m.conditions, [
      { type: "variable_if", name: PRESSED.name, value: 1 },
    ]);
    assert.deepEqual(
      (m.to?.[0] as { set_variable?: unknown }).set_variable,
      { name: USED.name, value: 1 },
      "used must be set before the key event, or a hold would look like a tap",
    );
  }
});

test("the key event is last and repeats, so held keys repeat", () => {
  const to = translationFor("a", null).to ?? [];
  const last = to[to.length - 1];
  assert.ok(last && "key_code" in last, "Karabiner repeats the last to-event");
  assert.equal(last.repeat, true);
});

test("nothing in the layer depends on press order", () => {
  for (const m of manipulators()) {
    assert.equal(
      "simultaneous" in m.from,
      false,
      "a simultaneous trigger would make the layer order- and timing-sensitive",
    );
    assert.equal(m.parameters?.["basic.simultaneous_threshold_milliseconds"], undefined);
  }
});

test("the layer covers letters, digits, symbols, function, navigation and keypad keys", () => {
  const covered: readonly KeyCode[] = [
    "a", "z", "0", "9", "slash", "f1", "f24", "spacebar", "escape",
    "page_down", "up_arrow",
    // Simple modifications run before complex ones, so a per-device keypad
    // remap has already been applied by the time the layer sees the key.
    "keypad_0", "keypad_9", "keypad_enter", "keypad_asterisk", "keypad_equal_sign",
  ];
  for (const key of covered) {
    assert.ok(CAPS_LAYER_KEYS.includes(key), `${key} is not covered by the layer`);
  }
  assert.equal(
    new Set(CAPS_LAYER_KEYS).size,
    CAPS_LAYER_KEYS.length,
    "a duplicated key would emit two manipulators per state",
  );
});

test("one manipulator per key per state, plus the layer key, modifiers and catch-all", () => {
  const translations = CONFIG.keys.length * CAPS_LAYER_STATES.length;
  const modifierPassThroughs = 9; // left/right × ⌘⌥⌃⇧, plus fn
  assert.equal(
    manipulators().length,
    translations + modifierPassThroughs + 2, // + the layer key + the catch-all
  );
});

// ── Unhandled input ─────────────────────────────────────────────────────────

/** The `from.any` backstop, which must be the last manipulator in the layer. */
function catchAll(ms = manipulators()): BasicManipulator {
  const found = ms.filter((m) => "any" in m.from);
  assert.equal(found.length, 1, "the layer needs exactly one catch-all");
  assert.equal(ms.indexOf(found[0]!), ms.length - 1, "the catch-all must be evaluated last");
  return found[0]!;
}

test("a key no layer state claims still marks the layer used, and passes through", () => {
  const m = catchAll();
  assert.deepEqual(m.from, { any: "key_code", modifiers: { optional: ["any"] } });
  assert.deepEqual(m.conditions, [
    { type: "variable_if", name: PRESSED.name, value: 1 },
  ]);
  assert.deepEqual(
    (m.to?.[0] as { set_variable?: unknown }).set_variable,
    { name: USED.name, value: 1 },
    "without this, two selectors held at once would leave the tap armed and fire it on release",
  );
  assert.deepEqual(
    m.to?.[1],
    { from_event: true },
    "'falls through unchanged' has to stay literally true",
  );
});

test("modifier keys pass through the layer without marking it used", () => {
  const ms = manipulators();
  const modifiers = [
    "left_command", "left_option", "left_control", "left_shift",
    "right_command", "right_option", "right_control", "right_shift",
    "fn",
  ];

  for (const mod of modifiers) {
    const m = ms.find((x) => (x.from as { key_code?: string }).key_code === mod);
    assert.ok(m, `${mod} must be claimed before the catch-all reaches it`);
    assert.deepEqual(m.to, [{ from_event: true }], `${mod}: pass through untouched`);
    assert.equal(
      m.to?.some(
        (e) =>
          (e as { set_variable?: { name: string } }).set_variable?.name === USED.name,
      ),
      false,
      `${mod}: a modifier press must not cancel the tap — caps → ⇧ → release is still a tap`,
    );
    assert.ok(
      ms.indexOf(m) < ms.indexOf(catchAll(ms)),
      `${mod} must be ordered before the catch-all`,
    );
  }
});

test("no layer state claims two selectors at once, so the catch-all handles them", () => {
  const withTwoSelectors = manipulators().filter((m) => {
    const mandatory = m.from.modifiers?.mandatory ?? [];
    return mandatory.length > 1;
  });
  assert.deepEqual(
    withTwoSelectors,
    [],
    "two selectors are deliberately unmapped; the catch-all is what keeps that from arming the tap",
  );
});

// ── Adoption ────────────────────────────────────────────────────────────────

/**
 * Karabiner never re-reads its own output, so a layer that emits `⌘⌥⌃⇧+E`
 * cannot reach a rule bound to `⌘⌥⌃⇧+E`. Those rules are joined into the layer
 * at compile time instead.
 */
function adopting(...adopt: Binding[]) {
  return defineBindings(capsLayer({ ...CONFIG, adopt })).flatMap(
    (rule) => rule.manipulators as Manipulator[],
  ) as BasicManipulator[];
}

/** Every layer manipulator for `key` in the state selected by `selector`. */
function allFor(
  ms: BasicManipulator[],
  key: string,
  selector: string | null,
): BasicManipulator[] {
  return ms.filter((m) => {
    if ((m.from as { key_code?: string }).key_code !== key) return false;
    const mandatory = m.from.modifiers?.mandatory ?? [];
    return selector ? mandatory[0] === selector : mandatory.length === 0;
  });
}

test("a binding on the combination a layer emits runs instead of the combination", () => {
  // Unsided ⌘⌥⌃⇧, the way VM.COCS spells it — matching is side-insensitive.
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(press(shell("echo adopted"))),
  );
  const [m, ...rest] = allFor(adopting(source), "a", null);

  assert.ok(m, "no manipulator for the adopted key");
  assert.deepEqual(rest, [], "an unconditional adoption must not also emit the combination");
  assert.equal(
    m.to?.some((e) => "key_code" in e),
    false,
    "the layer must run the action, not emit ⌘⌥⌃⇧+A into the void",
  );
  assert.deepEqual(m.to?.map((e) => (e as { shell_command?: string }).shell_command).filter(Boolean), [
    "echo adopted",
  ]);
});

test("an adopted binding still marks the layer used, so the tap does not fire", () => {
  const source = bind(from("a", ["command", "option", "control", "shift"]), to(press(shell("x"))));
  const [m] = allFor(adopting(source), "a", null);
  assert.deepEqual(
    (m?.to?.[0] as { set_variable?: unknown }).set_variable,
    { name: USED.name, value: 1 },
  );
});

test("each layer state adopts the combination it emits, and only that one", () => {
  // ⌘⌥⌃ is what the ⇧ layer emits, so this belongs to caps+⇧, not to caps alone.
  const source = bind(from("a", ["command", "option", "control"]), to(press(shell("x"))));
  const ms = adopting(source);

  const shiftLayer = allFor(ms, "a", "left_shift");
  assert.equal(shiftLayer.length, 1);
  assert.equal(
    shiftLayer[0]?.to?.some((e) => "shell_command" in e),
    true,
    "caps+⇧+A must run the ⌘⌥⌃+A binding",
  );

  for (const state of CAPS_LAYER_STATES) {
    if (state.selector === "left_shift") continue;
    const other = allFor(ms, "a", state.selector);
    assert.equal(
      other.some((m) => m.to?.some((e) => "shell_command" in e)),
      false,
      `layer ${state.selector ?? "(base)"} must not adopt the ⌘⌥⌃ binding`,
    );
  }
});

test("adoption extends coverage to keys outside the generated grid", () => {
  const source = bind(
    from("international1", ["command", "option", "control", "shift"]),
    to(press(shell("x"))),
  );
  assert.equal(CAPS_LAYER_KEYS.includes("international1"), false, "sanity: not in the grid");
  assert.equal(allFor(adopting(source), "international1", null).length, 1);
});

test("adopting a key that is also in the grid does not emit it twice", () => {
  const source = bind(
    from("keypad_1", ["command", "option", "control", "shift"]),
    to(press(shell("x"))),
  );
  assert.ok(CAPS_LAYER_KEYS.includes("keypad_1"), "sanity: in the grid");

  const ms = defineBindings(
    capsLayer({ ...CONFIG, keys: ["keypad_1"], adopt: [source] }),
  ).flatMap((rule) => rule.manipulators as Manipulator[]) as BasicManipulator[];

  const [m, ...rest] = allFor(ms, "keypad_1", null);
  assert.deepEqual(rest, [], "the adoption replaces the generated emit, it does not join it");
  assert.equal(m?.to?.some((e) => "shell_command" in e), true);
});

test("a fully conditional adoption keeps the emitted combination as a fallback", () => {
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(press(shell("x"))),
    when(ifApp("com.example.app")),
  );
  const ms = allFor(adopting(source), "a", null);

  assert.equal(ms.length, 2, "adoption plus fallback");
  assert.equal(
    ms[0]?.to?.some((e) => "shell_command" in e),
    true,
    "the conditional adoption must be ordered first",
  );
  const fallback = ms[1]?.to?.find((e) => "key_code" in e);
  assert.deepEqual(fallback?.modifiers, [...HYPER], "the fallback emits the layer's combination");
  assert.deepEqual(
    ms[1]?.conditions,
    [{ type: "variable_if", name: PRESSED.name, value: 1 }],
    "the fallback must not inherit the adoption's condition",
  );
});

test("a missing tap or hold phase falls back to the layer's combination, not a bare key", () => {
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(release(shell("tapped"))),
  );
  const [m] = allFor(adopting(source), "a", null);

  assert.equal((m?.to_if_alone?.[0] as { shell_command?: string }).shell_command, "tapped");
  const held = m?.to_if_held_down?.[0];
  assert.equal((held as { key_code?: string })?.key_code, "a");
  assert.deepEqual(
    held?.modifiers,
    [...HYPER],
    "held, the adopted key must behave as ⌘⌥⌃⇧+A did — not as a plain 'a'",
  );
});

test("guarded bindings are not adopted; the layer emits the combination", () => {
  const guarded = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(guard(key("a", ["command", "option", "control", "shift"]))),
  );
  const [m, ...rest] = allFor(adopting(guarded), "a", null);

  assert.deepEqual(rest, [], "expected a single manipulator");
  assert.deepEqual(
    m?.to?.find((e) => "key_code" in e)?.modifiers,
    [...HYPER],
    "buildGuard() requires the guard to be the only case, so the layer cannot inject into it",
  );
});

test("a tap / hold / double-tap binding keeps all three cases when adopted", () => {
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(
      release(shell("tapped")),
      hold(shell("held")),
      release(shell("double")).withTapCount(2),
    ),
  );
  const ms = allFor(adopting(source), "a", null);
  assert.equal(ms.length, 2, "multi-tap compiles to a second-tap and a first-tap manipulator");

  const commands = (m: BasicManipulator | undefined, channel: "to_if_alone" | "to_if_held_down") =>
    (m?.[channel] ?? []).map((e) => (e as { shell_command?: string }).shell_command).filter(Boolean);

  const [secondTap, firstTap] = ms;
  assert.deepEqual(commands(firstTap, "to_if_alone"), ["tapped"]);
  assert.deepEqual(commands(firstTap, "to_if_held_down"), ["held"]);
  assert.deepEqual(commands(secondTap, "to_if_alone"), ["double"]);
});

test("an adopted multi-tap marks the layer used on key-down, on either manipulator", () => {
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(release(shell("tapped")), release(shell("double")).withTapCount(2)),
  );
  for (const m of allFor(adopting(source), "a", null)) {
    assert.ok(
      m.to?.some(
        (e) =>
          (e as { set_variable?: { name: string; value: unknown } }).set_variable?.name ===
          USED.name,
      ),
      "whichever tap claims the key-down has to mark the layer used",
    );
  }
});

test("an adopted multi-tap gets its own pending-tap variable", () => {
  const source = bind(
    from("a", ["command", "option", "control", "shift"]),
    to(release(shell("tapped")), release(shell("double")).withTapCount(2)),
  );
  const pending = allFor(adopting(source), "a", null)
    .flatMap((m) => m.conditions ?? [])
    .filter((c) => c.type === "variable_if" && (c as any).name !== PRESSED.name)
    .map((c) => (c as { name: string }).name);

  assert.deepEqual(
    [...new Set(pending)],
    ["multi_tap_caps_lock_base_a"],
    "sharing multi_tap_a with the source would let each resolve the other's pending tap",
  );
});

test("bindings on unrelated modifier combinations are left alone", () => {
  const source = bind(from("a", ["command", "shift"]), to(press(shell("x"))));
  const ms = adopting(source);
  for (const state of CAPS_LAYER_STATES) {
    const [m, ...rest] = allFor(ms, "a", state.selector);
    assert.deepEqual(rest, []);
    assert.equal(
      m?.to?.some((e) => "shell_command" in e),
      false,
      `layer ${state.selector ?? "(base)"} must not adopt ⌘⇧+A`,
    );
  }
});

test("chords and pointer triggers are never adopted", () => {
  const chord = bind(from(["a", "b"], ["command", "option", "control", "shift"]), to(press(shell("x"))));
  const pointer = bind(from({ pointer: "button4" }, ["command", "option", "control", "shift"]), to(press(shell("x"))));
  assert.equal(
    adopting(chord, pointer).some((m) => m.to?.some((e) => "shell_command" in e)),
    false,
  );
});
