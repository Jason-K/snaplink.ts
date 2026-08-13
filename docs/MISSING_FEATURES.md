# Missing Features

Karabiner-Elements capabilities this configuration cannot yet emit.

This list is **measured, not curated**. `npm run coverage` diffs
[`schema/karabiner-rule.schema.json`](./SCHEMA.md) against the DSL, and
`src/tests/schema-coverage.test.ts` fails in both directions: if something here
becomes reachable without being struck off, and if a wired feature loses its
wrapper. Re-run it after any upstream refresh
(`make -C schema keycodes KE_SRC=/path/to/Karabiner-Elements`).

**57 of 67 schema features reachable** as of 2026-08-13.

Parenthesised numbers cite [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md).

---

## Reading `npm run coverage`

Two independent columns, because they answer different questions:

| | meaning |
| --- | --- |
| **wired** | the emitter can produce it — a wrapper or handler names it |
| **emitted** | the current configuration actually does — it appears in `karabiner-output.json` |

`wired: no` is a missing capability, and is what this document tracks.
`wired: yes, emitted: 0` is a capability that exists but is unused, which is
often deliberate — `send_user_command` is wired through `toLayerIndicator()` and
emits nothing only because one leader rule is active in the current build.

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

### 5. Modal layers (leader keys)

Not a schema feature — Karabiner has no notion of a layer. A leader layer is a
*composition* of features the DSL already has (`set_variable`, `variable_if`,
`from.any`, `to_if_held_down`), which is why it does not appear in the
`npm run coverage` count.

Wanted shape, roughly:

```ts
binding(from("space_bar"), to(layer(
  layerKey("d", to(folder(FOLDERS.downloads))),
  layerKey("w", to(app(APPS.slack))),
)))
```

An implementation lived under `engine/leader/` and was removed on 2026-08-12:
384 lines, called by nothing, pre-dating the `Binding` surface — 11 `as any`
casts, direct `map()`/`rule()` construction bypassing the resolve pipeline, a
seven-way bespoke config union duplicating `ActionSpec`, and `{{ mustache }}`
braces in exprtk expression fields that would have emitted invalid JSON had
anything ever run it. Rebuilding against the current pipeline is less work than
adapting it. `src/engine/caps-layer.ts` is the in-architecture precedent: it
produces `Binding[]` and participates in conflict analysis.

The variable choreography is the part worth keeping, and it is not obvious:

| Step | Mechanism |
| --- | --- |
| Activate | `to_if_held_down` sets `<prefix>_mod = 1`. `to_if_alone` emits the leader key itself with `halt: true` and clears every layer variable, so a tap still types the key. |
| Tap past the timeout | `to_delayed_action.to_if_canceled` repeats the emit-and-clear, covering a hold that never reached the threshold. Both `to_if_alone_timeout` and `to_if_held_down_threshold` are set to the same value. |
| Enter a sublayer | The sublayer key, gated on `<prefix>_mod == 1`, sets `<prefix>_<key>_sublayer = 1` **and clears `<prefix>_mod` in the same `to` array** — a hand-off, so the two are never both live. |
| Fire a mapping | Gated on the sublayer variable. One-shot layers clear it after the action; a sticky-modifier toggle deliberately does not. |
| Leave | `to_after_key_up` clears every layer variable and turns all four sticky modifiers off. |
| Escape | `escape`, gated on each layer variable, emits escape and performs the same full reset. |
| Nesting | One more variable level: `<prefix>_<key>_<nested>_sublayer`. |

Two ordering constraints do the real work, both following from gotcha 2.1
(first match wins) and 2.3 (a modified event is exempt from later rules):

1. **The unmapped-key guard must come last.** A `from.any: key_code` catch-all
   with `optional: ["any"]`, conditioned on each layer variable and emitting
   nothing, is what stops stray keys leaking into the frontmost app while a
   layer is active. Placed anywhere but last, it eats the layer's own mappings.
2. **Every other rule family needs suppression.** Rules outside the layer must
   carry `variable_unless` on the leader variable and every sublayer variable,
   or they fire while the layer is active. `src/config.ts` solves the equivalent
   problem for the caps layer by *ordering* — emitting it first, conditioned on
   `caps_lock_pressed`. A leader layer needs the suppression pass too, because
   unlike caps it stays active after its key is released.

### Deliberately unwired

`to.held_down_milliseconds` is an undocumented parser alias of
`hold_down_milliseconds` (5.12). It is typed so imported third-party JSON
typechecks, and should never be emitted. It stays in `KNOWN_UNWIRED`
permanently.

---

## Plan

