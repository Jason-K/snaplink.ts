# Missing Features

Karabiner-Elements capabilities this configuration cannot yet emit.

This list is **measured, not curated**. `npm run coverage` diffs
[`schema/karabiner-rule.schema.json`](./SCHEMA.md) against the DSL, and
`src/tests/schema-coverage.test.ts` fails in both directions: if something here
becomes reachable without being struck off, and if a wired feature loses its
wrapper. Re-run it after any upstream refresh
(`make -C schema keycodes KE_SRC=/path/to/Karabiner-Elements`).

**44 of 67 schema features reachable** as of 2026-08-12.

Parenthesised numbers cite [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md).

---

## Reading `npm run coverage`

Two independent columns, because they answer different questions:

| | meaning |
|---|---|
| **wired** | the emitter can produce it — a wrapper or handler names it |
| **emitted** | the current configuration actually does — it appears in `karabiner-output.json` |

`wired: no` is a missing capability, and is what this document tracks.
`wired: yes, emitted: 0` is a capability that exists but is unused, which is
often deliberate — `send_user_command` is wired through `toLayerIndicator()` and
emits nothing only because one leader rule is active in the current build.

---

## Missing

### 1. `to.hold_down_milliseconds`

**Smallest change, largest correctness win.** `to_if_alone` posts key_down and
key_up together, so key repeat is impossible there and any key that must be
*held* to register needs an explicit gap — `caps_lock` needs roughly 200 ms, and
pairs with a `vk_none` event to swallow the hardware key_up (5.7, 5.8, 7.4).

This configuration emits 105 `to_if_alone` channels and cannot set the gap on
any of them.

**Insertion point:** `KeyOptions` in
`src/engine/wrappers/to-action-wrappers.ts:531`, currently
`{ repeat?, halt?, lazy? }`. The field passes straight through to the emitted
event; no handler change is needed.

### 2. `to_if_other_key_pressed`

Rewrites the held `from` key itself when one of `other_keys` is pressed. The
documented fix for the `option+tab → command+tab` trap, where remapping via
`from.modifiers.mandatory` changes only the `tab` output and pressing another
modifier afterwards releases `left_command` and closes the app switcher (7.7).

The AST type (`ToIfOtherKeyPressedEntry`) is correct and
`src/tests/beta-features-review.test.ts` already has two `test.skip` cases
written against it. Nothing constructs one.

**Note:** this channel is the exception to the single-object shorthand — both
`other_keys` and `to` must be arrays, and the entry rejects `description`
(5.13).

### 3. `to.set_notification_message`

An on-screen message Karabiner owns, addressed by `id`. Setting `text` to `""`
with the same `id` clears it; `duration_milliseconds` (KE 16.1.18+) is the only
auto-dismiss, and a forgotten message stays up indefinitely (6.8).

Worth more than its size here: the layer indicator currently round-trips through
a UNIX datagram socket to a Hammerspoon receiver
(`src/engine/resolve-to-action/resolve-script.ts`, `toLayerIndicator()`). A
native notification would remove that entire IPC chain — the socket, the
receiver module, the launch agent, and the endpoint file — for the common case.

### 4. Conditions (8 unwired of 16)

| condition | why it is worth having |
|---|---|
| `device_exists_if` / `_unless` | Tests whether a device is **connected**, not whether it originated the event (KE 14.8.4+, 8.5). `device_if` cannot express "while the G502X is plugged in" for events from the built-in keyboard. |
| `keyboard_type_if` / `_unless` | The **virtual** keyboard type (ansi/iso/jis), not the physical device. `[` is `close_bracket` on JIS (8.6). |
| `input_source_if` / `_unless` | Language / input-source-id / input-mode-id regexes (8.1, 8.2). |
| `event_changed_if` / `_unless` | Whether Simple Modifications already rewrote this event. The mechanism that stops Function Keys Modifications from re-changing an fx key (2.5). |

The `_unless` half of each pair comes free: `ConditionBuilder.unless()` rewrites
`<x>_if` to `<x>_unless` generically, which is why `variable_unless` and
`frontmost_application_unless` are already reachable without appearing anywhere
in the source.

