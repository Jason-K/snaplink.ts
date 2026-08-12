# Future Features

This document tracks unimplemented Karabiner-Elements capabilities that may be worth adding. Items are ordered by implementation priority.

---

## Completed Beta Features (Now Adoption-Ready)

### `to.send_user_command` Pilot ✅ (v15.9.15 beta)

**Karabiner feature:** `to.send_user_command`

**Implementation status:** COMPLETE

**What was done:**

1. Added `layerIndicatorCommand(action, layer?)` helper in `src/engine/resolve-to-action/resolve-script.ts`
2. Replaced all 4 layer-indicator shell_command calls with `toSendUserCommand()` events in `src/engine/leader/build.ts`
3. Created Hammerspoon IPC receiver module (`user_command_receiver.lua`) with JSON payload parsing
4. Integrated receiver into Hammerspoon initialization (init.lua)
5. Verified: 9 send_user_command events correctly serialized in output config

**Why it works:** Avoids shell spawn overhead for repeated layer indicator updates (show/hide during leader mode).

**Receiver interface:** Listens on IPC endpoint `"layer_indicator"` for JSON payloads with structure `{ "action": "show"|"hide", "layer": "layer_name?" }`.

**Future migration candidates** (explicitly identified in review):

- Raycast/CleanShot URL-scheme launches (downstream latency dominates)
- Python-backed text processor (server startup dominates)
- Heavy app-launch commands

**Not migrated:**

- These optimizations are lower-priority and may not show measurable latency improvements due to downstream work dominating the total latency.

---

### `to.from_event` Review ✅ (v15.9.13 beta)

**Karabiner feature:** `to.from_event`

**Implementation status:** REVIEWED AND ADOPTION-READY

**What the feature does:** Emits the triggering key event unchanged, enabling pass-through behavior in conditional contexts.

**Review findings:**

1. **Correct behavior confirmed:** Pass-through works atomically with other handlers (to_if_alone, to_if_held_down, to_if_other_key_pressed)
2. **Composability verified:** Works correctly with expression conditions (Phase 1 beta feature)
3. **Key use case:** Conditional pass-through where a key normally remaps but passes through unchanged in specific conditions

**Recommended pattern:**

```typescript
// Terminal: pass through option-key unchanged
map("left_option")
  .condition(frontmost_application_if(["com.apple.Terminal"]))
  .to([toFromEvent()])

// Other apps: remap option for app switching
map("left_option")
  .condition(frontmost_application_unless(["com.apple.Terminal"]))
  .toIfOtherKeyPressed({ key_code: "tab" }, { key_code: "left_command" })
```

**Not recommended for:**

- Universal bypass mode (Simple Modifications always run, so from_event alone cannot act as escape hatch)
- Performance-critical paths (atomic event emission is already efficient)

**Adoption path:** Safe to use in any conditional context; no performance concerns.

---

### `to_if_other_key_pressed` Review ✅ (v15.9.17 beta)

**Karabiner feature:** `to_if_other_key_pressed`

**Implementation status:** REVIEWED AND ADOPTION-READY

**What the feature does:** Atomically changes the emitted event when another key is simultaneously pressed, enabling true modifier-chorded remaps.

**Review findings:**

1. **Correctness confirmed:** Additive to base .to() events (does not override)
2. **Stacking works:** Compatible with .toIfAlone(), .toIfHeldDown(), and other handlers on same manipulator
3. **Multiple triggers:** Can chain multiple .toIfOtherKeyPressed() calls for different chord targets
4. **Optional modifiers:** Properly respects optional modifier specifications in trigger conditions

**Recommended pattern - Option-Tab app switcher:**

```typescript
map("left_option")
  .to("left_option")  // Normal pass-through
  .toIfOtherKeyPressed(
    { key_code: "tab", modifiers: { optional: ["left_shift"] } },
    { key_code: "left_command" }
  )  // Option+Tab (or Option+Shift+Tab) becomes Cmd+Tab (or Cmd+Shift+Tab)
```

