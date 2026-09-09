/**
 * Modal leader layers — tap or hold a key to enter a mode, then select.
 *
 * The second of the two layering paradigms in
 * [MISSING_FEATURES.md](../../docs/MISSING_FEATURES.md). `holdLayer()` covers
 * the first: a layer that is up exactly while its trigger is held. This one is
 * the harder case — the layer *outlives* the keypress that opened it, which is
 * what makes it useful (no contortion to hold space while reaching for `w`
 * then `h`) and what makes it dangerous. A momentary layer cannot get stuck; a
 * modal one can, and a stuck modal layer eats every keystroke you type
 * afterwards.
 *
 * Karabiner has no concept of a layer, so a modal layer is a *choreography* of
 * variables across a family of manipulators. Written by hand it is five or six
 * separate things that must all agree, and getting any one wrong fails quietly:
 *
 * 1. Entering must clear the leader's own output, or the leader key types
 *    itself as you enter.
 * 2. Entering a sublayer must clear the root variable **in the same `to`
 *    array**. Two live layer variables mean two live sets of mappings for the
 *    same key, and the earlier-emitted one silently wins.
 * 3. Every exit path — a mapping firing, escape, the leader again — must clear
 *    *every* variable, not just the one it knows about.
 * 4. An unmapped key must be swallowed while the layer is up, or it reaches the
 *    frontmost app; the manipulator that does the swallowing is a `from.any`
 *    catch-all, and a catch-all that is not evaluated last eats the layer's own
 *    mappings (gotcha 2.1).
 * 5. Every rule *outside* the layer must be gated on the layer being down, or
 *    it fires while the layer is up.
 *
 * This builder owns 1–4 and hands you 5 as {@link ModalLayer.suppress}, which
 * is a function rather than something applied automatically because the caller
 * decides what "everything else" means.
 *
 * ## Emission order
 *
 * The returned bindings must be planned as their own set, ahead of the plain
 * rules — the same treatment `CAPS_LAYER_SET` gets in `src/config.ts`, and for
 * the same reason: a layer mapping for `f` carries no mandatory modifiers, so
 * trigger order alone would sort it level with the plain `f` rule and the plain
 * rule would consume the key first. Within the set, ordering takes care of
 * itself — `compareTriggerSortKeys` already sorts `from.any` triggers last.
 *
 * ```ts
 * const nav = modalLayer({ leader: "spacebar", sublayers: { … } });
 *
 * export const MODAL_LAYER_SET = { name: "nav-layer", bindings: nav.bindings };
 * export const BINDING_SETS = [{ name: "tap-hold", bindings: nav.suppress(tapHoldBindings) }];
 * export function rulePlan() {
 *   return [...planRules([MODAL_LAYER_SET]), ...planRules(BINDING_SETS)];
 * }
 * ```
 *
 * ## No timeout, deliberately
 *
 * A modal layer that expires on its own would be nice, and Karabiner cannot
 * express it. `to_delayed_action` is the only timer available, it is scoped to
 * a single manipulator, and it is cancelled by the next key press — which is
 * precisely the event that should *not* end a leader sequence. Wiring it up
 * anyway produces a layer that expires while you are mid-sequence, or one whose
 * timer stops meaning anything after the first keystroke. So the exits here are
 * all explicit: a mapping fires, escape, the leader again, or (with
 * `onUnmapped: "exit"`) any key that is not part of the layer.
 */

import type {
  ActionSpec,
  Binding,
  Case,
  Condition,
  KeyCode,
  VarSpec,
} from "../data";
import { bind, options, scoped } from "./wrappers";
import { anyInput, from, type FromInput } from "./wrappers";
import { hold, key, noop, press, release, setVar, to, type ActionInput } from "./wrappers";
import { ifUserVar, when } from "./wrappers";
import { getTriggerKeys } from "./utils";

/**
 * One mapping's worth of actions, in the same shapes `bindTable()` accepts.
 *
 * A bare action becomes a `press` case, which is what you want almost always:
 * a mapping inside a layer is a selection, and a selection resolves on key-down.
 * A pre-built `release()` / `hold()` case is accepted too — but note that the
 * layer closes from the `to` channel either way, so the layer is already down
 * by the time a `hold()` mapping fires. That is deliberate (the selection is
 * committed at key-down), not something to work around.
 */