### 5. The mouse cluster (3)

| feature | notes |
|---|---|
| `to.mouse_key` | Cursor motion, wheel, and a speed multiplier from a key. Sign conventions differ per axis — `horizontal_wheel > 0` scrolls **left**, `vertical_wheel > 0` scrolls **down** (6.10). |
| `mouse_basic` manipulator | Flip, swap, or discard pointer axes. **DANGER:** `discard` without a scoping condition can make the cursor unmovable (1.2). |
| `mouse_motion_to_scroll` manipulator | Pointer motion becomes scrolling. **DANGER:** without `from.modifiers` *and* without `conditions`, all pointer motion becomes scrolling permanently (1.3). |

`src/data/constants/profiles.ts` already sets
`"mouse_motion_to_scroll.speed": 100` — a parameter for a manipulator type
nothing can emit.

The two manipulator types are the only items on this list that are not `basic`
manipulators. They carry no `from`/`to` and so bypass the binding pipeline
entirely; see Shape C below.

### 6. `to.select_input_source`

Language / input-source-id / input-mode-id regexes. Input sources carrying an
`input_mode_id` (Chinese, Japanese, Korean, Vietnamese) may fail to switch due
to a macOS issue — send the OS shortcut for CJKV instead (6.2).

### 7. Alternate key namespaces (3 families, in both `from` and `to`)

`apple_vendor_keyboard_key_code` (10 names), `apple_vendor_top_case_key_code`
(7), and `generic_desktop` (7). All three are undocumented upstream — they come
from the parser's own tables, and `generic_desktop` appears nowhere in the
published docs (4.10). `from.any` also accepts both `apple_vendor_*` kinds
(4.11).

Lower priority than it looks: the `key_code` table already carries `vk_`-prefixed
aliases for the most-wanted members (`vk_mission_control`, `vk_launchpad`,
`vk_dashboard`, `vk_consumer_brightness_up`, …), so the common cases are
reachable today by another name. Wire these when a specific key is not.

### 8. `from.integer_value`

For devices that distinguish buttons by integer payload rather than by button
number — USB foot pedals, some programmable pads. Values that change mid-press
are unsupported: the value is read from the first button pressed, so Left+Middle
(which reports 3) evaluates as 1 (4.9).

No action until such a device is in use. The AST type exists; only DSL access is
missing.

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

### Suggested order

| phase | items | rationale |
|---|---|---|
| 1 | `hold_down_milliseconds` | One field. Fixes a live correctness trap across 105 channels. |
| 2 | `to_if_other_key_pressed` | Types and skipped tests already written; unskip them. |
| 3 | `set_notification_message` | Can retire the Hammerspoon layer-indicator IPC chain. |
| 4 | `device_exists_*`, `event_changed_*`, `keyboard_type_*` | Three Shape B passes; `device_exists_*` is the one with an immediate use. |
| 5 | mouse cluster | Shape C plus `mouse_key`. Needs the safety work and careful testing. |
| 6 | `input_source_*`, `select_input_source` | Shape A + B; no current use case. |
| 7 | alternate namespaces, `integer_value` | On demand. Wire when a specific key or device needs it. |

---

## Previously tracked here

Resolved, and removed from this document:

- **`to.send_user_command`** — wired as `toUserCommand()` / `toLayerIndicator()`
  in `src/engine/resolve-to-action/resolve-script.ts`, called from
  `src/engine/leader/build.ts`. Reachable; unused in the current build.
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

Ideas that were tracked here but are configuration work rather than missing
capability — auto-clearing an idle leader layer, adding a second leader layer —
belong in [INSIGHTS.md](./INSIGHTS.md) with the rest of the layer architecture.

---

## Reference

- [SCHEMA.md](./SCHEMA.md) — the schema, the validator, and the build integration
- [karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md) — the numbered citations above
- [Karabiner-Elements release notes](https://karabiner-elements.pqrs.org/docs/releasenotes/)
