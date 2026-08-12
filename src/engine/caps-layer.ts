/**
 * A modifier-layer key, generated one manipulator per (key × layer).
 *
 * The obvious way to build a hyper key is to have it hold ⌘⌥⌃⇧ down for as long
 * as it is pressed. That is order-*dependent*: the emitted modifier set is
 * decided at the layer key's key-down, so `caps → shift → a` and
 * `shift → caps → a` produce different output. Making the layer read its
 * modifier state at the moment the *non-modifier* key is pressed is the whole
 * point, and Karabiner has no way to say "re-emit whatever key just arrived" —
 * so every key the layer covers needs its own manipulator, and the set of them
 * is generated rather than written out.
 *
 * Two mechanisms carry the state, and which one carries what matters:
 *
 * - **The layer key itself** is a variable (`<key>_pressed`). It has to be: the
 *   key emits nothing while held, so there is no modifier flag to match on.
 * - **The layer-selecting modifiers** are `from.modifiers.mandatory`, not
 *   variables. Karabiner evaluates mandatory modifiers against the held-modifier
 *   set at key-down regardless of press order, which is exactly the required
 *   semantics, and it *removes* them from the emitted event — which is exactly
 *   the required consumption. A variable could do neither: tracking `left_shift`
 *   in a variable would still leave the physical shift down, so the emitted key
 *   would carry a ⇧ the layer is supposed to have eaten.
 *
 * Selecting on two participating modifiers at once is deliberately left
 * unmatched: with only one of them in `mandatory` and none of the others in
 * `optional`, no layer manipulator claims the event and the key falls through
 * unchanged. Adding those states later is a matter of adding rows to
 * {@link CAPS_LAYER_STATES}.
 *
 * ## Adoption
 *
 * Karabiner does not feed its own output back through complex modifications, so
 * a layer that merely *emits* ⌘⌥⌃⇧+E cannot reach a rule bound to ⌘⌥⌃⇧+E — the
 * combination never arrives as an input event. Rather than leave those rules
 * unreachable from the layer (they were the whole reason the old caps key held
 * real modifiers down), the generator joins against them at compile time: a
 * binding whose trigger is exactly the combination a layer state emits is
 * *adopted*, and the layer runs its actions directly instead of emitting the
 * combination. See {@link CapsLayerConfig.adopt}.
 */

import type {
  Condition as KarabinerCondition,
  Modifier,
  ToEvent,
} from "../types/karabiner";
import type {
  ActionKeyModifier,
  Binding,
  Case,
  Condition,
  StandardKeyCode,
  Trigger,
  TriggerModifiers,
  VarSpec,
} from "../data";
import { bind, options } from "./wrappers";
import { ifUserVar, when } from "./wrappers";
import { anyInput, from } from "./wrappers";
import { key, press, setVar, to } from "./wrappers";
import { keyTokenToLabel, modifierTokenToSymbols } from "./resolve-description/rule-descriptions";
import {
  getTriggerKeys,
  isPointerButton,
  normalizeModifier,
  resolveKeyAlias,
  resolveModifiers,
} from "./utils";

/** The four left-side modifiers the layer emits, in ⌘ ⌥ ⌃ ⇧ order. */
export const HYPER: readonly Modifier[] = [
  "left_command",
  "left_option",
  "left_control",
  "left_shift",
];

/**
 * Modifiers that pass through the layer untouched.
 *
 * They are `optional` rather than absent so that holding one does not stop the
 * layer from matching, and so that it survives into the emitted event. The
 * left-side four are deliberately *not* here — they are layer selectors, and
 * listing them as optional would let one layer claim another's input.
 */
const PASSTHROUGH_MODIFIERS: readonly Modifier[] = [
  "right_command",
  "right_option",
  "right_control",
  "right_shift",
  "fn",
  "caps_lock",
];

/** One row of the layer table: what is held, and what the key comes out as. */
export type CapsLayerState = {
  /** The left-side modifier that selects this layer; `null` is the base layer. */
  selector: Modifier | null;
  /** Modifiers the layer emits — the hyper set minus the selector. */
  emit: readonly Modifier[];
};

/**
 * The layer table.
 *
 * Each selector is *subtracted* from the hyper set rather than mapped to an
 * arbitrary combination, so the four rows are one rule with four instances and
 * a fifth state cannot be added inconsistently.
 */
export const CAPS_LAYER_STATES: readonly CapsLayerState[] = [
  null,
  "left_shift",
  "left_control",
  "left_option",
  "left_command",
].map((selector) => ({
  selector: selector as Modifier | null,
  emit: HYPER.filter((m) => m !== selector),
}));

