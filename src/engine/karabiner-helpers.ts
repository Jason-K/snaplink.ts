/**
 * Low-level AST helper and builder functions for constructing Karabiner JSON objects.
 */

import type {
  BasicManipulator,
  BasicParameters,
  Condition,
  ConsumerKeyCode,
  DeviceIdentifier,
  FromEvent,
  FromKeyType,
  FromModifiers,
  InputSourceSpecifier,
  KeyCode,
  KeyboardType,
  Manipulator,
  Modifier,
  PointingButton,
  Rule,
  SimultaneousOptions,
  ToEvent,
  ToEventOptions,
  ToStickyModifier,
  ToVariable,
} from "../types/karabiner";

/** Accepted manipulator input: a built manipulator, a nested array of them, or
 * an unbuilt {@link BasicManipulatorBuilder}. */
export type ManipulatorInput =
  | Manipulator
  | BasicManipulatorBuilder
  | ManipulatorInput[];

export class RuleBuilder {
  description: string | undefined;
  manipulatorsList: Manipulator[] = [];

  constructor(description?: string, ...manipulators: ManipulatorInput[]) {
    this.description = description;
    for (const m of manipulators) {
      this.addManipulators(m);
    }
  }

  public addManipulators(input: ManipulatorInput | undefined | null): this {
    if (!input) return this;
    if (input instanceof BasicManipulatorBuilder) {
      this.manipulatorsList.push(...input.build());
    } else if (Array.isArray(input)) {
      for (const item of input) {
        this.addManipulators(item);
      }
    } else {
      this.manipulatorsList.push(input);
    }
    return this;
  }

  /** Append manipulators to this rule. */
  public manipulators(manipulators: ManipulatorInput): this {
    return this.addManipulators(manipulators);
  }

  /**
   * Produce the plain Karabiner `Rule`.
   *
   * Only schema fields are emitted — this object is serialized straight into
   * the user's `karabiner.json`, so any extra key would be dead weight there.
   */
  public build(): Rule {
    return {
      ...(this.description !== undefined ? { description: this.description } : {}),
      manipulators: this.manipulatorsList,
    };
  }

  public toJSON(): Rule {
    return this.build();
  }
}

export function rule(description: string, ...manipulators: ManipulatorInput[]): RuleBuilder {
  return new RuleBuilder(description, ...manipulators);
}

function normalizeToEvent(event: KeyCode | ToEvent): ToEvent {
  if (typeof event === "string") {
    return toKey(event);
  }
  return event;
}

export function toKey(
  key_code: KeyCode | number,
  modifiers?: Modifier[] | string,
  options?: ToEventOptions,
): ToEvent {
  const mods = modifiers
    ? Array.isArray(modifiers)
      ? modifiers
      : [modifiers as Modifier]
    : undefined;
  // Spread rather than `modifiers: mods`: an `undefined`-valued key is what
  // `exactOptionalPropertyTypes` exists to prevent, and the `as ToEvent` cast
  // this replaces was suppressing exactly that check. `JSON.stringify` drops
  // such keys, so the emitted file was already correct — but only by luck.
  return {
    ...options,
    key_code,
    ...(mods ? { modifiers: mods } : {}),
  };
}

export function toPointingButton(
  pointing_button: PointingButton | number,
  modifiers?: Modifier[],
  options?: ToEventOptions,
): ToEvent {
  const mods = modifiers
    ? Array.isArray(modifiers)
      ? modifiers
      : [modifiers as Modifier]
    : undefined;
  // Spread rather than `modifiers: mods`: an `undefined`-valued key is what
  // `exactOptionalPropertyTypes` exists to prevent, and the `as ToEvent` cast
  // this replaces was suppressing exactly that check. `JSON.stringify` drops
  // such keys, so the emitted file was already correct — but only by luck.
  return {
    ...options,
    pointing_button,
    ...(mods ? { modifiers: mods } : {}),
  };
}

