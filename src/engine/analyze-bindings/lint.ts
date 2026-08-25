/**
 * Driver for the gesture lint rules in {@link ./rules}.
 *
 * Two passes: collect the configuration-wide facts a rule may need (which
 * variables anything writes, which anything reads), then run every rule over
 * every binding.
 */

import type { Binding } from "../../data";
import {
  bindingReadsVars,
  bindingWritesVars,
  LINT_RULES,
  type LintDiagnostic,
  type LintTarget,
} from "./rules";

export type LintReport = {
  diagnostics: LintDiagnostic[];
  warnings: LintDiagnostic[];
  infos: LintDiagnostic[];
};

/**
 * Run every gesture-lint rule over an ordered list of bindings.
 *
 * Takes the same `{ set, index, binding }` entries as
 * `analyzeConflictsInOrder()`, so the build can hand both analyses the one
 * flattened emit order it already computes.
 *
 * @param entries - Bindings tagged with the set they came from, in emit order.
 * @returns Findings, split by severity. Never throws — lint is advisory.
 *
 * @example
 * ```ts
 * const report = lintBindings(rulePlan().flatMap((p) => p.bindings));
 * if (report.diagnostics.length) console.warn(formatLintReport(report));
 * ```
 */
export function lintBindings(entries: readonly LintTarget[]): LintReport {
  const writtenVars = new Set<string>();
  const readVars = new Set<string>();
  for (const { binding } of entries) {
    for (const name of bindingWritesVars(binding)) writtenVars.add(name);
    for (const name of bindingReadsVars(binding)) readVars.add(name);
  }
  const ctx = { writtenVars, readVars };

  const diagnostics = entries.flatMap((entry) =>
    LINT_RULES.flatMap((rule) => rule(entry, ctx)),
  );

  return {
    diagnostics,
    warnings: diagnostics.filter((d) => d.severity === "warning"),
    infos: diagnostics.filter((d) => d.severity === "info"),
  };
}

/** {@link lintBindings} over named binding sets, in declaration order. */
export function lintBindingSets(
  sets: ReadonlyArray<{ name: string; bindings: readonly Binding[] }>,
): LintReport {
  return lintBindings(
    sets.flatMap(({ name, bindings }) =>
      bindings.map((binding, index) => ({ set: name, index, binding })),
    ),
  );
}

/**
 * Render a report for a terminal.
 *
 * Grouped by rule rather than by binding: a lint finding is nearly always
 * systematic — one misunderstanding repeated across a table of keys — and the
 * per-rule explanation is the part worth reading once instead of twenty times.
 *
 * @param report - The report to format.
 * @returns A printable string, empty when there is nothing to report.
 */
export function formatLintReport(report: LintReport): string {
  if (report.diagnostics.length === 0) return "";

  const byRule = new Map<string, LintDiagnostic[]>();
  for (const d of report.diagnostics) {
    const bucket = byRule.get(d.rule);
    if (bucket) bucket.push(d);
    else byRule.set(d.rule, [d]);
  }

  const lines: string[] = [
    `${report.warnings.length} warning(s), ${report.infos.length} note(s) from gesture lint:`,
  ];
  for (const [rule, group] of byRule) {
    const mark = group[0]!.severity === "warning" ? "!" : "·";
    lines.push("", `  ${mark} [${rule}] ${group.length} binding(s)`);
    for (const d of group) lines.push(`      ${d.message}`);
    lines.push(`      fix: ${group[0]!.fix}`);
  }
  return lines.join("\n");
}
