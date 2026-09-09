/**
 * Karabiner feature coverage — what the schema says exists, versus what this
 * configuration can produce.
 *
 * `schema/karabiner-rule.schema.json` is the only artifact in the repo that
 * knows Karabiner's full capability surface. `validate_karabiner.py` uses it
 * defensively, to check what we do emit. This uses it the other way round: to
 * name what we *can't*, so a feature added upstream shows up as a gap here
 * after `make -C schema keycodes` rather than being discovered by accident.
 *
 *   npm run coverage
 *
 * Two independent columns, because they answer different questions:
 *   wired   — the emitter can produce it (a wrapper or handler names it)
 *   emitted — the current configuration actually does (it appears in the build)
 *
 * `wired: no` is a missing capability. `wired: yes, emitted: 0` is a capability
 * you have not used yet, which is fine and often deliberate.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildRules } from "./config";
import type { Manipulator, Rule } from "./types/karabiner";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_PATH = join(REPO, "schema", "karabiner-rule.schema.json");

/** Directories that constitute "the emitter". Types and tests name everything. */
const EMITTER_ROOTS = ["src/engine", "src/definitions", "src/data"] as const;

/** `toEventDefinition` keys that modify an action rather than being one. */
const TO_EVENT_OPTIONS = new Set([
  "modifiers",
  "lazy",
  "repeat",
  "halt",
  "hold_down_milliseconds",
  "held_down_milliseconds",
  "conditions",
  "description",
]);

type SchemaNode = {
  properties?: Record<string, unknown>;
  enum?: unknown[];
};

type Schema = { $defs: Record<string, SchemaNode> };

export type Feature = {
  group: string;
  name: string;
  /** The emitter names it, so a binding can ask for it. */
  wired: boolean;
  /** Occurrences in the current build output. */
  emitted: number;
};

export type Coverage = {
  features: Feature[];
  groups: { group: string; wired: number; total: number }[];
};

// ── schema side ─────────────────────────────────────────────────────────────

function loadSchema(): Schema {
  try {
    return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Schema;
  } catch (cause) {
    throw new Error(`cannot read schema/karabiner-rule.schema.json`, { cause });
  }
}

function props(schema: Schema, def: string): string[] {
  const node = schema.$defs[def];
  if (!node?.properties) throw new Error(`schema: $defs.${def}.properties is missing`);
  return Object.keys(node.properties);
}

function enumOf(schema: Schema, def: string, property: string): string[] {
  const node = schema.$defs[def]?.properties?.[property] as SchemaNode | undefined;
  const values = node?.enum;
  if (!Array.isArray(values)) throw new Error(`schema: $defs.${def}.properties.${property}.enum is missing`);
  return values.map(String);
}

// ── emitter side ────────────────────────────────────────────────────────────

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) out.push(path);
    }
  };
  for (const root of EMITTER_ROOTS) walk(join(REPO, root));
  return out;
}

/**
 * Comments are stripped before scanning: prose that *describes* a feature is not
 * the same as code that emits one. `data/primitives/expressions.ts` documents
 * `"variable_if" | "variable_unless"` in a doc block, which would otherwise
 * report both as wired regardless of what the handlers actually build.
 *
 * Line comments are only stripped when they occupy the whole line, so a `//`
 * inside a string (`raycast-x://...`) never truncates real code.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const SOURCE = stripComments(
  sourceFiles()
    .map((f) => readFileSync(f, "utf8"))
    .join("\n"),
);

/** Named anywhere in the emitter — right for keys the emitter spells literally. */
function namedInSource(token: string): boolean {
  return new RegExp(`\\b${token}\\b`).test(SOURCE);
}

/**
 * Assigned as a discriminant, e.g. `type: "basic"`.
 *
 * Used only for manipulator types, where a bare mention lies: `profiles.ts`
 * sets `"mouse_motion_to_scroll.speed"` as real code, which would make the
 * `mouse_motion_to_scroll` manipulator look reachable when nothing emits one.
 *
 * Condition types deliberately use {@link namedInSource} instead — the handlers
 * build them through ternaries (`type: c.unless ? "variable_unless" : ...`),
 * which no literal-assignment pattern can see.
 */
function assignedAsType(value: string): boolean {
  return new RegExp(`type:\\s*["']${value}["']`).test(SOURCE);
}

/**
 * `ConditionBuilder.unless()` rewrites a condition's `type` from `<x>_if` to
 * `<x>_unless` at runtime, so the `_unless` half of every polarity pair is
 * reachable without any literal to scan for — `frontmost_application_unless` is
 * emitted five times and appears nowhere in the source.
 *
 * Detected rather than assumed: if that rewrite is ever removed, this goes back
 * to requiring a literal and the `_unless` half reports as unwired.
 */
