# Missing Features

Karabiner-Elements capabilities this configuration cannot yet emit.

This list is **measured, not curated**. `npm run coverage` diffs
[`schema/karabiner-rule.schema.json`](./SCHEMA.md) against the DSL, and
`src/tests/schema-coverage.test.ts` fails in both directions: if something here
becomes reachable without being struck off, and if a wired feature loses its
wrapper. Re-run it after any upstream refresh
(`make -C schema keycodes KE_SRC=/path/to/Karabiner-Elements`).

**60 of 70 schema features reachable** as of 2026-08-14.

Parenthesised numbers cite [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md).

---

## Reading `npm run coverage`

Two independent columns, because they answer different questions:

|             | meaning                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| **wired**   | the emitter can produce it — a wrapper or handler names it                      |
| **emitted** | the current configuration actually does — it appears in `karabiner-output.json` |

`wired: no` is a missing capability, and is what this document tracks.
`wired: yes, emitted: 0` is a capability that exists but is unused in the
current configuration — for example, `send_user_command` is wired through
`toLayerIndicator()` but emits nothing because no active rule uses it.

---

## Missing

### 1. `to.set_notification_message`

An on-screen message Karabiner owns, addressed by `id`. Setting `text` to `""`
with the same `id` clears it; `duration_milliseconds` (KE 16.1.18+) is the only
auto-dismiss, and a forgotten message stays up indefinitely (6.8).

Worth more than its size here: the layer indicator currently round-trips through
a UNIX datagram socket to a Hammerspoon receiver
(`src/engine/resolve-to-action/resolve-script.ts`, `toLayerIndicator()`). A
native notification would remove that entire IPC chain — the socket, the
receiver module, the launch agent, and the endpoint file — for the common case.

### 2. `to.select_input_source`

Language / input-source-id / input-mode-id regexes. Input sources carrying an
`input_mode_id` (Chinese, Japanese, Korean, Vietnamese) may fail to switch due
to a macOS issue — send the OS shortcut for CJKV instead (6.2).

### 3. Alternate key namespaces (3 families, in both `from` and `to`)

`apple_vendor_keyboard_key_code` (10 names), `apple_vendor_top_case_key_code`
(7), and `generic_desktop` (7). All three are undocumented upstream — they come
from the parser's own tables, and `generic_desktop` appears nowhere in the
published docs (4.10). `from.any` also accepts both `apple_vendor_*` kinds
(4.11).

Lower priority than it looks: the `key_code` table already carries `vk_`-prefixed
aliases for the most-wanted members (`vk_mission_control`, `vk_launchpad`,
`vk_dashboard`, `vk_consumer_brightness_up`, …), so the common cases are
reachable today by another name. Wire these when a specific key is not.

### 4. `from.integer_value`

For devices that distinguish buttons by integer payload rather than by button
number — USB foot pedals, some programmable pads. Values that change mid-press
are unsupported: the value is read from the first button pressed, so Left+Middle
(which reports 3) evaluates as 1 (4.9).

No action until such a device is in use. The AST type exists; only DSL access is
missing.

### 5. Layering Architecture: Momentary Hold Layers & Modal Leader Layers

Not a schema feature — Karabiner has no native concept of a layer. A layer in Snaplink is a _composition_ of existing capabilities (`set_variable`, `variable_if`, `from.any`, `to_if_alone`, `to_after_key_up`, `whileHoldVar`), which is why it does not appear in the `npm run coverage` count.

Snaplink distinguishes between two primary layering paradigms:

---

#### A. Momentary Hold Layers (Dual-Role Modifier / Hold Layers)

**Semantics**: Active strictly while a trigger key is held down; deactivates immediately upon release. If tapped and released alone, it emits an alternate action (or the base key).

**In-Architecture Precedents**:

- `src/engine/caps-layer.ts` (`caps_lock_pressed` / `caps_lock_used`)
- `src/definitions/mouse.ts` (`VARS.rButtonDown` for G502X Right Button chords)
- `src/definitions/complex-modifications.ts` (`VARS.rCmdDown` for Right Command quick-launch)

**The Dual-Role Gotcha**:
In Karabiner-Elements, `complex_modifications` rules run in a single pass on input events. When a rule intercepts `from: { key_code: "foo" }`, that key is **consumed** from the input event stream. Output events (`to`) do **not** re-enter `from.modifiers` matching.