const LETTERS = [..."abcdefghijklmnopqrstuvwxyz"];
const DIGITS = [..."0123456789"];

// Hand-written lists are checked against the key-code union: a typo here would
// otherwise reach Karabiner, which rejects the whole config rather than the key.
const SYMBOLS = [
  "hyphen",
  "equal_sign",
  "open_bracket",
  "close_bracket",
  "backslash",
  "non_us_pound",
  "semicolon",
  "quote",
  "grave_accent_and_tilde",
  "comma",
  "period",
  "slash",
] satisfies StandardKeyCode[];

const FUNCTION_KEYS = Array.from({ length: 24 }, (_, i) => `f${i + 1}`);

const NAVIGATION = [
  "return_or_enter",
  "escape",
  "delete_or_backspace",
  "delete_forward",
  "tab",
  "spacebar",
  "insert",
  "home",
  "end",
  "page_up",
  "page_down",
  "up_arrow",
  "down_arrow",
  "left_arrow",
  "right_arrow",
] satisfies StandardKeyCode[];

const KEYPAD = [
  "keypad_0",
  "keypad_1",
  "keypad_2",
  "keypad_3",
  "keypad_4",
  "keypad_5",
  "keypad_6",
  "keypad_7",
  "keypad_8",
  "keypad_9",
  "keypad_period",
  "keypad_slash",
  "keypad_asterisk",
  "keypad_hyphen",
  "keypad_plus",
  "keypad_equal_sign",
  "keypad_enter",
  "keypad_num_lock",
] satisfies StandardKeyCode[];

/**
 * Every key the layer translates.
 *
 * The keypad is in here despite `DEVICE_CONFIGS` remapping several of its keys
 * per-device: simple modifications are applied *before* complex modifications,
 * so a remapped key reaches the layer already rewritten and the layer only ever
 * sees the post-remap code. There is nothing to race.
 */
export const CAPS_LAYER_KEYS: readonly string[] = [
  ...LETTERS,
  ...DIGITS,
  ...SYMBOLS,
  ...FUNCTION_KEYS,
  ...NAVIGATION,
  ...KEYPAD,
];

export type CapsLayerConfig = {
  /** The physical key that activates the layer. */
  triggerKey: string;
  /** Set to 1 while the layer key is held; read by every layer manipulator. */
  pressedVar: VarSpec;
  /** Set to 1 once the layer has translated a key; gates the tap output. */
  usedVar: VarSpec;
  /** Key emitted with the full hyper set when the layer key is tapped. */
  tapKey: string;
  /** Keys the layer translates. Defaults to {@link CAPS_LAYER_KEYS}. */
  keys?: readonly string[];
  /**
   * Bindings the layer may adopt: every other binding in the configuration.
   *
   * A binding is adopted when its trigger is a single key whose mandatory
   * modifiers are exactly the set some layer state emits — `⌘⌥⌃⇧+E` for the base
   * layer, `⌘⌥⌃+E` for the ⇧ layer, and so on, side-insensitively. The layer
   * then runs that binding's cases under `caps+E` rather than emitting `⌘⌥⌃⇧+E`
   * as an event nothing downstream would match.
   *
   * Adoption is additive: the source binding is left alone and still fires from
   * a real modifier press. It also extends coverage — an adopted key need not be
   * in {@link CAPS_LAYER_KEYS}.
   */
  adopt?: readonly Binding[];
};

function symbols(modifiers: readonly Modifier[]): string {
  return modifiers.map(modifierTokenToSymbols).join("");
}

/**
 * One GUI row for the whole layer.
 *
 * Left to the default one-rule-per-trigger grouping this is several hundred
 * rows whose descriptions differ only in a key name — enough to bury every
 * other rule in the list. The group states what the layer does once, as a
 * table, rather than enumerating its instances.
 */
function capsRuleGroup(config: CapsLayerConfig): { id: string; description: string } {
  const label = keyTokenToLabel(config.triggerKey);
  const rows = CAPS_LAYER_STATES.map((state) => {
    const held = state.selector
      ? `With ${modifierTokenToSymbols(state.selector)}:`
      : "Alone:";
    return `\t\t${held}\tEmit ${symbols(state.emit)} + key`;
  });
  return {
    id: `caps-layer:${resolveKeyAlias(config.triggerKey)}`,
    description: [
      `[${label}] layer:`,
      "---",
      "\tOn Tap:",
      `\t\tAlways:\tEmit ${symbols(HYPER)} + '${keyTokenToLabel(config.tapKey)}'`,
      "\tOn Hold:",
      ...rows,
      "\t\t(the held modifier is consumed by the layer; two of them fall through)",
      "\t\t(where a rule already exists for that combination, it runs instead)",
    ].join("\n"),
  };
}

