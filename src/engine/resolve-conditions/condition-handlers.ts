/**
 * The single registry of what each {@link Condition} variant *is*.
 *
 * The authoring form stays structural — `{ app: … }`, `{ var: …, equals: … }` —
 * so definitions read naturally and gain no ceremony. {@link conditionKind} is
 * the one place that shape is inspected; everything downstream dispatches on the
 * resulting tag through this registry, whose `satisfies ConditionHandlers`
 * annotation makes a missing entry a compile error naming the tag.
 *
 * Adding a condition type is therefore: add the variant, extend
 * {@link conditionKind}, add one entry here. Previously the same knowledge was
 * spread across five hand-maintained `"x" in c` chains, three of which fell
 * through to the device branch for anything unrecognised.
 */

import type { Condition as KarabinerCondition } from "../../types/karabiner";
import type { Condition } from "../../data";
import {
  ifApp,
  ifDevice,
  ifDeviceExists,
  ifEventChanged,
  ifInputSource,
  ifKeyboardType,
} from "../karabiner-helpers";
import { karabinerDeviceId } from "../resolve-trigger/device-config";

export type ConditionKind =
  | "app"
  | "var"
  | "device"
  | "deviceExists"
  | "keyboardType"
  | "inputSource"
  | "eventChanged";

type AppCondition = Extract<Condition, { app: unknown }>;
type VarCondition = Extract<Condition, { var: unknown }>;
type DeviceCondition = Extract<Condition, { device: unknown }>;
type DeviceExistsCondition = Extract<Condition, { deviceExists: unknown }>;
type KeyboardTypeCondition = Extract<Condition, { keyboardType: unknown }>;
type InputSourceCondition = Extract<Condition, { inputSource: unknown }>;
type EventChangedCondition = Extract<Condition, { eventChanged: unknown }>;

type ConditionOfKind = {
  app: AppCondition;
  var: VarCondition;
  device: DeviceCondition;
  deviceExists: DeviceExistsCondition;
  keyboardType: KeyboardTypeCondition;
  inputSource: InputSourceCondition;
  eventChanged: EventChangedCondition;
};

/**
 * Every `Condition` variant must appear in {@link ConditionOfKind}.
 *
 * Without this, adding a variant to the union compiles cleanly and then throws
 * from {@link conditionKind} at build time — `satisfies ConditionHandlers` only
 * enforces coverage of the kinds already listed, so it cannot see a variant
 * that was never given a kind.
 */
type UncoveredConditions = Exclude<Condition, ConditionOfKind[ConditionKind]>;
type EveryConditionHasAKind = UncoveredConditions extends never ? true : UncoveredConditions;
const _everyConditionHasAKind: EveryConditionHasAKind = true;
void _everyConditionHasAKind;

export type ConditionHandler<K extends ConditionKind> = {
  /** Compile to the Karabiner-native condition object. */
  toKarabiner: (c: ConditionOfKind[K]) => KarabinerCondition;
  /** Human label used in rule descriptions. */
  describe: (c: ConditionOfKind[K]) => string;
  /**
   * Canonical identity of what this condition tests, ignoring `unless`.
   * Two conditions with the same kind and target refer to the same fact.
   */
  targetKey: (c: ConditionOfKind[K]) => string;
  /**
   * `true` when two conditions of this kind can never both hold.
   * Requiring this per kind means a new condition type cannot be added without
   * stating how it interacts with conflict analysis.
   */
  contradicts: (a: ConditionOfKind[K], b: ConditionOfKind[K]) => boolean;
};

export type ConditionHandlers = {
  [K in ConditionKind]: ConditionHandler<K>;
};

/**
 * The single structural inspection of a `Condition`.
 *
 * @throws when the object matches no known variant — better a loud failure at
 * build time than silently compiling to the wrong Karabiner condition.
 */
export function conditionKind(c: Condition): ConditionKind {
  if ("app" in c) return "app";
  if ("var" in c) return "var";
  if ("device" in c) return "device";
  if ("deviceExists" in c) return "deviceExists";
  if ("keyboardType" in c) return "keyboardType";
  if ("inputSource" in c) return "inputSource";
  if ("eventChanged" in c) return "eventChanged";
  throw new Error(
    `Unrecognised condition shape: ${JSON.stringify(c)}. ` +
      "Add the variant to the Condition union, to conditionKind(), and to CONDITION_HANDLERS.",
  );
}

