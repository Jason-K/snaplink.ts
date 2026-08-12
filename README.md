# Karabiner Config

Personal Karabiner-Elements configuration, written in TypeScript and compiled to
`~/.config/karabiner/karabiner.json`.

This project was originally built on the upstream `karabiner.ts` package. It has
since diverged far enough to be self-contained — there is no runtime dependency
on upstream, and `src/types/karabiner.ts` carries its own copy of the
Karabiner-Elements JSON schema.

## What this is

A compiler. You write bindings in a small typed DSL; it emits Karabiner JSON:

```
src/definitions/   Binding[]        what should this key do?
        ↓
src/engine/        Manipulator[]    how does that become Karabiner JSON?
        ↓
karabiner.json
```

Everything under `src/engine/` is a pure transformation. `src/index.ts` is the
only module that touches the filesystem, the clock, or the environment.

## Quick start

```bash
npm run generate     # compile and write karabiner.json (no Hammerspoon reload)
npm run build        # generate, then reload Hammerspoon
npm run check        # typecheck + lint + tests
```

To change a binding, edit a file in `src/definitions/` and run `npm run build`.

## Layout

| Path | Role |
| --- | --- |
| `src/definitions/` | **The edit surface.** One `Binding[]` per concern: single keys, modified keys, caps lock, mouse, guards, disabled hotkeys, chords. |
| `src/data/` | Registries and constants. `primitives/` are the type definitions; `registries/` are the lookup tables (apps, commands, paths, URLs, devices, hotkey combos); `constants/` are fixed values (keys, timings, mouse buttons). |
| `src/engine/` | Rule generation. The only layer that constructs manipulators. |
| `src/types/` | The Karabiner-Elements JSON schema, plus shared type utilities. |
| `src/config.ts` | Assembles every binding set into the ordered rule list. Pure. |
| `src/index.ts` | Build entry point: resolve profile, compile, write. |
| `src/explain.ts` | `--explain` CLI (see below). |
| `src/tests/` | Engine tests over synthetic fixtures, plus output invariants and the golden file. |

Inside `src/engine/`, each pass gets a directory:

| Path | Pass |
| --- | --- |
| `resolve-trigger/` | `Trigger` → `from` event (keys, chords, tap-hold, devices) |
| `resolve-to-action/` | `ActionSpec` → `to` events. `action-handlers.ts` is the registry. |
| `resolve-conditions/` | `Condition` → Karabiner condition. `condition-handlers.ts` is the registry. |
| `resolve-cases/` | Group cases by condition into manipulators |
| `resolve-description/` | Synthesize human-readable rule descriptions |
| `emit-manipulators/` | Assemble the final `Manipulator[]` for one binding |
| `emit-rules/` | Group bindings into rules and order them (see below) |
| `analyze-conflicts/` | Detect rules that other rules make unreachable |
| `config-writer.ts` | The single atomic writer for `karabiner.json` |

## Authoring a binding

```ts
bind(
  from("q"),                                    // trigger
  to(
    release(key("q", { halt: true })),          // tap
    hold(openApp(APP_ID.qspace)),               // hold
  ),
  when(condApp(APP_ID.finder)),                 // conditions (optional)
  options({ timing: { holdMs: 200 } }),         // options (optional)
);
```

- `from(key, modifiers?)` — a single key, or `from([a, b])` for a chord.
- `to(...cases)` — `press()`, `release()` / `tap()`, `hold()`, `doubleTap()`,
  `guard()`. Chain `.when(...)` on a case to scope it.
- Actions: `key()`, `map()`, `openApp()`, `openUrl()`, `shell()`, `openFolder()`,
  `setVar()`, `sequence()`, `noop()`, and the rest of `ActionSpec`.
- Conditions: `state()`, `unless()`, `ifState()`, `condApp()`, `condVar()`, `condDevice()`.
  - `state(spec1, spec2, ...)` — Flexible builder (assumes true by default; accepts tuple overrides like `[VARS.wheelDown, 0]`).
  - `unless(spec1, spec2, ...)` — Enforces all listed variables, apps, or devices to be false/inactive/negated.
  - `ifState(spec1, spec2, ...)` — Enforces all listed variables, apps, or devices to be true/active.

