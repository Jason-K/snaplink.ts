# Karabiner rule schema

Machine-readable reference for authoring and validating Karabiner-Elements
complex modifications. Built for agent consumption: load
`schema/karabiner-rule.schema.json` to constrain generation,
[karabiner-gotchas.md](./karabiner_docs/karabiner-gotchas.md) to avoid known
traps, and run `schema/validate_karabiner.py` before writing any rule to disk.

The artifacts live in `schema/` at the repo root; the shell examples below are
written from that directory. What the DSL cannot yet reach is tracked separately
in [MISSING_FEATURES.md](./MISSING_FEATURES.md).

## Files

| File | Purpose |
|------|---------|
| `schema/karabiner-rule.schema.json` | JSON Schema draft 2020-12 for a complex-modifications asset file, rule, manipulator, `from`/`to` event definition, condition, and parameters. Self-contained (key-code enums inlined). |
| `schema/karabiner-keycodes.json` | The six key-name tables, extracted separately for lookup/completion: `key_code` (207), `consumer_key_code` (130), `pointing_button` (255), `apple_vendor_keyboard_key_code` (10), `apple_vendor_top_case_key_code` (7), `generic_desktop` (7). |
| [`docs/karabiner_docs/karabiner-gotchas.md`](./karabiner_docs/karabiner-gotchas.md) | 80+ documented and undocumented behaviors, each cited to a doc path or source file. Undocumented items are tagged `[UNDOCUMENTED]`. |
| `schema/validate_karabiner.py` | CLI validator. |
| `schema/Makefile` | Validation, dry-run build, and hook install targets. |
| `schema/hooks/pre-commit` | Git hook that validates staged output against the schema. |

## Usage

```bash
cd schema
pip3 install jsonschema

# whole asset file (default)
./validate_karabiner.py ~/.config/karabiner/assets/complex_modifications/*.json

# a fragment
./validate_karabiner.py --node rule my_rule.json
./validate_karabiner.py --node manipulator one_manipulator.json
./validate_karabiner.py --node condition cond.json     # also: --node from, --node to

# accept key-code names newer than this schema
./validate_karabiner.py --lenient new_rule.json
```

Exit status: `0` valid, `1` validation errors, `2` usage or schema error.
`//` and `/* */` comments are stripped before parsing, matching Karabiner's tolerance.

Editor integration — add to VS Code `settings.json`:

```json
"json.schemas": [
  {
    "fileMatch": ["**/karabiner/assets/complex_modifications/*.json"],
    "url": "/absolute/path/to/snaplink.ts/schema/karabiner-rule.schema.json"
  }
]
```

## Schema entry points

`$ref` any of these against the schema file:

| Node | Covers |
|------|--------|
| `#/$defs/complexModificationsFile` | default root: `{title, rules}` (`--node file`) |
| `#/$defs/complexModificationsBlock` | build output: `{complex_modifications: {rules}}` (`--node output`) |
| `#/$defs/karabinerConfig` | full `karabiner.json`; permissive outside `complex_modifications` (`--node karabiner`) |
| `#/$defs/rules` | a bare array of rules (`--node rules`) |
| `#/$defs/rule` | `{description, manipulators}` |
| `#/$defs/manipulator` | dispatches on `type` to basic / mouse_basic / mouse_motion_to_scroll |
| `#/$defs/fromEventDefinition` | `from` |
| `#/$defs/toEventDefinition` | one entry of `to`, `to_if_alone`, etc. |
| `#/$defs/condition` | dispatches on `type` across all 7 condition families |
| `#/$defs/parameters` | `basic.*` and `mouse_motion_to_scroll.speed` |

Manipulator and condition use `if`/`then` dispatch on `type` rather than `oneOf`, so
validation errors point at the actual offending property instead of reporting that
nothing matched.

## Validation coverage

- 78/78 rule examples in the official documentation pass.
- 842 files / 15,816 manipulators from `pqrs-org/KE-complex_modifications`: 3 errors in
  3 files, all the same genuine typo (`basic.to_if_alone_threshold_milliseconds`, a
  parameter name Karabiner silently ignores).

## Deliberate strictness

The schema is stricter than the parser in four places, each chosen to catch real bugs:

1. **`parameters`** rejects unknown names. Karabiner ignores them silently, which is how
   the typo above has survived in a published rule.