/** Split an app condition's refs into bundle identifiers and file paths. */
function splitAppRefs(c: AppCondition): { bundleIds: string[]; filePaths: string[] } {
  const refs = Array.isArray(c.app) ? c.app : [c.app];
  const bundleIds: string[] = [];
  const filePaths: string[] = [];

  for (const ref of refs) {
    if (typeof ref === "string") {
      // A bare string is a path when it looks like one, else a bundle id.
      if (ref.startsWith("/") || ref.endsWith(".app")) filePaths.push(ref);
      else bundleIds.push(ref);
      continue;
    }
    if (ref.type === "path") {
      filePaths.push(ref.path);
      continue;
    }
    if (ref.bundleId) {
      bundleIds.push(...(Array.isArray(ref.bundleId) ? ref.bundleId : [ref.bundleId]));
    }
    if (ref.path) {
      filePaths.push(...(Array.isArray(ref.path) ? ref.path : [ref.path]));
    }
  }

  return { bundleIds, filePaths };
}

function appLabel(c: AppCondition): string {
  const refs = Array.isArray(c.app) ? c.app : [c.app];
  return refs.map((r) => (typeof r === "string" ? r : r.refDesc)).join("/");
}

function appTargetKey(c: AppCondition): string {
  const { bundleIds, filePaths } = splitAppRefs(c);
  return [...bundleIds, ...filePaths].sort().join("|");
}

function deviceTargetKey(c: DeviceCondition): string {
  return `${c.device.vendor_id}:${c.device.product_id}`;
}

export const CONDITION_HANDLERS = {
  app: {
    toKarabiner: (c) => {
      const { bundleIds, filePaths } = splitAppRefs(c);
      const builder =
        bundleIds.length && filePaths.length
          ? ifApp({ bundle_identifiers: bundleIds, file_paths: filePaths })
          : filePaths.length
            ? ifApp({ file_paths: filePaths })
            : ifApp(bundleIds);
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) => (c.unless ? `Outside ${appLabel(c)}` : `In ${appLabel(c)}`),
    targetKey: appTargetKey,
    contradicts: (a, b): boolean => {
      // Two different apps cannot both be frontmost.
      if (appTargetKey(a) !== appTargetKey(b)) return !a.unless && !b.unless;
      return Boolean(a.unless) !== Boolean(b.unless);
    },
  },

  var: {
    toKarabiner: (c) => {
      if (typeof c.equals === "string" && (c.equals.includes("*") || c.equals.includes("?"))) {
        return {
          type: c.unless ? "expression_unless" : "expression_if",
          expression: `${c.var.name} ilike '${c.equals}'`,
        };
      }
      return {
        type: c.unless ? "variable_unless" : "variable_if",
        name: c.var.name,
        value: c.equals,
      } as any;
    },
    describe: (c) => (c.unless ? `not ${c.var.varDesc}` : c.var.varDesc),
    targetKey: (c) => `${c.var.name}=${String(c.equals)}`,
    contradicts: (a, b) => {
      if (a.var.name !== b.var.name) return false;
      const samePolarity = Boolean(a.unless) === Boolean(b.unless);
      if (a.equals === b.equals) return !samePolarity;
      // Different values contradict only when both demand a specific value.
      return samePolarity && !a.unless;
    },
  },

  device: {
    toKarabiner: (c) => {
      const builder = ifDevice(karabinerDeviceId(c.device));
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) =>
      c.unless ? `not on ${c.device.deviceDesc}` : `on ${c.device.deviceDesc}`,
    targetKey: deviceTargetKey,
    contradicts: (a, b): boolean => {
      if (a.unless || b.unless) return false;
      // One input event has exactly one source device.
      return deviceTargetKey(a) !== deviceTargetKey(b);
    },
  },

  deviceExists: {
    toKarabiner: (c) => {
      const builder = ifDeviceExists(karabinerDeviceId(c.deviceExists));
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) =>
      c.unless
        ? `without ${c.deviceExists.deviceDesc} connected`
        : `with ${c.deviceExists.deviceDesc} connected`,
    targetKey: (c) => `${c.deviceExists.vendor_id}:${c.deviceExists.product_id}`,
    // Any number of devices can be connected at once, so two positive
    // conditions on different devices are simultaneously satisfiable — unlike
    // `device`, where one event has exactly one source.
    contradicts: () => false,
  },

  keyboardType: {
    toKarabiner: (c) => {
      const builder = ifKeyboardType(c.keyboardType);
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) => {
      const types = (Array.isArray(c.keyboardType) ? c.keyboardType : [c.keyboardType]).join("/");
      return c.unless ? `not on a ${types} keyboard` : `on a ${types} keyboard`;
    },
    targetKey: (c) =>
      (Array.isArray(c.keyboardType) ? [...c.keyboardType] : [c.keyboardType]).sort().join("|"),
    contradicts: (a, b): boolean => {
      if (a.unless || b.unless) return false;
      // Exactly one virtual keyboard type is configured, so two positive
      // conditions contradict only when their accepted sets are disjoint.
      const setA = new Set(Array.isArray(a.keyboardType) ? a.keyboardType : [a.keyboardType]);
      const listB = Array.isArray(b.keyboardType) ? b.keyboardType : [b.keyboardType];
      return !listB.some((t) => setA.has(t));
    },
  },

  inputSource: {
    toKarabiner: (c) => {
      const builder = ifInputSource(c.inputSource);
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) => {
      const list = Array.isArray(c.inputSource) ? c.inputSource : [c.inputSource];
      const label = list
        .map((src) => src.language ?? src.input_source_id ?? src.input_mode_id ?? "?")
        .join("/");
      return c.unless ? `not in input source ${label}` : `in input source ${label}`;
    },
    targetKey: (c) => {
      const list = Array.isArray(c.inputSource) ? c.inputSource : [c.inputSource];
      return list
        .map((src) => `${src.language ?? ""}~${src.input_source_id ?? ""}~${src.input_mode_id ?? ""}`)
        .sort()
        .join("|");
    },
    // Every field is a regular expression, so two specifiers may well both
    // match the active source. Claiming contradiction we cannot prove would let
    // the analyzer drop a reachable rule as dead; never claiming it only costs
    // some fallback elimination.
    contradicts: () => false,
  },

  eventChanged: {
    toKarabiner: (c) => {
      const builder = ifEventChanged(c.eventChanged);
      return c.unless ? builder.unless().build() : builder.build();
    },
    describe: (c) => {
      const changed = c.eventChanged !== Boolean(c.unless);
      return changed ? "when already remapped" : "when not already remapped";
    },
    targetKey: () => "event_changed",
    contradicts: (a, b): boolean => {
      if (a.unless || b.unless) return false;
      // One boolean fact about the event in flight.
      return a.eventChanged !== b.eventChanged;
    },
  },
} satisfies ConditionHandlers;

