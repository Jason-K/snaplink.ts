# Karabiner Patterns

Manipulator semantics as they bear on *this* engine — why the pipeline is
shaped the way it is, and the failure modes it exists to prevent.

General Karabiner behaviour with upstream citations lives in
[karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md); where the two
overlap, that file is authoritative because its claims are sourced. This file
keeps only what is specific to the code here.

Day-to-day work in `src/definitions/` should need none of it: write data and let
the engine compile it.

## Variable Conditions Are Manipulator Gates

`variable_if` and `variable_unless` prevent the **entire** manipulator from firing when their predicate fails. They are not filters on individual `to` events.

- Don't use `variable_unless` to "stop a manipulator from setting a variable twice" — that prevents the manipulator from running at all, and on the second press the variable will never be re-asserted.
- For per-event branching, attach `conditions` to the individual `to` event
  (`ToEventOptions.conditions`, KE 15.3.7+) rather than to the manipulator. Those
  are evaluated once, before the first event of the array is processed — so a
  `set_variable` earlier in the same array is not visible to a later entry
  (gotcha 5.10).

## Manipulators Are Evaluated Top-to-Bottom, and Only One Ever Fires

Karabiner walks a rule's `manipulators` array from the **first** entry to the last, and "the input event is manipulated only [by] the first matched manipulator" — a manipulator matches when its `from` matches and all its `conditions` hold. Every later manipulator on that same input is ignored entirely.

- For double-tap detection, list the variable-guarded "second press" manipulator **before** the variable-setting "first press" manipulator, so the scan reaches the guarded one first. This is what `buildGuard` emits, and it matches `change_double_press_of_q_to_escape` upstream.
- More generally: a manipulator with *fewer* conditions must never precede one with more on the same trigger. The broader one matches everything the narrower one wanted.

Reference: `docs/karabiner_docs/complex-modifications-manipulator-evaluation-priority/index.md`.

## One Trigger, One Manipulator — Fold All Phases Into It

Corollary of the above, and the single most expensive mistake to make in this engine.

`to` (press), `to_if_alone` (tap/release) and `to_if_held_down` (hold) are **output channels of one manipulator**, not independent rules. So splitting a trigger's cases into one manipulator per condition set is only safe while those condition sets are *disjoint*. The moment one set is broader than another, every phase in the broader manipulator is dead in every state the narrower one claims.

The failure is silent and looks phase-specific, which is what makes it hard to spot. Given:

```jsonc
// from: button9, three manipulators
{ "conditions": ["left button held"],     "to_if_alone":     ["OCR"] }
{ "conditions": ["NOT left button held"], "to_if_alone":     ["OCR, no linebreaks"] }
{ "conditions": [],                       "to_if_held_down": ["OCR to markdown"] }  // never fires
```

the hold never runs — not because hold is special, but because the two tap manipulators partition the domain between them and the third is never reached. Swap the phases (conditional holds, unconditional tap) and the tap is the one that dies. It is a manipulator-matching property, identical for all three phases.

**The fix is to fold, not to reorder.** Each emitted manipulator must carry the complete gesture that applies under its own conditions:

```jsonc
{ "conditions": ["left button held"],     "to_if_alone": ["OCR"],               "to_if_held_down": ["OCR to markdown"] }
{ "conditions": ["NOT left button held"], "to_if_alone": ["OCR, no linebreaks"], "to_if_held_down": ["OCR to markdown"] }
```

In this engine that lives in `groupByConditions` (`src/engine/resolve-cases/resolve-cases.ts`), which folds phases *down the condition lattice*: a condition group inherits every phase slot it does not declare from the groups whose conditions it implies. Three rules make it work:

1. **Inheritance** — nearest (most-conditioned) donor wins, so a two-condition group beats an unconditional one.
2. **Specificity ordering** — a group is moved ahead of any already-placed group whose conditions it strictly implies. Groups where neither implies the other keep declaration order.
3. **Covered-fallback elimination** — a fallback sitting behind a *complementary* pair (`In Excel` / `Outside Excel`, `held` / `not held`) is unreachable and gets dropped. This needs `conditionsComplementary`, not `conditionsContradict`: contradiction only rules out "both", so `In Word` / `In Excel` contradict while leaving every other app uncovered, and dropping a fallback behind them would break the key. When coverage cannot be proven, keep the fallback — an unreachable manipulator is inert, a missing one is a dead key.

