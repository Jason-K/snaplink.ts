/**
 * `--explain` — answer "why isn't my binding working?" without reading JSON.
 *
 * Prints every rule whose input domain can match a given key or chord, in the
 * order Karabiner will evaluate them, with each rule's conditions. Because
 * Karabiner stops at the first manipulator that matches, the first *reachable*
 * entry in this list is the one that fires.
 *
 * Usage:
 *   npm run explain -- q                 # bare q
 *   npm run explain -- cmd+q             # with modifiers
 *   npm run explain -- L.cmd+d           # sided modifiers
 *   npm run explain -- j,k               # a chord
 *   npm run explain -- --conflicts       # full conflict report
 *   npm run explain -- --lint            # full gesture-lint report
 */

import { BINDING_SETS, orderedBindings } from "./config";
import {
  analyzableEntries,
  analyzeConflictsInOrder,
  describeBinding,
  describeConditionGroup,
  formatLintReport,
  from,
  lintBindings,
  rulesMatching,
  type AnalyzedBinding,
  type TriggerKey,
} from "./engine";
import type { Trigger } from "./data";

/** Parse `cmd+q`, `L.cmd+d`, `j,k`, or a bare key into a Trigger. */
export function parseTriggerQuery(query: string): Trigger {
  const trimmed = query.trim();

  // Comma-separated means a chord: every part is a key, none is a modifier.
  if (trimmed.includes(",")) {
    // argv is untyped input; `from()` resolves aliases and the schema rejects
    // anything Karabiner does not know, so validation lives downstream.
    return from(trimmed.split(",").map((k) => k.trim()).filter(Boolean) as TriggerKey[]);
  }

  const parts = trimmed.split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) {
    throw new Error(`Could not parse trigger "${query}".`);
  }
  return parts.length ? from(key as TriggerKey, parts) : from(key as TriggerKey);
}

function formatMatch(match: AnalyzedBinding, index: number): string {
  const conditions = describeConditionGroup([...match.conditions]);
  const lines = [`  ${index + 1}. ${describeBinding(match)}`, `     when: ${conditions}`];

  for (const c of match.binding.cases) {
    const phase = c.phase ?? "press";
    const taps = (c.tapCount ?? 1) > 1 ? ` x${c.tapCount}` : "";
    const caseConditions = c.conditions?.length
      ? ` [${describeConditionGroup([...c.conditions])}]`
      : "";
    lines.push(`     ${phase}${taps}${caseConditions}: ${c.do.length} action(s)`);
  }

  return lines.join("\n");
}

/** Human-readable report of every rule that can claim `query`. */
export function explainTrigger(query: string): string {
  const trigger = parseTriggerQuery(query);
  const matches = rulesMatching(analyzableEntries(orderedBindings()), trigger);

  if (!matches.length) {
    return `No rule claims "${query}". The key passes through unmodified.`;
  }

  return [
    `${matches.length} rule(s) can claim "${query}", in evaluation order:`,
    "",
    matches.map(formatMatch).join("\n\n"),
    "",
    "Karabiner stops at the first rule whose conditions hold.",
  ].join("\n");
}

/** Human-readable conflict report across the whole configuration. */
export function explainConflicts(): string {
  const report = analyzeConflictsInOrder(orderedBindings());
  const lines = [
    `Analyzed ${report.bindings.length} bindings across ${BINDING_SETS.length} sets.`,
    `  errors:   ${report.errors.length}`,
    `  warnings: ${report.warnings.length}`,
  ];

  for (const conflict of report.conflicts) {
    lines.push("", `[${conflict.severity}/${conflict.kind}] ${conflict.message}`);
  }

  if (!report.conflicts.length) lines.push("", "No conflicts found.");
  return lines.join("\n");
}

/**
 * Human-readable gesture-lint report across the whole configuration.
 *
 * The same report the build prints, on demand and without writing anything.
 * Where `--conflicts` answers "can this rule be reached", this answers "will a
 * rule that is reached behave the way it reads".
 */
export function explainLint(): string {
  const report = lintBindings(orderedBindings());
  return (
    formatLintReport(report) ||
    `Analyzed ${orderedBindings().length} bindings across ${BINDING_SETS.length} sets. No findings.`
  );
}

function main(argv: string[]): void {
  const args = argv.filter((a) => a !== "--explain");

  if (!args.length) {
    console.log(
      [
        "Usage:",
        "  npm run explain -- <key>          e.g. q, cmd+q, L.cmd+d, j,k",
        "  npm run explain -- --conflicts    full conflict report",
        "  npm run explain -- --lint         full gesture-lint report",
      ].join("\n"),
    );
    return;
  }

  if (args[0] === "--conflicts") console.log(explainConflicts());
  else if (args[0] === "--lint") console.log(explainLint());
  else console.log(explainTrigger(args.join(" ")));
}

main(process.argv.slice(2));