Everything above except the two mouse manipulators fits one of two established
shapes. Both end the same way: strike the entry from `KNOWN_UNWIRED` in
`src/tests/schema-coverage.test.ts`, then `npm run check`. The coverage test
fails if you forget, which is the point.

### Shape A — a new `to` action

Covers `mouse_key`, `set_notification_message`, `select_input_source`, and the
alternate key namespaces.

1. `src/data/primitives/actions.ts` — add a variant to `ActionSpec` with its
   `type` discriminant and payload.
2. `src/engine/wrappers/to-action-wrappers.ts` — a wrapper returning that spec,
   so bindings read as prose.
3. `src/engine/resolve-to-action/action-handlers.ts` — a registry entry with
   `toEvents` (spec → `ToEvent[]`) and `describe` (spec → the string that reaches
   the Karabiner UI).

`hold_down_milliseconds` is a smaller case of this: a field on `KeyOptions`
rather than a new variant, with no handler change.

### Shape B — a new condition

Covers all eight unwired conditions.

1. `src/data/primitives/bindings.ts` — add a variant to the `Condition` union,
   including the shared `unless?: boolean` and `description?: string`.
2. `src/engine/resolve-conditions/condition-handlers.ts` — an entry in
   `CONDITION_HANDLERS` with `build`, `describe`, and the identity/implication
   functions the conflict analysis uses to decide when two conditions overlap.
3. `src/engine/wrappers/condition-wrappers.ts` — an `ifX()` wrapper. The
   `unlessX()` form comes free from `ConditionBuilder.unless()`.

The identity/implication functions are the part worth care: `analyze-conflicts`
uses them to decide whether two manipulators can both match, and a condition
that reports no relationships will read as always-conflicting.

### Shape C — a non-basic manipulator

Covers `mouse_basic` and `mouse_motion_to_scroll` only.

These have no `from` or `to`, so `Binding` cannot express them and the whole
`resolve-trigger` → `resolve-to-action` pipeline does not apply. They need a
separate definition kind that `src/config.ts` collects and `src/engine/emit-rules/`
appends directly as manipulators.

Two safety requirements before any of this ships:

- `MouseMotionToScrollManipulator` already requires `from` or `conditions` at
  the type level. Keep that.
- `MouseBasicManipulator.discard` does **not** yet require a condition, and
  should — an unscoped `discard` is the 1.2 failure mode. Tighten the type in
  `src/types/karabiner.ts` as part of this work.

Test these with a second pointing device connected, or with a Karabiner-free
login path available.

### Shape D — a modal layer

Covers item 5 only, and is the largest of the four.

A layer is not one binding; it is a family of rules plus an ordering constraint
on everything else. `buildCapsLockBindings()` in `src/engine/caps-layer.ts` is
the working example — it takes every other binding as input, returns
`Binding[]`, and is planned separately in `src/config.ts` so it is emitted
first.

A leader layer needs the same three parts:

1. A builder in `src/engine/` returning `Binding[]`: the activation binding, one
   per sublayer, one per mapping, the escape reset, and the catch-all guard last.
2. A `CAPS_LAYER_SET`-style entry in `src/config.ts` so `planRules()` places the
   family ahead of the plain rules for the same keys.
3. A suppression pass adding `variable_unless` for the layer variables to every
   binding outside the family.

Start from `src/engine/caps-layer.ts` and the choreography table in item 5.

### Suggested order

| phase | items | rationale |
| --- | --- | --- |
| ~~1~~ | ~~`hold_down_milliseconds`~~ | **Done 2026-08-13.** |
| ~~2~~ | ~~`to_if_other_key_pressed`~~ | **Done 2026-08-13.** |
| 3 | `set_notification_message` | Deferred: its stated payoff was retiring the layer-indicator IPC chain, which is already orphaned. No consumer. |
| ~~4~~ | ~~all eight conditions~~ | **Done 2026-08-13.** Conditions are 16/16. |
| ~~5~~ | ~~mouse cluster~~ | **Done 2026-08-13.** All 3 manipulator types wired. |
| 6 | `select_input_source` | Shape A; no current use case. |
| 7 | alternate namespaces, `integer_value` | On demand. Wire when a specific key or device needs it. |
| — | modal layers (Shape D) | Independent of the phases above: a feature, not a gap. Size it against `caps-layer.ts`. |

---

## Previously tracked here

Resolved, and removed from this document:

- **`to.send_user_command`** — wired as `toUserCommand()` / `toLayerIndicator()`
  in `src/engine/resolve-to-action/resolve-script.ts`. Reachable, but as of
  2026-08-12 nothing calls either helper: their only caller was the leader
  layer. See *Orphaned* below.