export function toConsumerKey(
  consumer_key_code: ConsumerKeyCode | number,
  modifiers?: Modifier[] | string,
  options?: ToEventOptions,
): ToEvent {
  const mods = modifiers
    ? Array.isArray(modifiers)
      ? modifiers
      : [modifiers as Modifier]
    : undefined;
  // Spread rather than `consumer_key_code: ...` alongside a possibly-`undefined`
  // `modifiers`: see the identical note on `toKey` above.
  return {
    ...options,
    consumer_key_code,
    ...(mods ? { modifiers: mods } : {}),
  };
}

export function toSetVar(
  name: string,
  value: number | boolean | string = 1,
  key_up_value?: number | boolean | string,
): ToEvent {
  const varObj: ToVariable = { name, value };
  if (key_up_value !== undefined) {
    varObj.key_up_value = key_up_value;
  }
  return { set_variable: varObj };
}

export function toStickyModifier(
  flag: string,
  toggle: 'on' | 'off' | 'toggle' | boolean = 'toggle',
): ToEvent {
  return {
    sticky_modifier: { [flag]: toggle } as ToStickyModifier,
  };
}

export function toNone(options?: ToEventOptions): ToEvent {
  return { ...options, key_code: 'vk_none' };
}

export class ConditionBuilder {
  constructor(private condition: Condition) {}

  unless(): this {
    if (this.condition.type.endsWith('_if')) {
      this.condition.type = this.condition.type.replace('_if', '_unless') as Condition["type"];
    }
    return this;
  }

  build(): Condition {
    return this.condition;
  }
}

/** Spread helper: emit `description` only when one was supplied. */
function withDescription(description?: string): { description?: string } {
  return description !== undefined ? { description } : {};
}

export function ifVar(
  name: string,
  value: number | boolean | string = 1,
  description?: string,
): ConditionBuilder {
  let expression: string;
  if (typeof value === "string") {
    const op = value.includes("*") || value.includes("?") ? "ilike" : "==";
    expression = `${name} ${op} '${value}'`;
  } else {
    expression = `${name} == ${Number(value)}`;
  }
  return new ConditionBuilder({
    type: "expression_if",
    expression,
    ...withDescription(description),
  });
}

export function ifApp(
  apps: string | string[] | { bundle_identifiers?: string[]; file_paths?: string[] },
  description?: string,
): ConditionBuilder {
  if (typeof apps === 'object' && !Array.isArray(apps)) {
    // The schema requires at least one of the two arrays (8.1), which the
    // spread form cannot prove — so branch on which one is present.
    const { bundle_identifiers, file_paths } = apps;
    if (bundle_identifiers) {
      return new ConditionBuilder({
        type: 'frontmost_application_if',
        bundle_identifiers,
        ...(file_paths ? { file_paths } : {}),
        ...withDescription(description),
      });
    }
    if (file_paths) {
      return new ConditionBuilder({
        type: 'frontmost_application_if',
        file_paths,
        ...withDescription(description),
      });
    }
    throw new Error('ifApp: one of bundle_identifiers or file_paths is required');
  }
  const bundle_identifiers = Array.isArray(apps) ? apps : [apps];
  return new ConditionBuilder({
    type: 'frontmost_application_if',
    bundle_identifiers,
    ...withDescription(description),
  });
}

export function ifDevice(
  identifiers: DeviceIdentifier | DeviceIdentifier[],
  description?: string,
): ConditionBuilder {
  const ids = Array.isArray(identifiers) ? identifiers : [identifiers];
  return new ConditionBuilder({
    type: 'device_if',
    identifiers: ids,
    ...withDescription(description),
  });
}

/**
 * `device_exists_*` (KE 14.8.4+) — tests whether the device is connected, not
 * whether it produced the event (gotcha 8.5).
 */
export function ifDeviceExists(
  identifiers: DeviceIdentifier | DeviceIdentifier[],
  description?: string,
): ConditionBuilder {
  const ids = Array.isArray(identifiers) ? identifiers : [identifiers];
  return new ConditionBuilder({
    type: "device_exists_if",
    identifiers: ids,
    ...withDescription(description),
  });
}