/**
 * The layer key.
 *
 * Emits nothing while held — the layer needs the physical modifier state clean,
 * so anything this key asserted would end up added to every translated key.
 * `used` is armed to 0 on key-down and read back on key-up through a per-event
 * condition, which is what distinguishes "tapped" from "held and used".
 *
 * This is deliberately not `to_if_alone`: Karabiner cancels that on *any*
 * intervening key-down, modifier keys included, so `caps → shift → release`
 * would swallow the tap output even though the layer never translated anything.
 */
function layerKeyBinding(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
): Binding {
  const tapEvent: ToEvent = {
    key_code: resolveKeyAlias(config.tapKey),
    modifiers: [...HYPER],
    conditions: [
      { type: "variable_if", name: config.usedVar.name, value: 0 } as any,
    ] satisfies KarabinerCondition[],
  };

  return bind(
    from(config.triggerKey, { optional: ["any"] }),
    to(press([setVar(config.pressedVar, 1), setVar(config.usedVar, 0)])),
    options({
      ruleGroup,
      afterKeyUp: [
        tapEvent,
        setVar(config.pressedVar, 0),
        setVar(config.usedVar, 0),
      ],
    }),
  );
}

/**
 * Modifier keys pressed while the layer is held, passed through untouched.
 *
 * These exist only to stop {@link layerCatchAll} claiming them. `from.any`
 * matches modifier keys too, and a modifier going down must not count as "the
 * layer translated something" — `caps → ⇧ → release` is still a tap. Karabiner's
 * own pass-through-mode example orders the modifiers ahead of the catch-all for
 * exactly this reason.
 */
function modifierPassThroughs(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
): Binding[] {
  const modifierKeys: Modifier[] = [
    "left_command",
    "left_option",
    "left_control",
    "left_shift",
    ...PASSTHROUGH_MODIFIERS.filter((m) => m !== "caps_lock"),
  ];
  return modifierKeys.map((m) =>
    bind(
      from(m, { optional: ["any"] }),
      to(press({ from_event: true } satisfies ToEvent)),
      when(ifUserVar(config.pressedVar, 1)),
      options({ ruleGroup }),
    ),
  );
}

/**
 * The backstop: any key the layer did not translate still counts as using it.
 *
 * Without this, an input no state claims — two selectors held at once, or a key
 * outside the covered set — would leave `used` at 0, and releasing the layer key
 * would fire the tap output on top of whatever the fall-through produced.
 * `from_event` re-sends the event as-is, so "falls through unchanged" stays
 * literally true; the only added effect is the bookkeeping.
 *
 * Ordered last in the rule by {@link CAPS_LAYER_STATES}' own ordering plus the
 * catch-all tiebreak in `compareTriggerSortKeys()`.
 */
function layerCatchAll(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
): Binding {
  return bind(
    anyInput("key_code"),
    to(
      press([
        setVar(config.usedVar, 1),
        { from_event: true } satisfies ToEvent,
      ]),
    ),
    when(ifUserVar(config.pressedVar, 1)),
    options({ ruleGroup }),
  );
}

/** The `from` a translated key matches in one layer state. */
function layerTrigger(state: CapsLayerState, translatedKey: string): Trigger {
  const modifiers: TriggerModifiers = {
    ...(state.selector ? { mandatory: [state.selector] } : {}),
    optional: [...PASSTHROUGH_MODIFIERS],
  };
  return from(translatedKey, modifiers);
}

/** One translated key, in one layer state, emitted as a modifier combination. */
function layerKeyTranslation(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
  state: CapsLayerState,
  translatedKey: string,
): Binding {
  return bind(
    layerTrigger(state, translatedKey),
    to(
      press([
        setVar(config.usedVar, 1),
        // Last event in `to`, so this is the one Karabiner repeats on hold.
        key(translatedKey, state.emit as unknown as ActionKeyModifier[], {
          repeat: true,
        }),
      ]),
    ),
    when(ifUserVar(config.pressedVar, 1)),
    options({ ruleGroup }),
  );
}

// ── Adoption ────────────────────────────────────────────────────────────────

/**
 * Side-insensitive identity of a modifier set: `L⌘ L⌥ L⌃ L⇧` and `⌘⌥⌃⇧` are the
 * same combination as far as "which layer state emits this" is concerned.
 */