- **`to.from_event`** — wired as `toTrigger()`. Emitted 12×.
- **`expression_if` / `expression_unless`** — wired and emitted. The
  previously-tracked "add a real expression-based rule" is done.
- **Extended mouse buttons (33–255)** — `PointingButton` is now the full
  255-name generated union, so this is type-complete. No device in use.
- **`set_variable.expression`** — typed and reachable through the leader code.

Two earlier entries are gone because they were wrong rather than done. The
previous revision documented `to_if_other_key_pressed` as "reviewed and
adoption-ready" with worked examples — it has never been reachable, and six of
the seven API names in those examples (`toSendUserCommand`, `toFromEvent`,
`toIfOtherKeyPressed`, `layerIndicatorCommand`, `setVarExpr`, `exprIf`) do not
exist in this codebase. That is the failure mode this document is now built to
avoid: every claim here is checked by `npm run coverage` on every `npm run check`.

### Shipped

- **`to.hold_down_milliseconds`** (2026-08-13) — on `ActionEventOptions`, so
  `key("caps_lock", { hold_down_milliseconds: 200 })` works. Extracting that
  type also collapsed three identical inline `options` blocks in `ActionSpec`.
- **`to_if_other_key_pressed`** (2026-08-13) — `Binding.otherKeyPressed`, and
  `BasicManipulatorBuilder.toIfOtherKeyPressed()` underneath it. Rejected on
  multi-tap and guard bindings, where the interaction is unvalidated. The five
  `test.skip` cases that had been written against a non-existent API now run.

- **All eight remaining conditions** (2026-08-13) — `deviceExists`,
  `keyboardType`, `inputSource`, `eventChanged`, each with its `_unless` half
  free via `ConditionBuilder.unless()`. Conditions are now 16/16.

  Adding them exposed a gap in the registry's own guarantee: `ConditionKind` was
  hand-listed, so a new `Condition` variant compiled cleanly and only failed at
  runtime inside `conditionKind()`. `UncoveredConditions` now makes that a
  compile error.

  The interesting part is `contradicts`, which conflict analysis uses to drop
  unreachable rules — claiming contradiction wrongly deletes a live rule.
  `deviceExists` never contradicts (any number of devices can be connected at
  once, unlike `device`, where one event has exactly one source); `keyboardType`
  contradicts only when the accepted sets are disjoint; `inputSource` never
  does, because its fields are regexes and overlap cannot be ruled out.

- **The mouse cluster** (2026-08-13) — `mouse_key` via `mouseMove()` /
  `mouseScroll()`, and both non-`basic` manipulator types via `PointerTweak`
  in `POINTER_TWEAKS` (`src/config.ts`). Manipulator types are now 3/3.

  `POINTER_TWEAKS` ships **empty**. Both types can leave a machine undriveable
  if mis-scoped, so nothing is enabled until it is deliberately added, and the
  emitted config is unchanged until then.

  Scoping is enforced twice. `discard` without a condition and
  `mouse_motion_to_scroll` without modifiers-or-conditions are unrepresentable
  in the types, and `emitPointerTweaks()` throws on both again at build time —
  the types cannot see a value that arrives through a cast, and the failure mode
  is a machine you cannot drive to the Settings UI to undo it.

  `mouseMove` / `mouseScroll` take directions, not signs: `vertical_wheel > 0`
  scrolls down but `horizontal_wheel > 0` scrolls **left** (gotcha 6.10), and
  that asymmetry is the kind of thing you get wrong once and then debug for an
  hour.

### Orphaned

Removing the leader layer left the user-command server with no callers.
`toUserCommand()` and `toLayerIndicator()` still exist and still typecheck, but
nothing in the build invokes them, which orphans the whole chain behind them:
the Hammerspoon receiver module, the launch agent, the UNIX socket, the endpoint
file under `scripts/layer-indicator/`, and
[COMMAND_SERVER_GUIDE.md](./COMMAND_SERVER_GUIDE.md).

It is kept rather than deleted because the mechanism is sound and a modal layer
is the obvious consumer — but if layers are not coming back, this is the next
thing to retire, and `to.set_notification_message` (item 3) would be the
native replacement.

Ideas that were tracked here but are configuration work rather than missing
capability — auto-clearing an idle leader layer, adding a second leader layer —
belong in [INSIGHTS.md](./INSIGHTS.md) with the rest of the layer architecture.

---

## Reference

- [SCHEMA.md](./SCHEMA.md) — the schema, the validator, and the build integration
- [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md) — the numbered citations above
- [Karabiner-Elements release notes](https://karabiner-elements.pqrs.org/docs/releasenotes/)
