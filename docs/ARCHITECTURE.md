# Architecture

How a hand-authored `Binding` becomes a Karabiner rule. Read this before
changing anything under `src/engine/`.

Written against the tree as it stands; every path here is checked by
`src/tests/docs-paths.test.ts`.

## Layers

| Layer | Holds | May not |
|-------|-------|---------|
| `src/definitions/` | Behaviour as data: `Binding[]`, one export per file | Build manipulators, import `src/types/karabiner` for anything but a raw escape hatch |
| `src/data/` | Vocabulary and registries: apps, paths, devices, timings, key aliases, virtual modifiers | Contain logic |
| `src/engine/` | Every transformation from `Binding[]` to `Manipulator[]` | Touch the filesystem, the clock, or the environment |
| `src/types/` | The Karabiner JSON AST, plus the generated key tables | Contain anything hand-written that could be derived |
| `src/config.ts` | Assembles the binding sets and runs the pipeline | Do I/O — it is imported by tests |
| `src/index.ts` | The only module that reads the environment and writes files | — |

The purity rule is what lets `src/tests/golden-output.test.ts` compile the real
configuration and diff it against the committed output with no mocks.

## Pipeline

```
src/definitions/*          Binding[]
      │
      ▼
src/config.ts              BINDING_SETS + CAPS_LAYER_SET
      │                    planRules()      → order rules by trigger specificity
      │                    assertNoConflictsInOrder()  → throws on unreachable rules
      ▼
src/engine/emit-rules/     RulePlan[]
      │
      ▼
src/engine/emit-manipulators/
      │  compile-binding.ts calls, in order:
      │    resolve-trigger/     Trigger      → from
      │    resolve-cases/       Case[]       → condition groups, phases folded
      │    resolve-conditions/  Condition[]  → Karabiner conditions
      │    resolve-to-action/   ActionSpec[] → ToEvent[]
      │    resolve-description/ the string Karabiner's UI shows
      ▼
Manipulator[]  →  Rule[]  →  karabiner-output.json + ~/.config/karabiner/karabiner.json
```

`src/engine/analyze-conflicts/` runs over the *planned* order, not declaration
order, and throws rather than warns: a binding an earlier rule makes unreachable
fails the build instead of sitting dead in the config.

## The `Binding` surface

Defined in `src/data/primitives/bindings.ts`. One binding = one description =
one rule.

```ts
type Binding = {
  description: string;          // also the rule-partition key
  trigger: Trigger;             // keys / pointer / any
  timing?: { aloneMs?; heldThresholdMs?; delayedMs?; simultaneousMs? };
  conditions?: Condition[];     // hoisted onto every case
  cases: Case[];
  eventOptions?: { halt?; repeat? };
  multiTap?: { allowPassThrough?; mods? };
  afterKeyUp?: ActionSpec[];
};

type Case = {
  tapCount?: number;            // default 1; 2 = double-tap (framework-managed state)
  phase?: "press" | "release" | "hold";   // → to / to_if_alone / to_if_held_down
  conditions?: Condition[];
  do: ActionSpec[];             // { type: "noop" } swallows the key
};
```

`trigger.keys` may hold unresolved aliases — `{ keys: ["R.cmd"] }` is resolved
during manipulator generation, not at construction. See `TriggerKey` in
`src/data/constants/keys.ts` for the three vocabularies it accepts.

`to_delayed_action` is deliberately *not* a phase. Every use is
framework-internal: the multi-tap variable dance and tap-on-interrupt
responsiveness.

## The action vocabulary

`ActionSpec` in `src/data/primitives/actions.ts` is the single output vocabulary.
`src/engine/resolve-to-action/` is the only path from an `ActionSpec` to a
`ToEvent`, dispatching through the handler registry in
`resolve-to-action/action-handlers.ts` — each entry supplies `toEvents` and
`describe`.

`sequence` flattens recursively at resolve time. `noop` resolves to no events, so
the manipulator omits `to` entirely — distinct from `{ type: "key", key: "vk_none" }`,
which emits a real event.

Raw `ToEvent` objects are accepted alongside `ActionSpec` (`Action = ActionSpec | ToEvent`)
for the handful of cases the DSL does not model. Reach for that only after
checking [MISSING_FEATURES.md](./MISSING_FEATURES.md) — if the gap is general,
wire it properly instead.

## Specialized shapes

Three behaviours do not decompose into cases and build their own manipulators:

| Shape | Where | Why it is special |
|-------|-------|-------------------|
| caps-lock layer | `src/engine/caps-layer.ts` | Variants change the *trigger*, not the action. Adopts bindings whose mandatory modifiers match what a layer state emits. It takes every other binding as input and returns `Binding[]`, which is the model to copy for any future layer. |
| double-tap guard | `buildGuard()` in `src/engine/emit-manipulators/binding/builders.ts` | The second tap fires on press, not release. |

## Adding a behaviour

1. Write or extend a `Binding[]` export in `src/definitions/`.
2. Register it in `BINDING_SETS` in `src/config.ts` if it is a new set.
3. `npm run check`.

If step 1 needs a Karabiner feature the DSL cannot express, that is
[MISSING_FEATURES.md](./MISSING_FEATURES.md) — it carries the file-by-file
recipe for each of the three extension shapes.

## Related

- [CONVENTIONS.md](./CONVENTIONS.md) — the rules this structure exists to serve
- [INSIGHTS.md](./INSIGHTS.md) — Karabiner semantics that shaped the pipeline
- [SCHEMA.md](./SCHEMA.md) — the contract and how it is validated