- ❌ **Broken approach**: Trying to match `from: { key_code: "t", modifiers: { mandatory: ["right_command"] } }` when `right_command` is already intercepted by another rule. Karabiner sees `t` with zero modifiers and emits an unmodified `t`.
- ✅ **Correct approach (Variable Choreography)**:
  1. The hold trigger uses `whileHoldVar: VARS.fooDown` (setting the variable on press and resetting it via `to_after_key_up` on release).
  2. The hold trigger specifies `to_if_alone` to fire the standalone tap action (e.g. calling an external app like Sxitch).
  3. The hold trigger specifies `suppressCancelFallback: true` so that when a chord key cancels `to_if_alone`, no stray fallback key is emitted from `to_delayed_action.to_if_canceled`.
  4. Chord bindings are defined with phase `"press"` and conditioned on `when(VARS.fooDown)`.

**Implemented as `holdLayer()`** (`src/engine/wrappers/binding-wrappers.ts`). The sketch it grew from:

```ts
/**
 * Constructs a momentary hold layer that sets a variable while held,
 * allows tap-alone pass-through/action on release, and binds chord targets.
 */
export function holdLayer(config: {
  trigger: KeyCode | PointingButton;
  variable: VarSpec;
  tapAlone?: ActionInput | ActionInput[];
  timing?: { aloneMs?: number; holdMs?: number };
  bindings: Partial<Record<KeyCode, ActionInput | ActionInput[] | Case | Case[]>>;
}): Binding[] {
  const triggerBinding = bind(
    from(config.trigger),
    to(
      tapAndHold(
        config.tapAlone ? normalizeAction(config.tapAlone) : key(config.trigger as KeyCode, { repeat: false }),
        [],
      ),
    ),
    options({
      whileHoldVar: config.variable,
      suppressCancelFallback: true,
      ...(config.timing ? { timing: config.timing } : {}),
    }),
  );

  const chordBindings = bindTable("press", config.bindings, when(config.variable));
  return [triggerBinding, ...chordBindings];
}
```

_Example Usage_:

```ts
// Cleanly defines Right Command quick-launch without modifier leakage:
...holdLayer({
  trigger: "R.cmd",
  variable: VARS.rCmdDown,
  tapAlone: key("R.cmd", { repeat: false }), // Triggers Sxitch only on standalone tap
  bindings: {
    a: APPS.antinote,
    b: APPS.brave,
    o: APPS.outlook,
    t: APPS.teams,
  },
})
```

---

#### B. Modal Leader Layers (Sequential / Sticky Layers)

**Semantics**: Activated by tapping a leader key (e.g. Space), remains active after release, navigated via subkeys, and dismissed on timeout, Escape, or after executing a one-shot command.

**Variable Choreography**:

| Step                 | Mechanism                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Activate             | `to_if_held_down` sets `<prefix>_mod = 1`. `to_if_alone` emits the leader key itself with `halt: true` and clears every layer variable, so a tap still types the key.                                  |
| Tap past the timeout | `to_delayed_action.to_if_canceled` repeats the emit-and-clear, covering a hold that never reached the threshold. Both `to_if_alone_timeout` and `to_if_held_down_threshold` are set to the same value. |
| Enter a sublayer     | The sublayer key, gated on `<prefix>_mod == 1`, sets `<prefix>_<key>_sublayer = 1` **and clears `<prefix>_mod` in the same `to` array** — a hand-off, so the two are never both live.                  |
| Fire a mapping       | Gated on the sublayer variable. One-shot layers clear it after the action; a sticky-modifier toggle deliberately does not.                                                                             |
| Leave                | `to_after_key_up` clears every layer variable and turns all four sticky modifiers off.                                                                                                                 |
| Escape               | `escape`, gated on each layer variable, emits escape and performs the same full reset.                                                                                                                 |
| Nesting              | One more variable level: `<prefix>_<key>_<nested>_sublayer`.                                                                                                                                           |

Two ordering constraints do the real work, both following from gotcha 2.1 (first match wins) and 2.3 (a modified event is exempt from later rules):

1. **The unmapped-key guard must come last.** A `from.any: key_code` catch-all with `optional: ["any"]`, conditioned on each layer variable and emitting nothing, stops stray keys leaking into the frontmost app while a modal layer is active. Placed anywhere but last, it eats the layer's own mappings.
2. **Every other rule family needs suppression.** Rules outside the layer must carry `variable_unless` on the leader variable and every sublayer variable, or they fire while the layer is active.