/** `keyboard_type_*` — the virtual keyboard type, not the physical device (8.6). */
export function ifKeyboardType(
  keyboardTypes: KeyboardType | KeyboardType[],
  description?: string,
): ConditionBuilder {
  const types = Array.isArray(keyboardTypes) ? keyboardTypes : [keyboardTypes];
  if (!types.length) throw new Error("ifKeyboardType: name at least one keyboard type");
  return new ConditionBuilder({
    type: "keyboard_type_if",
    keyboard_types: types,
    ...withDescription(description),
  });
}

/** `input_source_*` — every field is a regex; entries are ORed (8.1, 8.2). */
export function ifInputSource(
  sources: InputSourceSpecifier | InputSourceSpecifier[],
  description?: string,
): ConditionBuilder {
  const list = Array.isArray(sources) ? sources : [sources];
  if (!list.length) throw new Error("ifInputSource: name at least one input source");
  return new ConditionBuilder({
    type: "input_source_if",
    input_sources: list,
    ...withDescription(description),
  });
}

/** `event_changed_*` — whether Simple Modifications already rewrote this event (2.5). */
export function ifEventChanged(value: boolean, description?: string): ConditionBuilder {
  return new ConditionBuilder({
    type: "event_changed_if",
    value,
    ...withDescription(description),
  });
}

export function withCondition(...conditions: (Condition | ConditionBuilder)[]): {
  build: () => Condition[];
} {
  const resolved = conditions.map((c) => (c instanceof ConditionBuilder ? c.build() : c));
  return { build: () => resolved };
}

export class BasicManipulatorBuilder {
  protected manipulator: BasicManipulator;

  constructor(from: FromEvent) {
    this.manipulator = {
      type: 'basic',
      from,
    };
  }

  get [0](): BasicManipulator {
    return this.manipulator;
  }

  get from(): FromEvent {
    return this.manipulator.from;
  }

  to(event: KeyCode | ToEvent | (KeyCode | ToEvent)[], modifiers?: Modifier[]): this {
    this.manipulator.to = this.manipulator.to || [];
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      const norm = normalizeToEvent(e);
      if (modifiers && modifiers.length > 0) {
        norm.modifiers = modifiers;
      }
      this.manipulator.to.push(norm);
    }
    return this;
  }

  toIfAlone(event: KeyCode | ToEvent | (KeyCode | ToEvent)[]): this {
    this.manipulator.to_if_alone = this.manipulator.to_if_alone || [];
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      this.manipulator.to_if_alone.push(normalizeToEvent(e));
    }
    return this;
  }

  toIfHeldDown(event: KeyCode | ToEvent | (KeyCode | ToEvent)[]): this {
    this.manipulator.to_if_held_down = this.manipulator.to_if_held_down || [];
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      this.manipulator.to_if_held_down.push(normalizeToEvent(e));
    }
    return this;
  }

  toAfterKeyUp(event: KeyCode | ToEvent | (KeyCode | ToEvent)[]): this {
    this.manipulator.to_after_key_up = this.manipulator.to_after_key_up || [];
    const events = Array.isArray(event) ? event : [event];
    for (const e of events) {
      this.manipulator.to_after_key_up.push(normalizeToEvent(e));
    }
    return this;
  }

  /**
   * Rewrite the held `from` key itself when one of `otherKeys` is pressed.
   *
   * The documented fix for the `option+tab -> command+tab` trap: remapping via
   * `from.modifiers.mandatory` changes only the `tab` output, so pressing a
   * further modifier releases `left_command` and closes the app switcher
   * (gotcha 7.7). This channel rewrites the modifier key instead.
   *
   * Additive to `to` rather than replacing it, and stackable — call it once per
   * chord target. Both fields must be arrays and the entry rejects a
   * `description` key, which is this channel's one deviation from the
   * single-object shorthand every other `to*` channel accepts (gotcha 5.13).
   */
  toIfOtherKeyPressed(
    otherKeys: FromEvent | FromEvent[],
    to: KeyCode | ToEvent | (KeyCode | ToEvent)[],
  ): this {
    const keys = Array.isArray(otherKeys) ? otherKeys : [otherKeys];
    if (keys.length === 0) {
      throw new Error("toIfOtherKeyPressed: other_keys must name at least one key");
    }
    const events = (Array.isArray(to) ? to : [to]).map(normalizeToEvent);
    this.manipulator.to_if_other_key_pressed = this.manipulator.to_if_other_key_pressed ?? [];
    this.manipulator.to_if_other_key_pressed.push({
      other_keys: keys,
      to: events,
    });
    return this;
  }

  toDelayedAction(invoked?: ToEvent | ToEvent[], canceled?: ToEvent | ToEvent[]): this {
    const to_if_invoked = Array.isArray(invoked) ? invoked : invoked ? [invoked] : [];
    const to_if_canceled = Array.isArray(canceled) ? canceled : canceled ? [canceled] : [];
    this.manipulator.to_delayed_action = {
      to_if_invoked,
      to_if_canceled,
    };
    return this;
  }

  condition(...conditions: (Condition | ConditionBuilder)[]): this {
    this.manipulator.conditions = this.manipulator.conditions || [];
    for (const c of conditions) {
      const cond = c instanceof ConditionBuilder ? c.build() : c;
      this.manipulator.conditions.push(cond);
    }
    return this;
  }

  modifiers(
    mandatoryOrOpts?: Modifier | Modifier[] | 'optionalAny',
    optional?: Modifier | Modifier[],
  ): this {
    if (mandatoryOrOpts === 'optionalAny') {
      this.manipulator.from.modifiers = {
        ...this.manipulator.from.modifiers,
        optional: ['any'],
      };
    } else if (mandatoryOrOpts || optional) {
      const mods: FromModifiers = {};
      if (mandatoryOrOpts) mods.mandatory = Array.isArray(mandatoryOrOpts) ? mandatoryOrOpts : [mandatoryOrOpts];
      if (optional) mods.optional = Array.isArray(optional) ? optional : [optional];
      this.manipulator.from.modifiers = mods;
    }
    return this;
  }

  description(desc: string): this {
    this.manipulator.description = desc;
    return this;
  }

  parameters(params: BasicParameters): this {
    this.manipulator.parameters = { ...this.manipulator.parameters, ...params };
    return this;
  }

  /** Always a `basic` manipulator — the builder cannot produce another kind. */
  build(): BasicManipulator[] {
    return [this.manipulator];
  }

  *[Symbol.iterator](): Iterator<BasicManipulator> {
    yield this.manipulator;
  }
}

