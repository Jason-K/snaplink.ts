/**
 * Single writer for `~/.config/karabiner/karabiner.json`.
 *
 * The whole update — global settings, complex modifications, profile-level
 * simple modifications, and device blocks — is applied to one in-memory config
 * object by the pure {@link applyConfigUpdate}, then persisted by a single
 * backup + atomic write. Karabiner-Elements also owns this file through its GUI,
 * so a partial or interleaved write is the worst failure mode this project has.
 */

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ComplexModificationsParameters,
  KarabinerConfig,
  Profile,
  Rule,
} from "../types/karabiner";
import type { AcceptUndefined } from "../types/util";
import type { SimpleModificationPair } from "../data/primitives/profiles";
import type { DeviceConfig } from "./resolve-trigger/device-config";
import { expandDeviceConfigs, getDeviceKey } from "./resolve-trigger/device-config";
import type { ProfileSpec } from "../data/primitives/profiles";
import { PROFILES } from "../data/registries/profiles";

/** Karabiner-Elements writes this file with 4-space indentation; match it so
 * hand edits and generated writes produce minimal diffs. */
const JSON_INDENT = 4;

/** How many timestamped backups to retain in `backups/`. */
const BACKUP_RETENTION = 10;

const BACKUP_PREFIX = "karabiner.json.bak_";
const BACKUP_NAME_PATTERN = /^karabiner\.json\.bak_\d{8}_\d{6}$/;

/**
 * Resolves a ProfileSpec by profile name, defaulting to the preferred profile (`jjkDefault`).
 */
export function getProfileSpec(name?: string): ProfileSpec {
  if (!name) return PROFILES.jjkDefault;
  const found = Object.values(PROFILES).find((p) => p.name === name);
  return found ?? PROFILES.jjkDefault;
}

/** Thrown when the requested profile does not exist in the config file. */
export class ProfileNotFoundError extends Error {
  constructor(
    readonly profileName: string,
    readonly available: string[],
  ) {
    super(
      `Profile '${profileName}' not found in karabiner.json. Available profiles: ${
        available.length ? available.map((n) => `'${n}'`).join(", ") : "(none)"
      }`,
    );
    this.name = "ProfileNotFoundError";
  }
}

/** Everything one build applies to the config file, in a single object. */
export type ConfigUpdate = {
  /** Name of the profile whose rules/devices are being replaced. */
  profileName: string;
  /** Generated complex-modification rules. */
  rules: Rule[];
  /** Complex-modification parameter defaults. */
  parameters?: ComplexModificationsParameters;
  /** Profile-level simple modifications. */
  simpleModifications?: readonly SimpleModificationPair[];
  /** Device-scoped settings and simple modifications. */
  devices?: readonly DeviceConfig[];
  /** Top-level `global` settings merged into the existing block. */
  globalSettings?: Record<string, unknown>;
};

type NormalizedSimpleModification = {
  from: { key_code: string };
  to: { key_code: string }[];
};

function normalizeKeyRef(ref: { key_code: string } | string): { key_code: string } {
  return typeof ref === "string" ? { key_code: ref } : ref;
}

/**
 * Accept the several shapes a simple modification can arrive in — a plain pair,
 * a bare key-code string on either side, or a single (non-array) `to`.
 */
function normalizeSimpleModification(
  pair: SimpleModificationPair,
): NormalizedSimpleModification {
  const to = Array.isArray(pair.to) ? pair.to : [pair.to];
  return {
    from: normalizeKeyRef(pair.from),
    to: to.map(normalizeKeyRef),
  };
}

/**
 * Flatten a {@link DeviceConfig} into the shape Karabiner stores under
 * `profile.devices[]`: identifiers plus the settings spread inline.
 */
function flattenDeviceConfig(device: DeviceConfig): Record<string, unknown> {
  return {
    identifiers: device.identifiers,
    ...(device.simple_modifications !== undefined
      ? { simple_modifications: device.simple_modifications }
      : {}),
    ...device.settings,
  };
}

/**
 * Merge the generated device blocks over whatever the profile already has.
 * Devices we do not manage are preserved but have `modify_events` forced off,
 * matching the previous behaviour of `updateDeviceConfigurations`.
 */
function mergeDevices(
  existing: unknown,
  devices: readonly DeviceConfig[],
): Record<string, unknown>[] {
  const expanded = expandDeviceConfigs(devices);
  const managedKeys = new Set(expanded.map((d) => getDeviceKey(d.identifiers)));
  const previous = Array.isArray(existing)
    ? (existing as { identifiers: DeviceConfig["identifiers"] }[])
    : [];

  return [
    ...expanded.map(flattenDeviceConfig),
    ...previous
      .filter((d) => !managedKeys.has(getDeviceKey(d.identifiers)))
      .map((d) => ({ ...d, modify_events: false })),
  ];
}

/**
 * Apply every part of a build to a config object and return the result.
 *
 * Pure: does not mutate `config` and touches no I/O, so the whole
 * read-modify-write can be exercised in tests with a literal config object.
 *
 * @throws {ProfileNotFoundError} when `update.profileName` is not present.
 */