export type ModalMapping = ActionInput | ActionInput[] | Case | Case[];

/** A table of key → action, as `holdLayer()` and `bindTable()` take. */
export type ModalMappings = Partial<Record<KeyCode, ModalMapping>>;

/** One sublayer, entered by its key from the root layer. */
export type ModalSublayer = {
  /** Label for the sublayer's rule group in the Karabiner GUI. */
  description?: string;
  /** Key → action for this sublayer. */
  mappings: ModalMappings;
  /**
   * Keep the sublayer up after a mapping fires, instead of exiting.
   *
   * For a sublayer whose mappings are meant to be repeated — nudging a window,
   * stepping through tabs. The layer then only exits via escape or the leader,
   * so a sticky sublayer without a reachable escape key is a trap; this builder
   * refuses that combination.
   */
  sticky?: boolean;
};

/** What an unmapped key does while the layer is up. */
export type ModalUnmappedPolicy =
  /** Swallowed. The layer stays up — a typo does not cost you the sequence. */
  | "swallow"
  /** Swallowed, and the layer exits. Closer to a vim-style mode. */
  | "exit"
  /**
   * Reaches the frontmost app. No catch-all is emitted at all.
   *
   * Only sane for a layer whose mappings cover everything you might press.
   * Otherwise the layer stays up while you type into the app underneath it,
   * and the next key that *is* mapped fires unexpectedly.
   */
  | "passthrough";

export type ModalLayerConfig = {
  /** The key that opens the layer. */
  leader: FromInput;

  /**
   * How the leader opens the layer.
   *
   * - `"hold"` (default) — held past the hold threshold; a tap emits
   *   {@link tapAlone} instead, so a leader on a key you actually type
   *   (`spacebar`) keeps working.
   * - `"tap"` — opened by a tap. Only for a key with nothing else to do.
   */
  enterOn?: "hold" | "tap";

  /**
   * What a tap on the leader emits in `"hold"` mode. Defaults to the leader key
   * itself, which is what makes a leader on `spacebar` still type a space.
   */
  tapAlone?: ActionInput | ActionInput[];

  /**
   * Prefix for the layer's variable names. Defaults to a slug of the leader
   * key, so `spacebar` gives `spacebar_mod` and `spacebar_w_sublayer`.
   */
  prefix?: string;

  /** Key that exits the layer. `false` to omit it. Defaults to `"escape"`. */
  escapeKey?: KeyCode | false;

  /** Behaviour for keys the layer does not map. Defaults to `"swallow"`. */
  onUnmapped?: ModalUnmappedPolicy;

  /** Mappings fired directly from the root layer, without a sublayer. */
  mappings?: ModalMappings;

  /** Sublayers, keyed by the key that enters each one. */
  sublayers?: Partial<Record<KeyCode, ModalSublayer>>;

  /** Keep the root layer up after a root mapping fires. See {@link ModalSublayer.sticky}. */
  sticky?: boolean;

  /** Hold threshold for the leader, in `"hold"` mode. */
  timing?: { aloneMs?: number; holdMs?: number };

  /** Label for the layer's rule group in the Karabiner GUI. */
  description?: string;
};

/** The layer, plus the two things a caller has to do with it. */
export type ModalLayer = {
  /** Group id and GUI label, shared by every binding in the layer. */
  name: string;
  /**
   * Every binding the layer needs, to be planned as its own set ahead of the
   * plain rules.
   */
  bindings: Binding[];
  /** Every variable the layer owns — root first, then one per sublayer. */
  variables: VarSpec[];
  /**
   * Gate a block of bindings on the layer being down.
   *
   * The fifth obligation from the header: without this, every rule outside the
   * layer fires while the layer is up, and a leader sequence types into the app
   * underneath. Applies `variable_unless` for every layer variable.
   *
   * @example
   * ```ts
   * { name: "tap-hold", bindings: nav.suppress(tapHoldBindings) }
   * ```
   */
  suppress: (bindings: readonly Binding[]) => Binding[];
};

const slug = (s: string): string => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