function handlerFor<K extends ConditionKind>(kind: K): ConditionHandler<K> {
  return CONDITION_HANDLERS[kind] as ConditionHandler<K>;
}

/** Compile a high-level condition into its Karabiner-native form. */
export function resolveCondition(c: Condition): KarabinerCondition {
  return handlerFor(conditionKind(c)).toKarabiner(c as never);
}

/** Human label for one condition. */
export function describeCondition(c: Condition): string {
  return handlerFor(conditionKind(c)).describe(c as never);
}

/** Structural identity of a condition, including polarity. */
export function conditionKey(c: Condition): string {
  const kind = conditionKind(c);
  const polarity = (c as { unless?: boolean }).unless ? "unless" : "if";
  return `${kind}:${handlerFor(kind).targetKey(c as never)}:${polarity}`;
}

/**
 * `true` when exactly one of the two conditions holds in any state: the same
 * test with opposite polarity.
 *
 * Stronger than {@link conditionsContradict}, which only rules out "both" —
 * `In Word` and `In Excel` contradict, but leave every other app uncovered.
 * Complementary conditions also rule out "neither", so the pair exhausts the
 * input domain between them and a fallback behind both is unreachable.
 */
export function conditionsComplementary(a: Condition, b: Condition): boolean {
  const kind = conditionKind(a);
  if (kind !== conditionKind(b)) return false;
  const handler = handlerFor(kind);
  if (handler.targetKey(a as never) !== handler.targetKey(b as never))
    return false;
  return (
    Boolean((a as { unless?: boolean }).unless) !==
    Boolean((b as { unless?: boolean }).unless)
  );
}

/** `true` when two conditions can never both hold. */
export function conditionsContradict(a: Condition, b: Condition): boolean {
  const kind = conditionKind(a);
  if (kind !== conditionKind(b)) return false;
  return handlerFor(kind).contradicts(a as never, b as never);
}

/** `true` when this condition tests whether an application is frontmost. */
export function isAppCondition(c: Condition): c is AppCondition {
  return conditionKind(c) === "app";
}