export function applyConfigUpdate(
  config: KarabinerConfig,
  update: AcceptUndefined<ConfigUpdate>,
): KarabinerConfig {
  const profiles = config.profiles ?? [];
  const index = profiles.findIndex((p) => p.name === update.profileName);
  if (index < 0) {
    throw new ProfileNotFoundError(
      update.profileName,
      profiles.map((p) => p.name),
    );
  }

  const current = profiles[index] as Profile;
  const next: Profile = {
    ...current,
    complex_modifications: {
      ...(update.parameters ? { parameters: update.parameters } : {}),
      rules: update.rules,
    },
    ...(update.simpleModifications
      ? {
          simple_modifications: update.simpleModifications.map(
            normalizeSimpleModification,
          ),
        }
      : {}),
    ...(update.devices
      ? { devices: mergeDevices(current.devices, update.devices) }
      : {}),
  };

  return {
    ...config,
    ...(update.globalSettings
      ? { global: { ...(config.global ?? {}), ...update.globalSettings } }
      : {}),
    profiles: profiles.map((p, i) => (i === index ? next : p)),
  };
}

/** Parse `karabiner.json`, failing loudly rather than falling back to defaults. */
export function readKarabinerConfig(configPath: string): KarabinerConfig {
  const raw = readFileSync(configPath, "utf8");
  try {
    return JSON.parse(raw) as KarabinerConfig;
  } catch (cause) {
    throw new Error(
      `karabiner.json at ${configPath} is not valid JSON; refusing to overwrite it.`,
      { cause },
    );
  }
}

export type ProfileResolution = {
  /** Explicit override (e.g. `KARABINER_PROFILE_NAME`); wins if it exists. */
  explicit?: string | undefined;
  /** Preferred profile name; used when present in the config. */
  preferred: string;
  /** Name returned when the config lists no profiles at all. */
  fallback: string;
};

/**
 * Pick which profile this build targets: explicit override, else the preferred
 * profile, else whichever profile Karabiner currently has selected, else the
 * first one.
 *
 * @throws when an explicit override names a profile that does not exist —
 * silently writing to a different profile than the one requested is worse than
 * failing.
 */
export function resolveProfileName(
  config: KarabinerConfig,
  { explicit, preferred, fallback }: ProfileResolution,
): string {
  const profiles = config.profiles ?? [];
  const names = profiles.map((p) => p.name);

  if (explicit) {
    if (!names.includes(explicit)) {
      throw new ProfileNotFoundError(explicit, names);
    }
    return explicit;
  }

  return (
    names.find((n) => n === preferred) ??
    profiles.find((p) => p.selected)?.name ??
    names[0] ??
    fallback
  );
}

/** Project root, derived from this module rather than `process.cwd()`. */
function projectRoot(): string {
  return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}

function backupStamp(now: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Copy the current config to `backups/karabiner.json.bak_YYYYMMDD_HHMMSS`,
 * then prune all but the newest {@link BACKUP_RETENTION} backups.
 * Only files matching {@link BACKUP_NAME_PATTERN} are ever removed.
 */
function backupConfig(sourcePath: string, backupsDir: string, now: Date): string {
  mkdirSync(backupsDir, { recursive: true });
  const target = join(backupsDir, `${BACKUP_PREFIX}${backupStamp(now)}`);
  copyFileSync(sourcePath, target);

  const existing = readdirSync(backupsDir)
    .filter((name) => BACKUP_NAME_PATTERN.test(name))
    .sort();
  for (const stale of existing.slice(0, Math.max(0, existing.length - BACKUP_RETENTION))) {
    rmSync(join(backupsDir, stale), { force: true });
  }
  return target;
}

/** Write `contents` to `path` via a temp file + rename, so readers never
 * observe a partially written config. */
function writeAtomic(path: string, contents: string): void {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, contents);
  renameSync(tmpPath, path);
}

export type WriteConfigOptions = {
  /** Path to `karabiner.json`. */
  configPath: string;
  /** Skip all I/O and only report what would be written. */
  dryRun?: boolean;
  /** Directory for timestamped backups. Defaults to `<project>/backups`. */
  backupsDir?: string;
  /** Timestamp used for the backup filename. Injectable for tests. */
  now?: Date;
  /** Already-parsed config, to avoid a second read of the same file. */
  config?: KarabinerConfig;
};

export type WriteConfigResult = {
  profileName: string;
  ruleCount: number;
  dryRun: boolean;
  backupPath?: string;
};

/**
 * Read the config once, apply the whole update, back it up, and write it back
 * atomically.
 *
 * Throws on every failure path — a build that could not write the config must
 * not exit 0, because the next step in `npm run build` reloads Hammerspoon and
 * would otherwise look successful.
 */
export function writeKarabinerConfig(
  update: AcceptUndefined<ConfigUpdate>,
  options: AcceptUndefined<WriteConfigOptions>,
): WriteConfigResult {
  const ruleCount = update.rules.length;

  if (options.dryRun) {
    return { profileName: update.profileName, ruleCount, dryRun: true };
  }

  const parsed = options.config ?? readKarabinerConfig(options.configPath);

  // Build the complete next config before touching the filesystem, so a
  // ProfileNotFoundError leaves the existing file untouched.
  // ProfileNotFoundError leaves the existing file untouched.
  const next = applyConfigUpdate(parsed, update);

  const backupPath = backupConfig(
    options.configPath,
    options.backupsDir ?? join(projectRoot(), "backups"),
    options.now ?? new Date(),
  );
  writeAtomic(options.configPath, JSON.stringify(next, null, JSON_INDENT));

  return { profileName: update.profileName, ruleCount, dryRun: false, backupPath };
}
