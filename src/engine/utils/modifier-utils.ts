import type { KeyCode, Modifier } from "../../types/karabiner";
import type { TriggerModifiers } from "../../data";
import { MODKEY_CODES, VM, type ModComboAlias } from "../../data/constants/keys";

const VMOD_ALIAS_LOWER = new Map<string, ModComboAlias>(
  Object.keys(VM).map((key) => [
    key.toLowerCase(),
    key as ModComboAlias,
  ]),
);

export function getModComboAliasCanonicalKey(
  alias: string,
): ModComboAlias | undefined {
  return VMOD_ALIAS_LOWER.get(alias.toLowerCase());
}

export function resolveModComboAlias(alias: string): Modifier[] | undefined {
  const canonical = getModComboAliasCanonicalKey(alias);
  return canonical ? [...VM[canonical]] : undefined;
}

export function isModComboAlias(alias: string): boolean {
  return Boolean(getModComboAliasCanonicalKey(alias));
}

/**
 * Resolves key/modifier aliases to standard Karabiner key_code or modifier strings.
 * E.g.:
 * - `cmd` → `"command"`
 * - `opt` → `"option"`
 * - `ctrl` → `"control"`
 * - `L.cmd` / `L_cmd` → `"left_command"`
 * - `R.cmd` / `R_cmd` → `"right_command"`
 * - `L.opt` / `L_opt` → `"left_option"`
 * - `R.opt` / `R_opt` → `"right_option"`
 * - `L.ctrl` / `L_ctrl` → `"left_control"`
 * - `R.ctrl` / `R_ctrl` → `"right_control"`
 * - `L.shift` / `L_shift` → `"left_shift"`
 * - `R.shift` / `R_shift` → `"right_shift"`
 */
export function resolveKeyAlias(key: string): KeyCode {
  if (!key) return key as KeyCode;

  let sidePrefix = "";
  let baseKey = key;

  if (/^[LR][._]/i.test(key)) {
    const prefixChar = key[0]!.toLowerCase();
    sidePrefix = prefixChar === "l" ? "left_" : "right_";
    baseKey = key.slice(2);
  } else if (/^(left|right)_/i.test(key)) {
    const match = key.match(/^(left|right)_/i);
    if (match) {
      sidePrefix = match[0].toLowerCase();
      baseKey = key.slice(sidePrefix.length);
    }
  }

  if (baseKey === "cmd") {
    baseKey = "command";
  } else if (baseKey === "opt") {
    baseKey = "option";
  } else if (baseKey === "ctrl") {
    baseKey = "control";
  }

  // Asserted, not proven: the alias table maps onto Karabiner names, but the
  // fall-through returns the caller's string unchanged. A name Karabiner does
  // not know is caught by `make validate` against the schema, which is the
  // layer that owns key-name validity.
  return `${sidePrefix}${baseKey}` as KeyCode;
}

export function isModifierKey(key: string): boolean {
  return MODKEY_CODES.has(resolveKeyAlias(key));
}

/**
 * Expand a modifier list, resolving virtual-modifier aliases (`"COCS"`) to their
 * component modifiers and key aliases (`"L.cmd"`) to Karabiner names, preserving
 * order and dropping duplicates.
 *
 * The result is asserted to be `Modifier[]`: every path either comes from
 * {@link VM} (already `Modifier[]`) or from {@link resolveKeyAlias}, which
 * emits Karabiner modifier names. This is the one place that assertion is made.
 */
export function expandModifiers(modifiers: string[]): Modifier[] {
  const expanded: string[] = [];
  const seen = new Set<string>();
  for (const mod of modifiers) {
    for (const raw of resolveModComboAlias(mod) ?? [mod]) {
      const resolved = resolveKeyAlias(raw);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        expanded.push(resolved);
      }
    }
  }
  return expanded as Modifier[];
}

/**
 * Resolve a trigger's modifier specification into expanded arrays of mandatory
 * and optional Karabiner modifier names.
 */
export function resolveModifiers(m?: TriggerModifiers): {
  mandatory: string[];
  optional: string[];
} {
  if (!m) {
    return { mandatory: [], optional: [] };
  }
  const resolveList = (list: string[]) => {
    const expanded: string[] = [];
    const seen = new Set<string>();
    for (const mod of list) {
      for (const raw of resolveModComboAlias(mod) ?? [mod]) {
        const resolved = resolveKeyAlias(raw);
        if (!seen.has(resolved)) {
          seen.add(resolved);
          expanded.push(resolved);
        }
      }
    }
    return expanded;
  };

  if (Array.isArray(m)) {
    return {
      mandatory: resolveList(m),
      optional: [],
    };
  }
  return {
    mandatory: resolveList(m.mandatory ?? []),
    optional: resolveList(m.optional ?? []),
  };
}

/**
 * Normalize a Karabiner modifier token to its short form for use in derived
 * variable names (e.g. `guard_cmd_q`): strip a leading `left_`/`right_` prefix,
 * then alias `command→cmd`, `control→ctrl`, `option→opt`. Anything else (e.g.
 * `shift`, `fn`) passes through unchanged.
 */
export function normalizeModifier(mod: string): string {
  const resolved = resolveKeyAlias(mod);
  return resolved
    .replace(/^(left|right)_/, "")
    .replace("command", "cmd")
    .replace("control", "ctrl")
    .replace("option", "opt");
}