function modifierSetKey(modifiers: readonly string[]): string {
  return [...new Set(modifiers.map(normalizeModifier))].sort().join("+");
}

/** `key@combination` for a single-key trigger, or `undefined` if it is not one. */
function adoptionKey(trigger: Trigger): string | undefined {
  const keys = getTriggerKeys(trigger);
  if (keys.length !== 1 || isPointerButton(keys[0]!)) return undefined;
  const { mandatory } = resolveModifiers(trigger.modifiers);
  if (!mandatory.length) return undefined;
  return `${resolveKeyAlias(keys[0]!)}@${modifierSetKey(mandatory)}`;
}

/**
 * Whether the layer can run this binding's cases under a different trigger.
 *
 * Only `guard()` is excluded: `buildGuard()` requires the guard case to be the
 * binding's *only* case, so the `used` marker the layer injects would make it
 * throw. A guarded binding falls back to emitting the modifier combination —
 * which is also the honest outcome, since a confirm-before-fire guard is
 * written against one specific combination.
 */
function isAdoptable(b: Binding): boolean {
  return !b.cases.some((c) => c.guard);
}

/** Whether this binding compiles through the multi-tap builder. */
function isMultiTap(b: Binding): boolean {
  return b.multiTap !== undefined || b.cases.some((c) => (c.tapCount ?? 1) > 1);
}

/**
 * A pending-tap variable scoped to the layer.
 *
 * The default is derived from the trigger key, so an adopted multi-tap would
 * share `multi_tap_a` with the binding it was adopted from and each could
 * resolve the other's pending first tap. `mods` is dropped for the same reason
 * the trigger changes: it is an override of the trigger's modifiers, and the
 * layer supplies its own.
 */
function layerMultiTap(
  config: CapsLayerConfig,
  source: Binding,
  state: CapsLayerState,
  translatedKey: string,
): NonNullable<Binding["multiTap"]> {
  const { mods: _override, ...rest } = source.multiTap ?? {};
  const scope = state.selector ? normalizeModifier(state.selector) : "base";
  const layer = resolveKeyAlias(config.triggerKey);
  return {
    ...rest,
    firstTapPendingVar: {
      name: `multi_tap_${layer}_${scope}_${resolveKeyAlias(translatedKey)}`,
      varDesc: `${layer}+${scope} ${translatedKey} first tap pending`,
    },
  };
}

/** Whether some case of this binding fires with no condition attached. */
function hasUnconditionalPath(b: Binding): boolean {
  return !b.conditions?.length && b.cases.some((c) => !c.conditions?.length);
}

/**
 * The distinct condition signatures across a binding's cases.
 *
 * `groupByConditions()` splits a binding into one manipulator per condition set,
 * so anything the layer injects has to be injected once per set — a case
 * carrying different conditions from the ones it accompanies would land in a
 * manipulator of its own instead of in the one that fires.
 */
function conditionSignatures(source: Binding): (Condition[] | undefined)[] {
  const signatures = new Map<string, Condition[] | undefined>();
  for (const c of source.cases) {
    signatures.set(JSON.stringify(c.conditions ?? []), c.conditions);
  }
  return [...signatures.values()];
}

function withConditions(base: Case, conditions: Condition[] | undefined): Case {
  return { ...base, ...(conditions?.length ? { conditions } : {}) };
}

/** The `used` marker: one press case per condition signature. */
function markUsedCases(source: Binding, usedVar: VarSpec): Case[] {
  return conditionSignatures(source).map((conditions) =>
    withConditions({ phase: "press", do: [setVar(usedVar, 1)] }, conditions),
  );
}

/**
 * Restore the tap/hold fallback the change of trigger would otherwise lose.
 *
 * A tap-hold binding that defines only one of the two phases gets the other
 * filled in by `buildKeyTapHold()` with its trigger key plus its *mandatory*
 * modifiers — so `⌘⌥⌃⇧+E` held emits `⌘⌥⌃⇧+E`. Re-triggered on bare `E` those
 * mandatory modifiers are gone and the fallback would degrade to a plain `e`.
 * Filling the phase explicitly with the layer's own modifier set keeps it.
 *
 * Press-only bindings need none of this: they compile to a plain remap with no
 * fallback phases at all. Neither do multi-tap bindings — `buildMultiTap()` has
 * no such fallback to lose, and inventing one would give the adopted copy a
 * hold action the original never had.
 */