Descriptions are derived automatically from the trigger, conditions, and
actions — you only set `description` to override.

## The caps lock layer

Caps lock is a modifier layer. It emits nothing while held; every non-modifier
key pressed during the hold comes out with ⌘⌥⌃⇧ *minus* whichever single
left-side modifier is also held:

| Held | Emitted | Example |
| --- | --- | --- |
| caps | ⌘⌥⌃⇧ + key | caps+A → ⌘⌥⌃⇧A |
| caps + ⇧ | ⌘⌥⌃ + key | caps+⇧+A → ⌘⌥⌃A |
| caps + ⌃ | ⌘⌥⇧ + key | caps+⌃+A → ⌘⌥⇧A |
| caps + ⌥ | ⌘⌃⇧ + key | caps+⌥+A → ⌘⌃⇧A |
| caps + ⌘ | ⌥⌃⇧ + key | caps+⌘+A → ⌥⌃⇧A |

Tapping caps — releasing it without any key having gone through the layer —
emits ⌘⌥⌃⇧+F15 instead. Right-side modifiers and `fn` are not layer selectors;
they pass through untouched, and pressing one does not count as using the layer.
Holding *two* of the four selectors is deliberately unhandled: no state claims
the event and the key falls through unchanged.

A `from.any` catch-all sits last in the layer and is what makes "unhandled" safe.
Anything no state claimed — two selectors at once, or a key outside
`CAPS_LAYER_KEYS` — still marks the layer used and is re-sent verbatim with
`to.from_event`. Without it, an unhandled hold would leave the tap armed and fire
⌘⌥⌃⇧+F15 on release, on top of whatever the fall-through produced. The modifier
keys are claimed just ahead of it for the same reason in reverse: `from.any`
matches them too, and `caps → ⇧ → release` has to stay a tap.

**Order does not matter.** `caps → ⇧ → A`, `⇧ → caps → A` and pressing caps and
⇧ together all produce ⌘⌥⌃A. Only the modifier state at the moment the
non-modifier key goes down is read — which is why the layer cannot be built the
obvious way, by having caps hold ⌘⌥⌃⇧ down for the duration of its press. That
fixes the emitted set at caps' key-down, so pressing ⇧ afterwards changes
nothing. Reading the state at the *translated* key means every key needs its own
manipulator; `capsLayer()` in `src/engine/caps-layer.ts` generates them, one per
(key × layer state). `CAPS_LAYER_KEYS` is the list it covers: letters, digits,
symbols, F1–F24, the navigation block and the keypad. The hand-written parts of
that list carry a `satisfies StandardKeyCode[]`, because Karabiner rejects a
whole config over one unknown key code rather than skipping the key.

The keypad is covered despite `DEVICE_CONFIGS` remapping several of its keys
per-device: simple modifications run *before* complex modifications, so a
remapped key reaches the layer already rewritten and the layer only ever sees
the post-remap code.

Two mechanisms carry the state, and the split is deliberate:

- **The layer flag** is a Karabiner variable (`caps_lock_pressed`). It has to be
  — the key emits nothing, so there is no modifier flag to match on. A second
  variable (`caps_lock_used`) distinguishes a tap from a hold that translated
  something; it is read back on key-up through a per-event `to.conditions` gate,
  because `to_if_alone` is cancelled by *any* intervening key-down, a modifier
  press included.
- **The layer selectors** are `from.modifiers.mandatory`, not variables.
  Karabiner matches mandatory modifiers against the held set regardless of press
  order, and *removes* them from the emitted event — order-independence and
  modifier consumption both come free. A variable could give neither: the
  physical ⇧ would still be down, so the emitted key would carry a ⇧ the layer
  is supposed to have eaten.

**Existing rules are adopted, not shadowed.** Karabiner does not feed its own
output back through complex modifications, so a layer that merely *emits*
⌘⌥⌃⇧+E could never reach a rule bound to ⌘⌥⌃⇧+E — the combination never arrives
as an input event. So the generator joins against the rest of the configuration
at compile time: any binding whose trigger is exactly the combination a layer
state emits is adopted, and caps+E runs that binding's actions directly.