/**
 * Build a modal leader layer.
 *
 * @param config - Leader, mappings, sublayers and exit policy.
 * @returns The layer's bindings, its variables, and the suppression helper.
 * @throws When the layer would have no way out — a sticky layer with no escape
 *   key, or an empty layer with nothing to select.
 *
 * @example
 * ```ts
 * const nav = modalLayer({
 *   leader: "spacebar",
 *   sublayers: {
 *     d: { description: "Downloads", mappings: { f: folder(PATHS.downloads) } },
 *     w: {
 *       description: "Window management",
 *       sticky: true,
 *       mappings: { h: URLS.hsWinLeftTop, l: URLS.hsWinRightBottom },
 *     },
 *   },
 *   mappings: { q: APPS.qspace },
 * });
 * ```
 */
export function modalLayer(config: ModalLayerConfig): ModalLayer {
  const leaderTrigger = from(config.leader);
  const leaderKeys = getTriggerKeys(leaderTrigger);
  const prefix = config.prefix ?? slug(String(leaderKeys[0] ?? "modal"));
  const escapeKey = config.escapeKey === undefined ? ("escape" as KeyCode) : config.escapeKey;
  const onUnmapped = config.onUnmapped ?? "swallow";
  const enterOn = config.enterOn ?? "hold";
  const name = config.description ?? `${prefix} modal layer`;
  const ruleGroup = { id: `${prefix}_modal_layer`, description: name };

  const rootVar: VarSpec = {
    name: `${prefix}_mod`,
    varDesc: `${name} active`,
  };
  const sublayerEntries = Object.entries(config.sublayers ?? {}) as [KeyCode, ModalSublayer][];
  const sublayerVars = new Map<KeyCode, VarSpec>(
    sublayerEntries.map(([k, sub]) => [
      k,
      { name: `${prefix}_${slug(k)}_sublayer`, varDesc: sub.description ?? `${name} › ${k}` },
    ]),
  );
  const variables: VarSpec[] = [rootVar, ...sublayerVars.values()];

  const rootMappings = Object.entries(config.mappings ?? {}) as [KeyCode, ModalMapping][];
  if (rootMappings.length === 0 && sublayerEntries.length === 0) {
    throw new Error(
      `modalLayer("${prefix}"): no mappings and no sublayers — the layer would open onto nothing.`,
    );
  }

  // A key cannot both enter a sublayer and fire a root mapping: both compile to
  // `from: <key>` gated on the root variable, which is the exact shape
  // `analyze-conflicts` reports as `duplicate` — a build failure two passes
  // downstream, phrased in terms of manipulators rather than the table that
  // caused it.
  const collisions = rootMappings
    .map(([k]) => k)
    .filter((k) => sublayerVars.has(k));
  if (collisions.length) {
    throw new Error(
      `modalLayer("${prefix}"): ${collisions.map((k) => `"${k}"`).join(", ")} ` +
        "appears both as a sublayer and as a root mapping. Both would be gated on " +
        `${rootVar.name}, and only the first would ever fire.`,
    );
  }

  const anySticky = Boolean(config.sticky) || sublayerEntries.some(([, s]) => s.sticky);
  if (anySticky && escapeKey === false && onUnmapped !== "exit") {
    throw new Error(
      `modalLayer("${prefix}"): a sticky layer with escapeKey: false and ` +
        `onUnmapped: "${onUnmapped}" has no exit — it would stay up until Karabiner restarts. ` +
        'Give it an escape key, or set onUnmapped: "exit".',
    );
  }

  /** Clear every layer variable. The only correct way to leave, from anywhere. */
  const exitAll = (): ActionSpec[] => variables.map((v) => setVar(v, 0));

  const opts = options({ ruleGroup });
  const bindings: Binding[] = [];

  // ── 1. Enter ───────────────────────────────────────────────────────────────
  //
  // In "hold" mode the tap case is what keeps the leader key usable, and it has
  // to clear the layer as well as emit: a hold that never reached the threshold
  // still leaves `to_delayed_action` armed, and `suppressCancelFallback` stops
  // that channel from replaying the tap after the layer has opened.
  const tapAction: ActionInput | ActionInput[] =
    config.tapAlone ?? (leaderKeys[0] ? key(leaderKeys[0] as KeyCode, { halt: true }) : []);

  bindings.push(
    enterOn === "hold"
      ? bind(
          leaderTrigger,
          to(
            release([...(Array.isArray(tapAction) ? tapAction : [tapAction]), ...exitAll()]),
            hold([setVar(rootVar, 1)]),
          ),
          options({
            ruleGroup,
            suppressCancelFallback: true,
            ...(config.timing ? { timing: config.timing } : {}),
          }),
        )
      : bind(
          leaderTrigger,
          to(release([setVar(rootVar, 1)]), hold([])),
          options({ ruleGroup, suppressCancelFallback: true }),
        ),
  );

  // ── 2. Leave by pressing the leader again ──────────────────────────────────
  //
  // One binding per variable rather than one with all of them: conditions on a
  // manipulator are ANDed, so a single binding would only exit when every layer
  // variable was set at once, which never happens.
  for (const v of variables) {
    bindings.push(bind(leaderTrigger, to(press(exitAll())), when(ifUserVar(v, 1)), opts));
  }

  // ── 3. Leave by escape ─────────────────────────────────────────────────────
  //
  // Emits nothing: while the layer is up, escape means "close the layer", and
  // passing an escape to the app underneath is a second, unasked-for action.
  if (escapeKey !== false) {
    for (const v of variables) {
      bindings.push(bind(from(escapeKey), to(press(exitAll())), when(ifUserVar(v, 1)), opts));
    }
  }

  // ── 4. Enter a sublayer ────────────────────────────────────────────────────
  //
  // The hand-off: set the sublayer and clear the root in one `to` array, so the
  // two are never both live. Conditions are evaluated once, before the first
  // event of the array, so ordering within it does not matter (gotcha 5.10) —
  // what matters is that both happen on the same key-down.
  for (const [k, v] of sublayerVars) {
    bindings.push(
      bind(from(k), to(press([setVar(v, 1), setVar(rootVar, 0)])), when(ifUserVar(rootVar, 1)), opts),
    );
  }

  // ── 5. Fire a mapping ──────────────────────────────────────────────────────
  const mappingBinding = (
    triggerKey: KeyCode,
    mapping: ModalMapping,
    gate: VarSpec,
    sticky: boolean,
  ): Binding => {
    const explicitCases = isCaseLike(mapping);
    const cases: Case[] = explicitCases
      ? (Array.isArray(mapping) ? (mapping as Case[]) : [mapping as Case])
      : [press(mapping as ActionInput | ActionInput[])];
    // A one-shot layer closes itself in the same `to` array as the action, so
    // there is no window in which the layer is up but the action has fired.
    const exit: Case[] = sticky ? [] : [press(exitAll())];
    return bind(from(triggerKey), to(...cases, ...exit), when(ifUserVar(gate, 1)), opts);
  };

  for (const [k, mapping] of rootMappings) {
    bindings.push(mappingBinding(k, mapping, rootVar, Boolean(config.sticky)));
  }
  for (const [subKey, sub] of sublayerEntries) {
    const gate = sublayerVars.get(subKey)!;
    for (const [k, mapping] of Object.entries(sub.mappings) as [KeyCode, ModalMapping][]) {
      bindings.push(mappingBinding(k, mapping, gate, Boolean(sub.sticky)));
    }
  }

  // ── 6. Swallow everything else ─────────────────────────────────────────────
  //
  // `compareTriggerSortKeys` sorts `from.any` last within the set, which is the
  // ordering constraint this depends on: a catch-all reached before the
  // mappings above would eat them.
  if (onUnmapped !== "passthrough") {
    const swallow = onUnmapped === "exit" ? exitAll() : [noop()];
    for (const v of variables) {
      bindings.push(bind(anyInput("key_code"), to(press(swallow)), when(ifUserVar(v, 1)), opts));
    }
  }

  return {
    name,
    bindings,
    variables,
    suppress: (targets: readonly Binding[]): Binding[] =>
      scoped(when(...variables.map((v) => ifUserVar(v, 1, true))), [...targets]),
  };
}

/** `true` for a pre-built `Case` (or array of them) rather than a bare action. */
function isCaseLike(value: unknown): boolean {
  const one = (v: unknown): boolean =>
    typeof v === "object" && v !== null && "do" in (v as Record<string, unknown>);
  return Array.isArray(value) ? value.length > 0 && one(value[0]) : one(value);
}

/** The condition set that means "no layer of this family is up". */
export function modalLayerDownConditions(layer: ModalLayer): Condition[] {
  return layer.variables.map((v) => ifUserVar(v, 1, true));
}
