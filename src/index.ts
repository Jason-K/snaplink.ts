/**
 * Karabiner-Elements configuration — build entry point.
 *
 * Pipeline:
 *   definitions (Binding[]) → engine (Manipulator[]) → karabiner.json
 *
 * This is the only module allowed to touch the filesystem, the clock, or the
 * environment. Everything under `src/engine/` is a pure transformation, which
 * is what keeps it testable without mocks.
 *
 * Virtual Modifiers:
 * - COC_: Command + Option + Control
 * - COCS: Command + Option + Control + Shift
 * - CO_S: Command + Option + Shift
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  GLOBAL_SETTINGS,
  DEFAULT_PROFILE,
  PATHS,
  PREFERRED_PROFILE,
} from "./data";
import { buildRules, DEVICE_CONFIGS } from "./config";
import {
  formatLintReport,
  getProfileSpec,
  readKarabinerConfig,
  resolveProfileName,
  writeKarabinerConfig,
} from "./engine";

// ============================================================================
// WRITE
// ============================================================================

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const isDarwin = process.platform === "darwin";
const dryRun = !isDarwin || isCI;

const configPath = PATHS.configKE.path;

function main(): void {
  // Compiling inside main() keeps conflict errors on the same reporting path as
  // write errors — at module scope a RuleConflictError escaped the handler below
  // and surfaced as a raw stack trace.
  const { rules, analysis, lint } = buildRules();

  for (const warning of analysis.warnings) {
    console.warn(`⚠ [${warning.kind}] ${warning.message}`);
  }

  // Advisory, unlike the conflict errors above: a lint finding can be a
  // deliberate choice, so it is reported and the build continues.
  // `npm run explain -- --lint` prints the same report on demand.
  const lintText = formatLintReport(lint);
  if (lintText) console.warn(`\n${lintText}\n`);

  // One read of karabiner.json for the whole build; one atomic write back.
  const config = dryRun ? undefined : readKarabinerConfig(configPath);

  const profileName = config
    ? resolveProfileName(config, {
      explicit: process.env.KARABINER_PROFILE_NAME?.trim() || undefined,
      preferred: PREFERRED_PROFILE,
      fallback: DEFAULT_PROFILE,
    })
    : PREFERRED_PROFILE;

  const result = writeKarabinerConfig(
    {
      profileName,
      rules,
      simpleModifications: getProfileSpec(profileName).simpleModifications,
      devices: DEVICE_CONFIGS,
      globalSettings: GLOBAL_SETTINGS,
    },
    { configPath, dryRun, ...(config ? { config } : {}) },
  );

  if (result.dryRun) {
    console.log(
      `[dry-run] Generated ${result.ruleCount} rules for profile '${result.profileName}'`,
    );
  } else {
    console.log(
      `✓ Wrote ${result.ruleCount} rules to profile '${result.profileName}' in ${configPath}`,
    );
    console.log(`  backup: ${result.backupPath}`);
  }

  // Workspace copy for inspection and golden-file diffing.
  const outPath = join(process.cwd(), "karabiner-output.json");
  writeFileSync(outPath, `${JSON.stringify({ complex_modifications: { rules } }, null, 2)}\n`);
  console.log(`✓ Wrote workspace copy: ${outPath}`);
}

try {
  main();
} catch (error) {
  console.error("✗ Build failed:", error instanceof Error ? error.message : error);
  if (error instanceof Error && error.cause) console.error("  cause:", error.cause);
  process.exitCode = 1;
}
