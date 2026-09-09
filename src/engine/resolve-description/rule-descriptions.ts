export type RuleTrigger = 'tap' | 'hold' | 'multi-tap' | 'simultaneous';

import { DESCRIPTION_SEPARATOR, KEY_SYMBOLS } from "../../data";
import {
  getModComboAliasCanonicalKey,
  isModComboAlias,
} from "../utils";


function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function splitChordTokens(chord: string | string[]): string[] {
  const parts = Array.isArray(chord) ? chord : chord.split('+');
  return parts.flatMap((part) =>
    part
      .split('+')
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

const MODIFIER_BASES = new Set([
  'command',
  'cmd',
  'option',
  'opt',
  'alt',
  'control',
  'ctrl',
  'shift',
  'fn',
  'caps_lock',
]);

function isModifierToken(token: string): boolean {
  const normalized = normalizeToken(token);
  if (isModComboAlias(token) || isModComboAlias(normalized)) {
    return true;
  }

  let base = normalized;
  if (normalized.startsWith('left_') || normalized.startsWith('right_')) {
    base = normalized.replace(/^(left|right)_/, '');
  }
  return MODIFIER_BASES.has(base);
}

export function modifierTokenToSymbols(token: string): string {
  const canonicalAlias = getModComboAliasCanonicalKey(token);
  if (canonicalAlias) {
    if (canonicalAlias.startsWith("vm")) {
      return canonicalAlias;
    }
  }

  const normalized = normalizeToken(token);

  let sidePrefix = "";
  let base = normalized;

  if (normalized.startsWith("left_")) {
    base = normalized.slice("left_".length);
    return `${KEY_SYMBOLS[base] ?? base.toUpperCase()}`;
  } else if (normalized.startsWith("right_")) {
    sidePrefix = ">";
    base = normalized.slice("right_".length);
    return `${KEY_SYMBOLS[base] ?? base.toUpperCase()}${sidePrefix}`;
  } else {
    return `${KEY_SYMBOLS[base] ?? base.toUpperCase()}`;
  }
}

export function keyTokenToLabel(token: string): string {
  const normalized = normalizeToken(token);
  const override = KEY_SYMBOLS[normalized];
  if (override) {
    return override;
  }

  if (/^[a-z]$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^[0-9]$/.test(normalized)) {
    return normalized;
  }

  if (/^f[0-9]{1,2}$/.test(normalized)) {
    return normalized.toUpperCase();
  }

  if (/^[+\-.,/;'[\]=`~!@#$%^&*()_{}:"<>?\\]$/.test(token)) {
    return token;
  }

  if (normalized.startsWith('keypad_')) {
    const keypadLabel = keyTokenToLabel(normalized.slice('keypad_'.length));
    if (keypadLabel !== normalized.slice('keypad_'.length).toUpperCase()) {
      return keypadLabel;
    }
  }

  return normalized.replace(/_/g, ' ').toUpperCase();
}

function triggerLabel(trigger: RuleTrigger): string {
  switch (trigger) {
    case 'tap':
      return '(on tap)';
    case 'hold':
      return '(on hold)';
    case 'multi-tap':
      return '(on multi-tap)';
    case 'simultaneous':
      return '(on simultaneous)';
  }
}

export function formatRuleDescription(
  chord: string | string[],
  description: string,
  trigger: RuleTrigger,
): string {
  const tokens = splitChordTokens(chord);
  const segments: string[] = [];
  const modifierSymbols: string[] = [];

  // Leading modifier tokens collapse into a single bracketed symbol group.
  let index = 0;
  for (const token of tokens) {
    if (!isModifierToken(token)) break;
    modifierSymbols.push(modifierTokenToSymbols(token));
    index += 1;
  }

  if (modifierSymbols.length > 0) {
    segments.push(`[${modifierSymbols.join("")}]`);
  }

  for (const token of tokens.slice(index)) {
    segments.push(`[${keyTokenToLabel(token)}]`);
  }

  if (segments.length === 0) {
    segments.push(`[${description.toUpperCase()}]`);
  }

  return `${segments.join("+")}${DESCRIPTION_SEPARATOR}${description} ${triggerLabel(trigger)}`;
}