**Another pattern - Multiple remote targets:**

```typescript
map("left_option")
  .to("left_option")
  .toIfOtherKeyPressed({ key_code: "tab" }, { key_code: "left_command" })         // App switcher
  .toIfOtherKeyPressed({ key_code: "grave_accent_and_tilde" }, { key_code: "left_command" })  // Last app
  .toIfOtherKeyPressed({ key_code: "up_arrow" }, { key_code: "page_up" })         // Scroll
```

**Why this is better than separate rules:**

- Atomic at key-press level (maintains modifier state across the remap)
- Clearer semantics than trying to differentiate via separate rules and variable state
- Naturally handles "reverse" modifiers (e.g., Shift+Tab for reverse iteration)

**Adoption path:** Safe to use for any modifier chord remap; no known limitations.

---

## Medium Priority

### Auto-Clear Active Leader After Idle

**Karabiner feature:** `set_variable` with `expression` + `system.now.milliseconds` (v15.6.0)

**Problem:** If the space leader is activated and the user walks away, the layer stays active indefinitely.

**Solution:** Record the activation timestamp with `setVarExpr`, then conditionally auto-clear the layer if enough idle time has elapsed:

```typescript
// On leader activation, record timestamp
setVarExpr('space_activated_at', '{{ system.now.milliseconds }}')

// In a periodic or next-keypress check, clear if idle > 5 seconds
exprIf('{{ system.now.milliseconds - space_activated_at > 5000 }}')
```

**Implementation note:** The `setVarExpr` and `exprIf` helpers already exist in `src/engine/resolve-conditions/`. The main change is wiring the timestamp into the leader activation manipulator.

---

### Additional Leader Layers

**Background:** `generateLayerRules` (`src/engine/leader/build.ts`) is fully generic. Any key can be a leader (see [INSIGHTS.md — Leader Layer Architecture](./INSIGHTS.md#leader-layer-architecture)).

**Potential use case:** A `tab` leader for system/media actions (sleep, cursor jump, app history navigation) that is conceptually separate from the space "apps and folders" leader.

**Implementation:** Add a second `generateLayerRules` call in `src/index.ts` with a new set of `SubLayerConfig` entries (declared in `src/definitions/`) and distinct `leaderKey`/`layerPrefix`/`indicatorRootLayer` values.

---

## Low Priority

### Formalize Expression-Driven Conditions (v15.5.19+)

**Karabiner features:** `set_variable.expression`, `set_variable.key_up_expression`, `expression_if`, `expression_unless`

**Current status:** Local typed support now exists, and expression-backed variable helpers are already in use by the leader code.

**Remaining work:**

- Audit expression strings against Karabiner beta syntax expectations
- Add a real expression-based rule that uses `expression_if` or `expression_unless`
- Validate behavior in EventViewer against the beta runtime

### Integer/HID Value Matching (v15.6.0)

**Karabiner feature:** `integer_value` in `from` event definitions.

**Use case:** Map raw HID usage codes from vendor-specific devices — USB foot pedals, programmable macro pads, or buttons that don't emit standard key codes.

**Implementation status:** Typed support exists locally via `integer_value` on `from` events.

**Review trigger:** Only worth adopting when a real device emits the same `pointing_button` with distinct integer payloads, such as a multi-button foot pedal.

---

### Extended Mouse Button Support (v15.6.0)

**Karabiner feature:** Mouse buttons 33–255 now supported (previously capped at button1–button32).

**Use case:** Multi-button mice, pen tablet side buttons, or gaming mice with many programmable buttons.

**Current status:** The config maps no mouse buttons beyond standard. This is a no-op until a device with extended buttons is in use.

---

## Reference

- [Karabiner-Elements release notes](https://karabiner-elements.pqrs.org/docs/releasenotes/)
- [set_variable expression docs](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to/set-variable/)
- [expression_if / expression_unless conditions](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/conditions/expression/)