### The `press`-Only Escape Hatch

A condition group that declares nothing but `press` cases inherits nothing. `to` fires on key-down and resolves the input there and then, before any tap/hold arbitration, so it expresses "under these conditions this trigger does one immediate thing *instead of* its usual gesture" — the mouse chord idiom in `src/definitions/mouse.ts` (right button held + wheel/back/forward). Folding release and hold into those would staple the normal gesture back on top.

To opt a press-only group *into* a phase, declare it. To suppress an inherited phase, declare it empty: `hold([])`, `release([])`.

### Diagnosing It

Symptom: one phase of a multi-condition binding never fires, while the others work. Before reaching for timing parameters, dump the compiled manipulators and check for two entries with the same `from` where the earlier one's `conditions` are a subset of the later one's. That subset relation *is* the bug.

## Timing Parameters Belong on the First-Press Manipulator

Two timing parameters control tap/hold/double-tap behaviour:

- `basic.to_if_held_down_threshold_milliseconds` — how long a press must be held before `to_if_held_down` fires
- `basic.to_delayed_action_delay_milliseconds` — how long to wait before `to_delayed_action.to_if_invoked` runs

Both belong on the first-press manipulator only. Adding them to the second (double-tap detector) manipulator creates conflicting timeouts. The second manipulator's job is purely state detection.

## `to_delayed_action` Handles the Single-Tap Fallback

When the user taps a key once and waits past the timeout, `to_delayed_action.to_if_invoked` runs. When the user presses something else first (a chord) or releases quickly, `to_if_canceled` runs instead. This is how the "lazy modifier" / "tap to emit, hold to act" patterns close out:

- emit the original key from `to_if_invoked` (gated on a variable so the double-tap manipulator can suppress it)
- mirror the same emit in `to_if_canceled` for the release-before-threshold case
- clear the tracking variable in both branches

## `lazy: true` Lets Modifiers Compose with Chords

Setting `lazy: true` on a modifier `to` event delays the emit until another key actually needs that modifier.

- If a second key is pressed while the modifier is held, the modifier becomes active for that chord.
- If nothing follows, `to_delayed_action` decides whether to emit the modifier back as a bare key.

This is the mechanism that lets a single key behave as both a pass-through modifier and a tap/double-tap trigger.

## Hold Cleanup with `to_after_key_up`

For "press to emit X-down, release to emit X-up" patterns:

- emit `X` down inside `to_if_held_down`, and set a tracking variable in the same array
- emit `X` up inside `to_after_key_up`, gated on the tracking variable so it only fires when the hold path was taken
- clear the variable in the same `to_after_key_up` block

Without the variable guard, `to_after_key_up` would fire on every release — including taps that never triggered the hold.

## Debug with EventViewer

Karabiner's EventViewer shows variable state changes in real time.

- If a variable never appears, the manipulator that should set it failed its conditions — usually a `variable_if`/`variable_unless` guard or a frontmost-app condition.
- If a variable appears and disappears faster than expected, check the timeout parameters and `to_after_key_up` cleanup.
- Variable lifetimes are easier to reason about when their names are explicit (`guard_cmd_q`, `multi_tap_left_command`) rather than generic.

## State Discipline

Each additional variable widens the state space and makes failure modes harder to enumerate.

- Prefer the framework paths that auto-derive variable names from the trigger key
  (`Binding.multiTap`, and `buildGuard()` in
  `src/engine/emit-manipulators/binding/builders.ts`) so two rules cannot collide
  on a name.
- Reserve `trackVar` (and similar explicit fields) for cases where the variable is observed elsewhere — for example a `vmCOC_` chord whose state another rule reads.

## Simultaneous Chord Framework