```
bind(from("e", VMOD.COCS), to(release(map(COMBOS.focusWinRight))))
        ↓  adopted into the base layer
caps + E  →  focusWinRight        (not ⌘⌥⌃⇧+E, which nothing would catch)
```

Matching is side-insensitive, so `VMOD.COCS` and `["L.cmd","L.opt","L.ctrl","L.shift"]`
both adopt. Adoption is additive — the source binding is untouched and still
fires from a real modifier press — and it extends coverage past
`CAPS_LAYER_KEYS`, so a binding on a key the grid does not list still reaches
the layer. Where an adopted key *is* in the grid, the adoption replaces the
generated emit rather than joining it. Add a `⌘⌥⌃+X` binding and it becomes
caps+⇧+X automatically.

An adopted binding keeps every case it had — tap, hold, double-tap and
double-tap-hold all survive the change of trigger, and a multi-tap gets its own
pending-tap variable so it cannot resolve the original's pending first tap.
Where a tap-hold defines only one of the two phases, the other is filled with
the layer's own combination rather than a bare key, matching what the source
binding did under real modifiers.

Three cases are left to emit the combination instead:

- **Nothing adopted that key** — the ordinary path, `caps+A → ⌘⌥⌃⇧A`.
- **Every adoption is conditional** — the emitted combination is kept as a
  fallback below them, so caps+key still does something when no condition holds.
- **The binding uses `guard()`** — `buildGuard()` requires the guard to be the
  binding's only case, so the layer's bookkeeping cannot be injected into it.
  A confirm-before-fire guard is written against one specific combination
  anyway.

## Rule emission

A *manipulator* is what fires; a *rule* is what the Karabiner-Elements GUI shows
and the user enables or disables. The two are not one-to-one, and how bindings
are folded into rules is what makes the generated list navigable.

**One trigger, one rule.** Every binding that resolves to the same trigger — same
keys, same mandatory modifiers — is emitted into a single rule, whichever
definition file it came from. Optional modifiers do not split a rule: a pointer
binding scoped to "no modifier" and one scoped to "any modifier" are one entry.
The merged rule's description folds every binding's cases into one label.

Inside a rule, conditional manipulators come before unconditional ones, so an
`Always:` fallback cannot swallow events meant for an `In Skim:` case.

**Rules are ordered by their trigger**, not by declaration order:

1. more mandatory modifiers before fewer — `⌘⌥⌃⇧+A` ▸ `⌘⌥⌃+A` ▸ `⌘+A` ▸ `A`
2. at equal count, ⌘ before ⌥ before ⌃ before ⇧ — `⌘⌥+A` ▸ `⌘⌃+A` ▸ `⌥⌃+A`
3. key triggers before pointer-button triggers
4. keys alphabetically, digits compared numerically — `⌘+A` ▸ `⌘+Z`, `F2` ▸ `F10`
5. finally the modifiers' sides — unsided, then left, then right

This is also Karabiner's evaluation order, so it is load-bearing rather than
cosmetic: the specific `⌘⌥+H` is reached before the general `⌘+H`, which is
reached before bare `H`.

Two things sort ahead of everything, because trigger order cannot express them:

- **Chords** generated from `simultaneousMappings`, because a single-key rule can
  consume a chord's first key-down.
- **The caps lock layer**, because its manipulators carry no mandatory modifiers
  and would otherwise tie with — and lose to — the plain rule for the same key.

**Merging unrelated triggers.** `options({ ruleGroup: { id, description } })` puts
several distinct triggers in one rule under one hand-written label. `capsLayer()`
uses it so that the caps lock layer is one row instead of one per key it covers.

## Conflict detection

Karabiner evaluates complex modifications top-down and stops at the first
manipulator that matches. A rule is therefore **dead** if an earlier rule
matches strictly more inputs under strictly weaker conditions.

`buildRules()` checks every ordered pair before emitting anything — over the
*planned* order above, not the declaration order — so an unreachable binding
fails the build rather than sitting silently dead in your config. Conflicts are
classified, not merely detected:

