# Conventions

Rules for changing this codebase. Derived from a full-tree review (2026-08-01),
kept because they are still the operating constraints — the review narrative
itself has been retired.

This project is a **compiler**, not an app:

```
Binding[] (hand-authored DSL)  →  resolve*  →  Manipulator[]  →  karabiner.json
     ^ source language              ^ passes      ^ target IR       ^ codegen
```

Compiler practices pay off here far more than generic advice.

## The target schema is a contract you do not own

Karabiner's JSON schema belongs to someone else and changes between releases.

- **Never `any` inside the target AST.** An `any` in `ToEvent` turns a schema
  change into silently-wrong JSON instead of a type error.
- **Validate the emitted JSON before writing it.** The only other feedback
  channel is Karabiner silently refusing to load a rule. `npm run validate`
  checks the build output against `schema/karabiner-rule.schema.json`; the
  structural checks live in `src/tests/schema-conformance.test.ts`.

## Derive, never duplicate

Anywhere the same fact is written twice — a union and a `Set` of its members, a
key table and a hand-listed subset — one copy will drift. Derive the second from
the first with `keyof`, `Extract`, `satisfies`, `as const`.

`satisfies Record<Modifier, true>` in `src/data/constants/keys.ts` is the
reference example: it is exhaustive in both directions, so `npm run codegen`
widening `Modifier` after an upstream release breaks the build until the object
is updated. The hand-written list it replaced had silently fallen four names
behind.

The key tables themselves are generated — `src/types/keys.generated.ts` comes
from `scripts/gen-key-types.ts` and is never hand-edited. `npm run codegen:check`
fails if it is stale.

## Make illegal states unrepresentable, then check exhaustively

`ActionSpec`, `Condition` and `Trigger` are each consumed by several passes.
The guarantee worth having: **adding a union member breaks the build everywhere
that must handle it.** That means `switch` plus `const _: never = x`. A consumer
using `Set<string>`, a `default:` branch, or `"key" in obj` duck-typing is a
place where a new member fails silently.

In the AST, exclusivity is enforced structurally: `ExactlyOne<T>` in
`src/types/karabiner.ts` forbids sibling keys outright, so
`{ key_code, shell_command }` — which parses but does one thing at random — will
not typecheck.

## Correctness properties belong in the compiler, not in tests over the config

"Does rule X exist" is *data*, and data changes weekly. What deserves a test is
the *invariant*: no two rules may claim the same physical input under
overlapping conditions. Encode invariants as pipeline passes that throw
(`assertNoConflictsInOrder`), and test the passes.

## Overlap analysis, not equality

Conflict detection is a set-intersection problem over (input event × modifier
set × condition predicate). Two rules conflict when their input domains
intersect *and* their condition predicates can both hold. String equality of a
signature catches only the trivial case and produces false positives on the
mutually-exclusive pairs the caps layer depends on.

This is why a new condition type must supply identity and implication functions
in `src/engine/resolve-conditions/condition-handlers.ts` — a condition that
reports no relationships reads as always-conflicting.

## Side effects at the edge

`src/index.ts` is the only module permitted to touch the filesystem, the clock,
or the environment. Everything under `src/engine/` is `input → output`. That is
what makes the compiler testable without mocks, and what lets `src/config.ts` be
imported by tests.

## Writes to user-owned files are atomic, backed up, and loud

`~/.config/karabiner/karabiner.json` is a file the user also edits through a
GUI. Clobbering it is the worst failure this project can cause. Temp file plus
`rename()` is the minimum; a timestamped backup and a non-zero exit are the
rest. See `src/engine/config-writer.ts`.

`CI=true` forces `src/index.ts` down its dry-run path, writing only the
workspace copy. Every schema make target sets it.

## Compiler strictness beyond `strict`

Both of these are on, and both are load-bearing:

- `noUncheckedIndexedAccess` — the codebase writes `keys[0]!` as if it were on.
- `exactOptionalPropertyTypes` — objects are built with `...(x ? { k: x } : {})`
  specifically to keep `undefined`-valued keys out of the emitted JSON.

`ExactlyOne<T>` depends on the second: `?: never` means "absent", not "may be
undefined".

## The byte-identical gate

Any refactor that is not meant to change behaviour must leave
`karabiner-output.json` byte-identical. Rebuild and diff:

```bash
CI=true npm run generate && git diff --exit-code karabiner-output.json
```

Serialization is insertion-order sensitive, so this covers more than it looks
like: object key order, array order across manipulators, conditions and
to-events, and the exact description strings. `src/tests/golden-output.test.ts`
enforces it in CI. Work in one-change-rebuild-diff steps and fix drift before
the next change — a batch of changes with a non-empty diff is very hard to
bisect by eye.

## Barrels are an API

`export *` over a large surface is an authoring hazard. Prefer curated
re-exports (`export { x, y } from "..."`), which also turns an ambiguous
re-export into a compile error instead of a silent drop.

## Known deviations

Two findings from the 2026-08-01 review are still open. Both are authoring
ergonomics rather than correctness:

| | |
|---|---|
| Six functions named `map` are reachable from definition files | Ambiguity at the authoring surface; the barrel does not disambiguate. |
| Six `delete this.x` sites in the builders | `CaseBuilder` fakes optional fields with `declare` + `delete` rather than building the object once. |

`@typescript-eslint/no-explicit-any` is `warn` globally and `off` only under
`src/tests/`, where tests deliberately construct malformed input. The warning
budget is capped at 81 in `npm run lint`; treat that ceiling as a ratchet that
only moves down.

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md) — what the structure actually is
- [MISSING_FEATURES.md](./MISSING_FEATURES.md) — the extension recipes