`generateSimultaneousRules` (`src/engine/resolve-trigger/simultaneous-rules.ts`) handles rules triggered by pressing two or more keys within Karabiner's simultaneous threshold (default 50 ms).

### Tier Routing

The engine routes each chord to one of two paths:

| Condition | Path | Core function |
|---|---|---|
| `tapTap` or `tapTapHold` absent | tap-hold | `simultaneousTapHold` → `mapSimultaneous` builder |
| `tapTap` or `tapTapHold` present | multi-tap | `simultaneousMultiTap` → `varTapTapHoldFrom` |

The tap-hold path uses `mapSimultaneous` (`src/engine/karabiner-helpers.ts`), which builds the simultaneous from-event internally. The multi-tap path manually builds a raw `FromEvent` via `buildSimultaneousFromEvent` and passes it to `varTapTapHoldFrom`, which treats it like any other raw from event.

### State Variable Naming

Multi-tap chords use `sim_tap_${label}` as the first-tap tracking variable (e.g., label `"jk"` → `sim_tap_jk`). This namespacing avoids collisions with single-key multi-tap rules, which use `multi_tap_${key}`.

### Conflict Detection

Two validation checks run before generating rules:

1. **Duplicate chords** (order-aware): Two entries are duplicates when their normalized key representation AND `key_down_order` setting match. `key_down_order: "insensitive"` (or absent) normalizes by sorting keys; `"strict"` or `"strict_inverse"` preserves array order. Entries with different order modes are never flagged — they represent distinct behavioral contracts.

2. **Tap-hold overlap**: Any key appearing in a simultaneous chord that also appears as a bare (no-modifier) tap-hold key throws an error. Modifier-prefixed tap-hold entries like `"cmd+j"` are not flagged.

### Layer suppression

A chord and a layer claim the same physical keys, so any layer that stays active
after its trigger is released needs every other rule family to carry
`variable_unless` on its layer variables. Nothing does this today: the caps
layer solves the same problem by ordering rather than suppression, being emitted
ahead of everything and conditioned on `caps_lock_pressed`. See
[MISSING_FEATURES.md](./MISSING_FEATURES.md) — *Modal layers* — for why a leader
layer would need the suppression pass as well.

### Adding a Chord

Define the chord in `src/definitions/simultaneous.ts`:

```typescript
export const simultaneousMappings: Record<string, SimultaneousConfig> = {
  "jk": {
    keys: ["j", "k"],
    description: "J+K chord",
    alone: [{ type: "key", key: "escape" }],
    hold:  [{ type: "app", ref: "finder" }],
  },
};
```

The record key is the label — used for rule descriptions and variable naming. No
other files need changes: `buildRules()` in `src/config.ts` already passes
`simultaneousMappings` through `generateSimultaneousRules`, and emits chords
ahead of everything else. A single-key rule for one of a chord's members can
otherwise consume the chord's first key-down, and trigger order cannot express
that dependency.

## References

- [Karabiner-Elements official examples](https://karabiner-elements.pqrs.org/docs/json/typical-complex-modifications-examples/)
- [Double-press pattern](https://karabiner-elements.pqrs.org/docs/json/typical-complex-modifications-examples/#change-double-press-of-q-to-escape)
- [Complex modifications manipulator definition](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/)
- [`to_delayed_action` reference](https://karabiner-elements.pqrs.org/docs/json/complex-modifications-manipulator-definition/to-delayed-action/)

## Modal layers

The caps-lock layer (`src/engine/caps-layer.ts`) is the only layer this
configuration emits, and the only one implemented inside the `Binding` pipeline
— it takes every other binding as input, returns `Binding[]`, and is planned
separately in `src/config.ts` so it is emitted ahead of the plain rules for the
same keys.

A leader-key layer (tap to enter a mode, then select) is a different mechanism
and does not exist here. A pre-`Binding` implementation was removed on
2026-08-12; the variable choreography and the two ordering constraints that make
it work are recorded in
[MISSING_FEATURES.md](./MISSING_FEATURES.md) under *Modal layers (leader keys)*.