| Kind | Meaning | Result |
| --- | --- | --- |
| `duplicate` | Same input domain, same conditions | **build fails** |
| `shadowed` | An earlier, broader rule covers this one entirely | **build fails** |
| `chord-member` | A single-key rule precedes a chord using that key | warning |
| `narrowing` | Overlapping inputs, more specific rule ordered first | fine, not reported |

`chord-member` is a warning rather than an error because reachability there
depends on press timing and the simultaneous threshold, which static analysis
cannot decide.

Two rules that share a trigger but have provably disjoint conditions — `var == 1`
against `var != 1`, or two different frontmost apps — are **not** a conflict. This
is why plain signature-equality checking is not enough.

## Debugging a binding

```bash
npm run explain -- q            # every rule that can claim q, in order
npm run explain -- cmd+q
npm run explain -- L.cmd+d      # sided modifiers
npm run explain -- j,k          # a chord
npm run explain -- --conflicts  # full conflict report
```

The first *reachable* rule in the list is the one that fires.

## Safety

`karabiner.json` is also owned by the Karabiner-Elements GUI, so the writer is
careful:

- One read, one in-memory build, one atomic temp-file + `rename` write.
- A timestamped backup in `backups/` before every write (10 retained).
- Any failure throws and exits non-zero — a build that could not write must not
  look successful, because `npm run build` reloads Hammerspoon next.

## Tests

- **Engine tests** (`binding.test.ts`, `case-helpers.test.ts`,
  `action-handlers.test.ts`, `condition-handlers.test.ts`,
  `analyze-conflicts.test.ts`, …) use synthetic fixtures defined in the test.
  They never import from `src/definitions/`, so editing your keymap cannot
  break them.
- **`output-invariants.test.ts`** asserts properties that hold for any keymap:
  to-event well-formedness, no conditions reading variables nothing writes,
  parameter ranges.
- **`golden-output.test.ts`** diffs the compiled config against the committed
  `karabiner-output.json`. When a change is intentional:

  ```bash
  UPDATE_GOLDEN=1 npm test
  ```

  then review the `karabiner-output.json` diff before committing.

## Extending the engine

Adding a Karabiner feature is two edits, and the compiler checks the second:

**A new `to` action** — add the variant to `ActionSpec` in
`src/data/primitives/actions.ts`, then add its entry to `ACTION_HANDLERS` in
`src/engine/resolve-to-action/action-handlers.ts`. The `satisfies ActionHandlers`
annotation fails the build naming the tag you missed. Add a builder function in
`to-action-wrappers.ts` if you want a nicer call site.

**A new condition** — add the variant to `Condition` in
`src/data/primitives/bindings.ts`, extend `conditionKind()`, then add its entry
to `CONDITION_HANDLERS` in `src/engine/resolve-conditions/condition-handlers.ts`.
That entry must supply `contradicts`, so a new condition type cannot be added
without stating how conflict analysis should treat it.

## Documentation

| Document | Answers |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How a `Binding` becomes a Karabiner rule; what each layer may and may not do |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | The rules for changing the code, and the byte-identical gate every refactor must pass |
| [docs/INSIGHTS.md](docs/INSIGHTS.md) | Karabiner manipulator semantics as they bear on this engine |
| [docs/MISSING_FEATURES.md](docs/MISSING_FEATURES.md) | What Karabiner can do that this config cannot yet emit, and how to wire each one |
| [docs/SCHEMA.md](docs/SCHEMA.md) | The rule schema, the validator, and how both hook into the build |
| [docs/COMMAND_SERVER_GUIDE.md](docs/COMMAND_SERVER_GUIDE.md) | The user-command IPC subsystem |
| [docs/karabiner_docs/](docs/karabiner_docs/) | Mirrored upstream documentation, plus `karabiner-gotchas.md` — 80+ behaviours, each cited |

Two checks keep these honest, both in `npm run check`:
`src/tests/docs-paths.test.ts` fails on a stale `src/` path or a broken link, and
`src/tests/schema-coverage.test.ts` fails when MISSING_FEATURES.md disagrees with
what the DSL can actually emit.