/**
 * Low-level manipulator builder: start a `basic` manipulator from a key code or
 * a `from` event.
 *
 * Not the same `map` as the `map()` action wrapper in `to-action-wrappers.ts`,
 * which emits a hotkey combo from the `COMBOS` registry. This one is engine
 * internals and is reachable only by importing `karabiner-helpers` directly —
 * it is not re-exported from the engine barrel.
 */
export function map(
  fromParam: KeyCode | FromEvent,
  mandatoryModifiers?: Modifier[],
  optionalModifiers?: Modifier[],
): BasicManipulatorBuilder {
  if (typeof fromParam === 'object' && fromParam !== null) {
    return new BasicManipulatorBuilder(fromParam);
  }
  const from: FromEvent = {
    key_code: fromParam,
  };
  if (mandatoryModifiers || optionalModifiers) {
    from.modifiers = {
      ...(mandatoryModifiers ? { mandatory: mandatoryModifiers } : {}),
      ...(optionalModifiers ? { optional: optionalModifiers } : {}),
    };
  }
  return new BasicManipulatorBuilder(from);
}

export function mapSimultaneous(
  keys: (KeyCode | FromKeyType)[],
  options?: SimultaneousOptions,
  thresholdMs?: number,
): BasicManipulatorBuilder {
  const simKeys: FromKeyType[] = keys.map((k) => (typeof k === 'string' ? { key_code: k } : k));
  const from: FromEvent = {
    simultaneous: simKeys,
    ...(options ? { simultaneous_options: options } : {}),
  };
  const builder = new BasicManipulatorBuilder(from);
  if (thresholdMs !== undefined) {
    builder.parameters({ 'basic.simultaneous_threshold_milliseconds': thresholdMs });
  }
  return builder;
}