function fallbackPhaseCases(
  source: Binding,
  state: CapsLayerState,
  translatedKey: string,
): Case[] {
  if (isMultiTap(source)) return [];
  const phases = new Set(source.cases.map((c) => c.phase ?? "press"));
  if (!phases.has("release") && !phases.has("hold")) return [];

  const emit = key(translatedKey, state.emit as unknown as ActionKeyModifier[], {
    halt: true,
  });

  return conditionSignatures(source).flatMap((conditions) =>
    (["release", "hold"] as const)
      .filter((phase) => !phases.has(phase))
      .map((phase) => withConditions({ phase, do: [emit] }, conditions)),
  );
}

/** One adopted binding, re-triggered on its layer's `from` instead of the combination. */
function adoptedTranslation(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
  state: CapsLayerState,
  translatedKey: string,
  source: Binding,
): Binding {
  // The source's description names the modifier combination it was written for,
  // which is not the trigger it is being emitted under here.
  const { description: _ignored, ...rest } = source;
  return {
    ...rest,
    trigger: layerTrigger(state, translatedKey),
    conditions: [
      ifUserVar(config.pressedVar, 1),
      ...(source.conditions ?? []),
    ],
    cases: [
      ...markUsedCases(source, config.usedVar),
      ...source.cases,
      ...fallbackPhaseCases(source, state, translatedKey),
    ],
    ...(isMultiTap(source)
      ? { multiTap: layerMultiTap(config, source, state, translatedKey) }
      : {}),
    ruleGroup,
  };
}

/** Group the adoptable bindings by `key@combination`, preserving order. */
function indexAdoptable(bindings: readonly Binding[]): Map<string, Binding[]> {
  const index = new Map<string, Binding[]>();
  for (const b of bindings) {
    if (!isAdoptable(b)) continue;
    const id = adoptionKey(b.trigger);
    if (!id) continue;
    const bucket = index.get(id);
    if (bucket) bucket.push(b);
    else index.set(id, [b]);
  }
  return index;
}

/** Every binding one layer state contributes, for every key it covers. */
function stateBindings(
  config: CapsLayerConfig,
  ruleGroup: { id: string; description: string },
  state: CapsLayerState,
  gridKeys: readonly string[],
  adoptable: ReadonlyMap<string, Binding[]>,
): Binding[] {
  const combination = modifierSetKey(state.emit);
  const adoptedKeys = [...adoptable.keys()]
    .filter((id) => id.endsWith(`@${combination}`))
    .map((id) => id.slice(0, id.lastIndexOf("@")));

  const keys = [...new Set([...gridKeys.map(resolveKeyAlias), ...adoptedKeys])];

  return keys.flatMap((k) => {
    const sources = adoptable.get(`${k}@${combination}`) ?? [];
    const emitFallback =
      sources.length === 0 || !sources.some(hasUnconditionalPath);
    return [
      // Adopted bindings first: they are the more specific of the two, and a
      // fallback ordered ahead of them would swallow the event.
      ...sources.map((s) => adoptedTranslation(config, ruleGroup, state, k, s)),
      // Only when nothing adopted is guaranteed to fire. Emitting the
      // combination alongside an unconditional adoption would be a duplicate
      // trigger under identical conditions, which the conflict analysis rejects.
      ...(emitFallback && (sources.length > 0 || gridKeys.includes(k))
        ? [layerKeyTranslation(config, ruleGroup, state, k)]
        : []),
    ];
  });
}

/**
 * The complete layer: the layer key, then the translations for every state.
 *
 * Emitted in state order with the base layer last. Matching is already
 * mutually exclusive — the base state lists none of the four selectors as
 * optional, so it cannot claim an event one of them owns — but ordering the
 * qualified states first keeps the emitted list readable and matches the order
 * `planRules()` would impose anyway.
 */
export function capsLayer(config: CapsLayerConfig): Binding[] {
  const gridKeys = config.keys ?? CAPS_LAYER_KEYS;
  const ruleGroup = capsRuleGroup(config);
  const adoptable = indexAdoptable(config.adopt ?? []);
  const qualified = CAPS_LAYER_STATES.filter((s) => s.selector);
  const base = CAPS_LAYER_STATES.filter((s) => !s.selector);

  return [
    layerKeyBinding(config, ruleGroup),
    ...[...qualified, ...base].flatMap((state) =>
      stateBindings(config, ruleGroup, state, gridKeys, adoptable),
    ),
    ...modifierPassThroughs(config, ruleGroup),
    layerCatchAll(config, ruleGroup),
  ];
}