2. **`to` entries** require exactly one event key. An entry with none parses but does nothing.
3. **`from`** requires exactly one of the event keys / `any` / `simultaneous`.
4. **Key-code names** are enums. Use `--lenient` if Karabiner adds names after
   2026-08-12; that flag relaxes the name enums to free strings while keeping all
   structural checks.

Unknown keys **are** permitted at file and rule level, where generators legitimately
add metadata (`version`, `repo`, `maintainer`, `enabled`, `_comment`).

## Provenance

- Structure and prose: `pqrs-org/pqrs.org`, `sites/karabiner-elements/content/en/docs/json/`
- Key-name tables: `pqrs-org/Karabiner-Elements` at `src/share/types/momentary_switch_event_details/*.hpp` (paths in that repository, not this one)
  (the parser's own tables — broader than the UI's `simple_modifications.json`, which
  omits `key_code: eject`, `consumer_key_code: power`/`voice_command`, and
  `apple_vendor_keyboard_key_code: expose_all`)
- Accepted keys, aliases, defaults and clamps: same repository, `src/share/manipulator/**`
  and `src/share/core_configuration/details/profile/complex_modifications_parameters.hpp`

Both repositories were read at `main` on 2026-08-12. Regenerate the schema by re-running
the extraction against a newer checkout if Karabiner adds key names or parameters.

## Build integration

The schema is a build input, not documentation — three code paths read it:

| reader | reads |
|--------|-------|
| `scripts/gen-key-types.ts` | the key-name tables and the modifier enum, to generate `src/types/keys.generated.ts` |
| `src/coverage.ts` | the capability surface, to report what the DSL cannot emit |
| `src/tests/schema-conformance.test.ts` | `$defs.manipulatorBasic` and `$defs.parameters`, to reject keys Karabiner would hard-error on |

plus `schema/validate_karabiner.py`, which runs the whole schema against the
build output. That is why it lives in `schema/` rather than here.

The TypeScript config compiles to two artifacts: `karabiner-output.json` in the repo
(shape `{"complex_modifications": {"rules": [...]}}`) and the live
`~/.config/karabiner/karabiner.json`. Each has its own schema node.

```bash
make -C schema deps            # one-time: jsonschema into the shared venv
make -C schema validate        # build output + live config
make -C schema install-hooks   # symlink hooks/pre-commit into the config repo
```

Day to day you do not call these directly — the npm scripts wrap them:

| script | does |
|--------|------|
| `npm run codegen` | regenerate `src/types/keys.generated.ts` from the key tables |
| `npm run codegen:check` | fail if that generated file is stale |
| `npm run validate` | `make -C schema validate-output` |
| `npm run verify` | dry-run generate, then validate |
| `npm run coverage` | schema capabilities vs. what the DSL can emit |
| `npm run check` | codegen:check -> typecheck -> lint -> test -> verify |

`make generate` and the hook's drift check both run the build with `CI=true`, which
forces `src/index.ts` down its dry-run path — `karabiner.json` is never written, only
the workspace copy. Nothing here can modify your live config.

Override paths with `KARABINER_SRC=`, `KE_CONFIG=`, `KE_ASSETS=` on any target.
`LENIENT=1` relaxes the key-code name enums.

### Pre-commit hook

`make install-hooks` symlinks `hooks/pre-commit` into the config repo's real hooks
directory (resolved via `git rev-parse`, so the submodule gitdir is handled). Any
existing non-symlink hook is backed up with a timestamp first.

On commit it reads blobs **from the index**, not the worktree, so what gets validated
is what gets committed:

1. If `karabiner-output.json` is staged → validate as `--node output`.
2. If any `complex_modifications/*.json` is staged → validate as `--node file`.
3. Commits touching neither those files nor `src/` exit immediately.

Escape hatches: `git commit --no-verify`, or `KARABINER_HOOK_SKIP=1`.
Opt-in drift check: `KARABINER_HOOK_REGEN=1 git commit ...` regenerates and fails if the
committed output is stale relative to `src/`. It is off by default because it touches
the worktree; the hook restores the original file on any exit path.

If you use the `pre-commit` framework instead, add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: karabiner-schema
        name: karabiner schema
        entry: python3 ~/Scripts/apps/karabiner/snaplink.ts/schema/validate_karabiner.py --node output
        language: system
        files: ^karabiner-output\.json$
        pass_filenames: true
```

Logs (ISO 8601, UTC) go to `~/.local/state/karabiner/snaplink.ts/schema/log.txt`.