**Implemented as `modalLayer()`** (`src/engine/modal-layer.ts`), which owns the
first four rows of the table above and the catch-all ordering constraint;
`ModalLayer.suppress()` is the second constraint, applied by the caller because
only the caller knows what "every other rule family" is. A commented, complete
example lives in `src/definitions/modal-layers.ts`.

```ts
const nav = modalLayer({
  leader: "spacebar",
  enterOn: "hold",              // a tap still types a space
  escapeKey: "escape",
  onUnmapped: "swallow",        // or "exit" / "passthrough"
  mappings: { q: APPS.qspace },
  sublayers: {
    d: {
      description: "Downloads",
      mappings: { f: folder(PATHS.downloads) },
    },
    w: {
      description: "Window management",
      sticky: true,             // stays up: nudging a window is repeated
      mappings: { h: URLS.hsWinLeftTop, l: URLS.hsWinRightBottom },
    },
  },
});
```

**The timeout row is not implemented, deliberately.** `to_delayed_action` is the
only timer Karabiner offers; it is scoped to one manipulator and cancelled by
the next key press — precisely the event that should *not* end a leader
sequence. A timer wired to it expires mid-sequence, or stops meaning anything
after the first keystroke. The exits are all explicit instead: a mapping firing,
escape, the leader again, or any unmapped key under `onUnmapped: "exit"`.

### Deliberately unwired

`to.held_down_milliseconds` is an undocumented parser alias of
`hold_down_milliseconds` (5.12). It is typed so imported third-party JSON
typechecks, and should never be emitted. It stays in `KNOWN_UNWIRED`
permanently.

---

## Extension Recipes

When implementing any missing feature, strike the entry from `KNOWN_UNWIRED` in
`src/tests/schema-coverage.test.ts`, then run `npm run check`. The coverage test
fails if you forget.

### Shape A — a new `to` action

Covers `set_notification_message`, `select_input_source`, and alternate key namespaces in `to`.

1. `src/data/primitives/actions.ts` — add a variant to `ActionSpec` with its
   `type` discriminant and payload.
2. `src/engine/wrappers/to-action-wrappers.ts` — a wrapper returning that spec,
   so bindings read as prose.
3. `src/engine/resolve-to-action/action-handlers.ts` — a registry entry with
   `toEvents` (spec → `ToEvent[]`) and `describe` (spec → the string that reaches
   the Karabiner UI).

### Shape B — a new `from` property or trigger namespace

Covers `from.integer_value` and alternate key namespaces in `from`.

1. `src/data/primitives/bindings.ts` — add or update the `Trigger` specification.
2. `src/engine/resolve-trigger/trigger-to-from.ts` — resolve the trigger to the corresponding `FromEvent` structure.
3. `src/engine/wrappers/from-action-wrappers.ts` — provide DSL wrappers for trigger authoring.

### Shape C — a modal layer

Covers item 5 (leader keys). **Implemented**; kept as the recipe for the next
layer family, since the shape generalises.

A layer is not one binding; it is a family of rules plus an ordering constraint
on everything else. `buildCapsLockBindings()` in `src/engine/caps-layer.ts` is
the working example — it takes every other binding as input, returns
`Binding[]`, and is planned separately in `src/config.ts` so it is emitted
first.

A leader layer needs three parts:

1. A builder in `src/engine/` returning `Binding[]`: the activation binding, one
   per sublayer, one per mapping, the escape reset, and the catch-all guard last.
2. A `CAPS_LAYER_SET`-style entry in `src/config.ts` so `planRules()` places the
   family ahead of the plain rules for the same keys.
3. A suppression pass adding `variable_unless` for the layer variables to every
   binding outside the family.

Start from `src/engine/caps-layer.ts` and the choreography table in item 5.

---

## Priority & Status

| items                                 | status / rationale                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `set_notification_message`            | Deferred: native replacement for Hammerspoon layer-indicator IPC chain when needed. |
| `select_input_source`                 | Shape A; no current use case.                                                       |
| alternate namespaces, `integer_value` | On demand. Wire when a specific key or device needs it.                             |
| modal layers (Shape C)                | **Done** — `modalLayer()` in `src/engine/modal-layer.ts`. Timeout excluded; see item 5B. |

---

## Reference

- [SCHEMA.md](./SCHEMA.md) — the schema, the validator, and the build integration
- [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md) — the numbered citations above
- [Karabiner-Elements release notes](https://karabiner-elements.pqrs.org/docs/releasenotes/)