const HAS_POLARITY_FLIP = /replace\(\s*["']_if["']\s*,\s*["']_unless["']\s*\)/.test(SOURCE);

function conditionWired(name: string): boolean {
  if (namedInSource(name)) return true;
  if (!HAS_POLARITY_FLIP || !name.endsWith("_unless")) return false;
  return namedInSource(`${name.slice(0, -"_unless".length)}_if`);
}

/** Written as a quoted key, e.g. `"basic.to_if_alone_timeout_milliseconds":`. */
function usedAsQuotedKey(key: string): boolean {
  return new RegExp(`["']${key.replace(/\./g, "\\.")}["']`).test(SOURCE);
}

// ── output side ─────────────────────────────────────────────────────────────

function countKeys(rules: Rule[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (k: string): void => {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        bump(key);
        walk(value);
      }
    }
  };
  walk(rules);
  return counts;
}

function countTypeValues(rules: Rule[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (k: string): void => {
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node && typeof node === "object") {
      const type = (node as { type?: unknown }).type;
      if (typeof type === "string") bump(type);
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(rules);
  return counts;
}

function countParameters(manipulators: Manipulator[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of manipulators) {
    if (m.type !== "basic" || !m.parameters) continue;
    for (const key of Object.keys(m.parameters)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ── report ──────────────────────────────────────────────────────────────────

export function schemaCoverage(): Coverage {
  const schema = loadSchema();
  const { rules } = buildRules();
  const manipulators = rules.flatMap((r) => r.manipulators);

  const keyCounts = countKeys(rules);
  const typeCounts = countTypeValues(rules);
  const paramCounts = countParameters(manipulators);
  const profileParams = new Set(Object.keys(schema.$defs.parameters?.properties ?? {}));

  const features: Feature[] = [];
  const add = (group: string, name: string, wired: boolean, emitted: number): void => {
    features.push({ group, name, wired, emitted });
  };

  for (const name of enumOf(schema, "manipulator", "type")) {
    add("manipulator type", name, assignedAsType(name), typeCounts.get(name) ?? 0);
  }

  for (const name of props(schema, "manipulatorBasic")) {
    if (name === "type" || name === "description") continue;
    add("basic channel", name, namedInSource(name), keyCounts.get(name) ?? 0);
  }

  for (const name of props(schema, "fromEventDefinition")) {
    if (name === "description") continue;
    add("from", name, namedInSource(name), keyCounts.get(name) ?? 0);
  }

  for (const name of props(schema, "toEventDefinition")) {
    if (TO_EVENT_OPTIONS.has(name)) continue;
    // `software_function` is itself an `ExactlyOne` union of four sub-actions
    // (see $defs.softwareFunction) — folded into "to action" as one entry it
    // reads as wired the moment any one sub-action is (it is, via `toApp()`'s
    // `open_application`), which hides that the other three have no handler
    // at all. Drilled in separately below, the same way `conditionDefs` is.
    if (name === "software_function") continue;
    add("to action", name, namedInSource(name), keyCounts.get(name) ?? 0);
  }

  for (const name of props(schema, "softwareFunction")) {
    add("to action:software_function", name, namedInSource(name), keyCounts.get(name) ?? 0);
  }

  for (const name of props(schema, "toEventDefinition")) {
    if (!TO_EVENT_OPTIONS.has(name) || name === "description") continue;
    add("to option", name, namedInSource(name), keyCounts.get(name) ?? 0);
  }

  const conditionDefs = Object.keys(schema.$defs).filter((d) => /^condition[A-Z]/.test(d));
  for (const def of conditionDefs) {
    for (const name of enumOf(schema, def, "type")) {
      add("condition", name, conditionWired(name), typeCounts.get(name) ?? 0);
    }
  }

  for (const name of profileParams) {
    add("parameter", name, usedAsQuotedKey(name), paramCounts.get(name) ?? 0);
  }

  const groups = [...new Set(features.map((f) => f.group))].map((group) => {
    const inGroup = features.filter((f) => f.group === group);
    return { group, wired: inGroup.filter((f) => f.wired).length, total: inGroup.length };
  });

  return { features, groups };
}

export function formatCoverage(coverage: Coverage): string {
  const lines: string[] = [];
  let lastGroup = "";

  for (const f of coverage.features) {
    if (f.group !== lastGroup) {
      const g = coverage.groups.find((x) => x.group === f.group);
      lines.push("", `${f.group.toUpperCase()}  —  ${g?.wired}/${g?.total} wired`);
      lastGroup = f.group;
    }
    const mark = f.wired ? "  ✓" : "  ✗";
    const emitted = f.wired ? (f.emitted === 0 ? "unused" : `${f.emitted}`) : "";
    lines.push(`${mark}  ${f.name.padEnd(42)} ${emitted}`);
  }

  const wired = coverage.features.filter((f) => f.wired).length;
  const unusedCount = coverage.features.filter((f) => f.wired && f.emitted === 0).length;
  lines.push(
    "",
    `${wired}/${coverage.features.length} schema features reachable from the DSL; ` +
      `${unusedCount} reachable but unused.`,
    "✗ marks a Karabiner capability with no wrapper — a candidate to add.",
  );
  return lines.join("\n");
}

if (process.argv[1] && /coverage\.ts$/.test(process.argv[1])) {
  console.log(formatCoverage(schemaCoverage()));
}
