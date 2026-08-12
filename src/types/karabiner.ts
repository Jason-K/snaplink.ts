/**
 * Native Karabiner-Elements JSON AST.
 *
 * Structure and cross-field rules mirror `schema/karabiner-rule.schema.json`.
 * Parenthesised references (3.4, 5.13, ...) point at numbered entries in
 * `docs/karabiner_docs/karabiner-gotchas.md`.
 *
 * Key-name unions come from `./keys.generated` — regenerate with `npm run codegen`.
 */

import type {
  AnyEventType,
  AppleVendorKeyboardKeyCode,
  AppleVendorTopCaseKeyCode,
  ConsumerKeyCode,
  GenericDesktopKeyCode,
  KarabinerModifierOrAny,
  KeyCode,
  PointingButton,
} from "./keys.generated";

export type {
  AnyEventType,
  AppleVendorKeyboardKeyCode,
  AppleVendorTopCaseKeyCode,
  ConsumerKeyCode,
  GenericDesktopKeyCode,
  KeyCode,
  PointingButton,
};

// ============================================================================
// EXCLUSIVITY HELPERS
// ============================================================================

/**
 * Exactly one key of `T` present; every sibling is forbidden outright.
 *
 * Under `exactOptionalPropertyTypes`, `?: never` means "absent", not "may be
 * undefined" — which is precisely the emitter's existing
 * `...(x ? { k: x } : {})` idiom, now enforced by the compiler.
 */
export type ExactlyOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Record<Exclude<keyof T, K>, never>>;
}[keyof T];

/** At least one key of `T` present; the rest stay optional. */
export type AtLeastOne<T, K extends keyof T = keyof T> = K extends unknown
  ? Required<Pick<T, K>> & Omit<T, K>
  : never;

// ============================================================================
// MODIFIERS
// ============================================================================

/** The 18 real modifier names (the parser enum minus `"any"`). */
export type Modifier = Exclude<KarabinerModifierOrAny, "any">;

/**
 * A `from.modifiers` member. Here `command` / `control` / `option` / `shift`
 * match **either side**, and `"any"` matches any modifier. (3.4)
 */
export type FromModifier = KarabinerModifierOrAny;

/**
 * A `to.modifiers` member. Here `command` / `control` / `option` / `shift` are
 * aliases of the **left** variants only — same spelling as `FromModifier`,
 * opposite meaning. (3.4)
 *
 * `"any"` is deliberately excluded: the parser accepts it and maps it to no
 * modifier flag, so writing it here is always a silent no-op. (3.8)
 */
export type ToModifier = Modifier;

/**
 * `mandatory` modifiers are **consumed** — removed from the `to` events.
 * `optional` modifiers are passed through. Without `optional: ["any"]` the
 * manipulator will not fire when any extra modifier is held, which is the
 * single most common cause of "my rule doesn't fire". With no `modifiers` key
 * at all it fires only when nothing is held, `caps_lock` included. (3.1–3.3)
 *
 * Arrays only. The parser also accepts a bare string (3.7); tolerate that on
 * the import path via {@link FromModifiersLoose}, never on the emit path —
 * array-only keeps every `.map` / `.includes` in the engine total.
 */
export type FromModifiers = {
  mandatory?: FromModifier[];
  optional?: FromModifier[];
};

/** Import-side widening for third-party JSON. Not for emission. (3.7) */
export type FromModifiersLoose = {
  mandatory?: FromModifier | FromModifier[];
  optional?: FromModifier | FromModifier[];
};

// ============================================================================
// EVENT KEYS
// ============================================================================

/**
 * The event-key families, shared by `from` and `to`. Raw usage numbers are
 * legal and must **not** be quoted. (4.2)
 */
type EventKeyMap = {
  key_code: KeyCode | number;
  consumer_key_code: ConsumerKeyCode | number;
  /** Undocumented, but parsed in both `from` and `to`. (4.10) */
  apple_vendor_keyboard_key_code: AppleVendorKeyboardKeyCode | number;
  /** Undocumented, but parsed in both `from` and `to`. (4.10) */
  apple_vendor_top_case_key_code: AppleVendorTopCaseKeyCode | number;
  /** Appears nowhere in the published docs. (4.10) */
  generic_desktop: GenericDesktopKeyCode | number;
  /** DANGER: `button1` in `from` can cost you the left click. (1.1) */
  pointing_button: PointingButton | number;
  /** DANGER: `"pointing_button"` here can leave the system unusable. (1.1, 4.11) */
  any: AnyEventType;
};

/**
 * One event key. Used for `from.simultaneous` entries and for
 * `to_if_other_key_pressed[].other_keys`.
 */
export type FromKeyType = ExactlyOne<EventKeyMap> & {
  /** Accepted inside event definitions, not only at manipulator level. (4.12) */
  description?: string;
};

export type SimultaneousKeyOrder = "insensitive" | "strict" | "strict_inverse";

/**
 * `from.simultaneous_options`.
 * @see docs/karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous-options
 */
export type SimultaneousOptions = {
  /** An unrelated key_down between the target keys no longer cancels the match. (4.4) */
  detect_key_down_uninterruptedly?: boolean;
  key_down_order?: SimultaneousKeyOrder;
  /**
   * Ignored once `basic.simultaneous_threshold_milliseconds` elapses — raise
   * that parameter substantially (the docs use 500) when relying on this. (4.6)
   */
  key_up_order?: SimultaneousKeyOrder;
  /** Default `any`: key_up is posted when *any* `from` key is released. (4.5) */
  key_up_when?: "any" | "all";
  /** Fires once every `from` event is released — where mode flags get cleared. (4.8) */
  to_after_key_up?: ToEvent[];
  description?: string;
};

/** `from`. Exactly one of the event keys / `any` / `simultaneous`. (4.1) */
export type FromEvent = ExactlyOne<
  EventKeyMap & {
    /**
     * All pressed within `basic.simultaneous_threshold_milliseconds`
     * (default 50). (4.3, 4.4)
     *
     * `minItems: 2` is enforced by the schema at validate time rather than by a
     * non-empty tuple here: the emitter builds this with `.map()` and cannot
     * prove the length to the compiler without an assertion at every call site.
     */
    simultaneous: FromKeyType[];
  }
> & {
  modifiers?: FromModifiers;
  /** Devices that distinguish buttons by integer value (footpedals). (4.9) */
  integer_value?: number;
  simultaneous_options?: SimultaneousOptions;
  description?: string;
};

// ============================================================================
// TO — PAYLOADS
// ============================================================================

/** Strict types: `1 != true`, `true != "true"`. Unset variables read as 0. (6.3, 6.4) */
export type VariableValue = number | boolean | string;

/**
 * `to.set_variable`.
 *
 * Version floors: `value` 11.0.0; boolean/string values 14.4.20; `key_up_value`
 * 14.12.6; `type: "unset"` 14.99.2; `expression` / `key_up_expression`
 * 15.5.19. (6.5) `value` may be omitted when one of the others is set. (6.6)
 */
export type ToVariable = {
  name: string;
  value?: VariableValue;
  /** exprtk arithmetic; may read `system.*`. (6.7) */
  expression?: string;
  key_up_value?: VariableValue;
  key_up_expression?: string;
  type?: "set" | "unset";
} & (
  | { value: VariableValue }
  | { expression: string }
  | { key_up_value: VariableValue }
  | { key_up_expression: string }
  | { type: "unset" }
);

/**
 * `to.mouse_key`. Speeds and directions follow System Settings > Mouse, and the
 * sign conventions differ per axis. (6.10)
 */
export type ToMouseKey = AtLeastOne<{
  /** Negative left, positive right. */
  x?: number;
  /** Negative up, positive down. */
  y?: number;
  /** Negative scrolls up, positive scrolls down. */
  vertical_wheel?: number;
  /** Positive scrolls **left**, negative scrolls right. */
  horizontal_wheel?: number;
  speed_multiplier?: number;
}>;

export type StickyModifierName = Extract<
  Modifier,
  | "left_control"
  | "left_shift"
  | "left_option"
  | "left_command"
  | "right_control"
  | "right_shift"
  | "right_option"
  | "right_command"
  | "fn"
>;

/**
 * `to.sticky_modifier`. Exactly one modifier per entry — repeat the `to` entry
 * for more. `toggle` suits most cases. Booleans are not accepted. (6.9)
 */
export type ToStickyModifier = ExactlyOne<Record<StickyModifierName, "on" | "off" | "toggle">>;

/**
 * Every field is a regular expression; keys within one object are ANDed. Input
 * sources carrying an `input_mode_id` (CJKV) may fail to switch — send the OS
 * shortcut instead. (6.2, 8.1)
 */
export type InputSourceSpecifier = AtLeastOne<{
  /** Language regex, e.g. `"^en$"`. */
  language?: string;
  /** Input source id regex, e.g. `"^com\\.apple\\.keylayout\\.US$"`. */
  input_source_id?: string;
  /** Input mode id regex. */
  input_mode_id?: string;
}>;

/**
 * `software_function.open_application`.
 *
 * When several targets are given the highest priority wins and the rest are
 * **silently ignored**, so exactly one is enforced here. (6.13)
 */
export type SoftwareFunctionOpenApplication = ExactlyOne<{
  /** Priority 1 (KE 15.0.19+). */
  bundle_identifier: string;
  /** Priority 2 (KE 15.0.19+). */
  file_path: string;
  /**
   * Priority 3 (KE 15.3.6+), 1-based. Only apps still running that were
   * launched after Karabiner-Elements started are candidates. (6.14)
   */
  frontmost_application_history_index: number;
}> & {
  /** Regexes; KE 15.7.3+. (6.14) */
  frontmost_application_history_exclusion_bundle_identifiers?: string[];
  /** Regexes; KE 15.7.3+. (6.14) */
  frontmost_application_history_exclusion_file_paths?: string[];
};

/**
 * `to.software_function` — implemented in software rather than by emitting HID
 * events. KE 13.5.1+, exactly one function per `to` entry. (5.2)
 */
export type ToSoftwareFunction = ExactlyOne<{
  /**
   * Software-generated, laggy, and needs Accessibility permission for
   * `karabiner_console_user_server` — sending `pointing_button: button1` twice
   * is better. (6.11) Following a mandatory modifier, prepend
   * `{ key_code: "vk_none", hold_down_milliseconds: 100 }`. (6.12)
   */
  cg_event_double_click: {
    /** CGMouseButton: 0 left, 1 right, 2 middle, 3+ other. */
    button: number;
  };
  /** KE 13.7.1+; `delay_milliseconds` defaults to 500. (6.15) */
  iokit_power_management_sleep_system: { delay_milliseconds?: number };
  open_application: SoftwareFunctionOpenApplication;
  set_mouse_cursor_position: {
    /** Points (`100`) or percent (`"50%"`). (6.16) */
    x: number | string;
    /** Points (`100`) or percent (`"50%"`). (6.16) */
    y: number | string;
    /** Screen index for the position origin. */
    screen?: number;
    /** Source-only, not yet in the published docs. (6.17) */
    relative_to?: "screen" | "focused_window";
    /** Source-only; used when the `relative_to` target is unavailable. (6.17) */
    fallback_to?: "none" | "screen";
  };
}>;

/**
 * `to.send_user_command` — datagram to a user-provided UNIX socket server.
 * Lower latency than `shell_command` because no process is spawned. (6.18)
 */
export type ToSendUserCommand = {
  /** Arbitrary JSON payload, serialized for the receiver. */
  payload: unknown;
  /**
   * Socket path. Defaults to
   * `/Library/Application Support/org.pqrs/tmp/user/{UID}/user_command_receiver.sock`.
   */
  endpoint?: string;
};

/**
 * `to.set_notification_message`. Clear it by setting `text` to `""` with the
 * same `id`, or it stays on screen indefinitely. (6.8)
 */
export type ToSetNotificationMessage = {
  /** Unique id; reuse it to update or clear the message. */
  id: string;
  /** An empty string removes the message. */
  text: string;
  /** KE 16.1.18+ — the only auto-dismiss. (6.8) */
  duration_milliseconds?: number;
};

// ============================================================================
// TO — EVENT
// ============================================================================

export type ToEventOptions = {
  modifiers?: ToModifier[];
  /** Suppresses the modifier's events until another key is pressed with it. (5.4) */
  lazy?: boolean;
  /**
   * Defaults to **true**, and also changes timing: `false` sends key_down and
   * key_up both at press time. Set it on the *last* event of a typing sequence
   * to avoid "hellooooooo". (5.5)
   */
  repeat?: boolean;
  /**
   * In `to_if_alone` / `to_if_held_down`: cancels the subsequent
   * `to_after_key_up` and `to_delayed_action`. (5.6)
   */
  halt?: boolean;
  /**
   * Gap between key_down and key_up when both are sent at once; `caps_lock`
   * needs roughly 200, and pairs with a `vk_none` event. (5.7, 5.8)
   */
  hold_down_milliseconds?: number;
  /**
   * Undocumented parser alias of `hold_down_milliseconds`. (5.12)
   * Present so imported JSON typechecks — do not emit it.
   */
  held_down_milliseconds?: number;
  /**
   * Gate this single event on a condition (KE 15.3.7+). Narrow cases only; for
   * "enable only in Finder" use manipulator-level `conditions`. (5.9)
   *
   * Distinct from the manipulator's own `conditions`: those decide whether the
   * manipulator matches at all, at key-down. These are evaluated **once, before
   * the first event of the surrounding channel is processed**, so a
   * `set_variable` earlier in the same array is not visible here. (5.10)
   */
  conditions?: Condition[];
};

type ToEventActions = EventKeyMap & {
  /**
   * Re-sends the `from` event verbatim. Combined with `from.any` this is
   * pass-through mode: once modified, an event is exempt from every later
   * rule — though not from Simple Modifications. (2.3, 2.4)
   */
  from_event: boolean;
  /**
   * Runs with a very limited environment (`$HOME`, `$UID`, `$USER`, ...).
   * Export `LC_ALL` inside the command string when locale matters. (6.1)
   */
  shell_command: string;
  send_user_command: ToSendUserCommand;
  select_input_source: InputSourceSpecifier | InputSourceSpecifier[];
  set_variable: ToVariable;
  set_notification_message: ToSetNotificationMessage;
  mouse_key: ToMouseKey;
  sticky_modifier: ToStickyModifier;
  software_function: ToSoftwareFunction;
};

/**
 * One entry of `to`, `to_if_alone`, `to_if_held_down`, `to_after_key_up`, or
 * `to_delayed_action.*`.
 *
 * Exactly one action per entry — the listed keys are mutually exclusive, and an
 * entry with none of them parses but does nothing. (5.1)
 */
export type ToEvent = ExactlyOne<ToEventActions> &
  ToEventOptions & {
    /** Accepted inside event definitions, not only at manipulator level. (4.12) */
    description?: string;
  };

/**
 * Fires `basic.to_delayed_action_delay_milliseconds` (default 500) after `from`
 * is pressed. The mechanism behind double-tap and two-stroke bindings. (7.8)
 */
export type ToDelayedAction = AtLeastOne<{
  /** Sent when nothing else was pressed before the delay elapsed. */
  to_if_invoked?: ToEvent[];
  /** Sent when another key intervened. */
  to_if_canceled?: ToEvent[];
}>;

/**
 * One entry of `to_if_other_key_pressed`. Rewrites the held `from` key itself
 * when one of `other_keys` is pressed — the correct fix for the
 * `option+tab -> command+tab` trap. (7.7)
 *
 * The one exception to the single-object shorthand: both fields must be
 * arrays, and the entry rejects a `description` key. (5.13)
 */
export type ToIfOtherKeyPressedEntry = {
  /** `minItems: 1`, enforced by the schema at validate time. */
  other_keys: FromKeyType[];
  to: ToEvent[];
};

// ============================================================================
// CONDITIONS
// ============================================================================

/**
 * `bundle_identifiers` and `file_paths` are **regexes**, ORed — dots must be
 * escaped, which in JSON means a double backslash. At least one of the two
 * arrays is required. (8.1, 8.2)
 */
export type FrontmostApplicationCondition = {
  type: "frontmost_application_if" | "frontmost_application_unless";
  description?: string;
} & AtLeastOne<{ bundle_identifiers?: string[]; file_paths?: string[] }>;

/** Keys inside one entry are ANDed; entries across the array are ORed. (8.1) */
export type DeviceIdentifier = AtLeastOne<{
  /** Decimal, from EventViewer > Devices. */
  vendor_id?: number;
  product_id?: number;
  /** Changes when the device moves USB port — unstable as an identifier. (8.3) */
  location_id?: number;
  /** Bluetooth MAC (KE 14.12.2+); changes when the hardware is replaced. (8.4) */
  device_address?: string;
  is_keyboard?: boolean;
  is_pointing_device?: boolean;
  /** KE 14.12.4+. (8.5) */
  is_game_pad?: boolean;
  /** KE 15.3.18+. (8.5) */
  is_consumer?: boolean;
  is_touch_bar?: boolean;
  /** KE 14.8.2+. (8.5) */
  is_built_in_keyboard?: boolean;
  /** Undocumented; accepted by the `device_identifiers` parser. (8.8) */
  is_virtual_device?: boolean;
  description?: string;
}>;

export type DeviceCondition = {
  /** `device_exists_*` (KE 14.8.4+) test connection, not event origin. (8.5) */
  type: "device_if" | "device_unless" | "device_exists_if" | "device_exists_unless";
  /** `minItems: 1`, enforced by the schema at validate time. */
  identifiers: DeviceIdentifier[];
  description?: string;
};

/**
 * Refers to the **virtual** keyboard type configured in Karabiner, not the
 * physical device. Note that `[` is `close_bracket` on JIS. (8.6)
 */
export type KeyboardType = "ansi" | "iso" | "jis";

export type KeyboardTypeCondition = {
  type: "keyboard_type_if" | "keyboard_type_unless";
  /** `minItems: 1`, enforced by the schema at validate time. */
  keyboard_types: KeyboardType[];
  description?: string;
};

export type InputSourceCondition = {
  type: "input_source_if" | "input_source_unless";
  /** `minItems: 1`, enforced by the schema at validate time. */
  input_sources: InputSourceSpecifier[];
  description?: string;
};

export type VariableCondition = {
  type: "variable_if" | "variable_unless";
  name: string;
  value: VariableValue;
  description?: string;
};

/**
 * exprtk syntax. Undefined variables evaluate as 0; `system.*` and
 * `accessibility.*` variables are available, each with its own version
 * floor. (6.4, 6.7, 8.7)
 */
export type ExpressionCondition = {
  type: "expression_if" | "expression_unless";
  expression: string;
  description?: string;
};

/**
 * Skips the rule for keys that were already changed by Simple Modifications.
 * `event_changed_unless` exists mainly to stop Function Keys Modifications from
 * re-changing fx keys already changed in Complex Modifications. (2.5)
 */
export type EventChangedCondition = {
  type: "event_changed_if" | "event_changed_unless";
  value: boolean;
  description?: string;
};

export type Condition =
  | FrontmostApplicationCondition
  | DeviceCondition
  | KeyboardTypeCondition
  | InputSourceCondition
  | VariableCondition
  | ExpressionCondition
  | EventChangedCondition;

// ============================================================================
// PARAMETERS
// ============================================================================

/**
 * Settable at profile `complex_modifications` level and overridden per
 * manipulator. (9.1)
 *
 * Out-of-range values are **clamped with a log warning**, not rejected, and
 * unrecognized names are silently ignored — which is how the published
 * `vim_mode_plus` rule has shipped `basic.to_if_alone_threshold_milliseconds`
 * (not a real parameter) without anyone noticing. (9.2, 9.3)
 */
export type KarabinerParameters = {
  /** Default 50, clamped to 0..1000. */
  "basic.simultaneous_threshold_milliseconds"?: number;
  /** Default 1000, >= 0. Holding longer than this cancels `to_if_alone`. (7.2) */
  "basic.to_if_alone_timeout_milliseconds"?: number;
  /** Default 500, >= 0. */
  "basic.to_if_held_down_threshold_milliseconds"?: number;
  /** Default 500, >= 0. */
  "basic.to_delayed_action_delay_milliseconds"?: number;
  /** Percent; default 100, clamped to 1..10000, divided by 100 at runtime. */
  "mouse_motion_to_scroll.speed"?: number;
};

/** @deprecated Use {@link KarabinerParameters}. */
export type BasicParameters = KarabinerParameters;

/** @deprecated Use {@link KarabinerParameters}. */
export type ComplexModificationsParameters = KarabinerParameters;

// ============================================================================
// MANIPULATORS
// ============================================================================

export type BasicManipulator = {
  type: "basic";
  from: FromEvent;
  /** Events sent while `from` is pressed. */
  to?: ToEvent[];
  /**
   * Fires on **release**, and is cancelled by any other key, button, or scroll
   * event while `from` is held, or by holding past
   * `basic.to_if_alone_timeout_milliseconds`. key_down and key_up post
   * together, so key repeat is impossible here and `caps_lock` needs
   * `hold_down_milliseconds`. (7.1–7.4)
   */
  to_if_alone?: ToEvent[];
  /**
   * Fires after `basic.to_if_held_down_threshold_milliseconds`, inherently
   * *after* keys pressed subsequently — so events can arrive out of typing
   * order. For hold-to-modify on letter keys, combine `to_if_alone` + `halt`
   * with `to_delayed_action.to_if_canceled`. (7.5, 7.6)
   */
  to_if_held_down?: ToEvent[];
  to_if_other_key_pressed?: ToIfOtherKeyPressedEntry[];
  /**
   * Fires on release — where variables get unset, and the fallback branch
   * alongside `to_if_held_down` + `halt`. (7.9)
   */
  to_after_key_up?: ToEvent[];
  to_delayed_action?: ToDelayedAction;
  parameters?: KarabinerParameters;
  conditions?: Condition[];
  /** Human-readable comment for this manipulator. */
  description?: string;
};

/**
 * Invert, swap, or discard mouse movement. Requires the mouse to be enabled in
 * the Devices tab.
 */
export type MouseBasicManipulator = {
  type: "mouse_basic";
  flip?: ("x" | "y" | "vertical_wheel" | "horizontal_wheel")[];
  swap?: ("xy" | "wheels")[];
  /**
   * DANGER: always pair `discard` with a scoping condition (e.g. `device_if`),
   * or the cursor can become completely unmovable. (1.2)
   */
  discard?: ("x" | "y" | "vertical_wheel" | "horizontal_wheel")[];
  conditions?: Condition[];
  description?: string;
};

/**
 * Converts pointer motion into scrolling.
 *
 * DANGER: without `from.modifiers` **and** without `conditions`, all pointer
 * motion becomes scrolling permanently and the mouse is unusable — so at least
 * one of the two is required here. (1.3)
 */
export type MouseMotionToScrollManipulator = {
  type: "mouse_motion_to_scroll";
  options?: {
    /** Default true. */
    momentum_scroll_enabled?: boolean;
    /** Default 1.0. */
    speed_multiplier?: number;
  };
  description?: string;
} & AtLeastOne<{ from?: { modifiers?: FromModifiers }; conditions?: Condition[] }>;

/** @deprecated Renamed for symmetry with the other manipulator types. */
export type MouseMotionManipulator = MouseMotionToScrollManipulator;

/**
 * Manipulators are evaluated top to bottom; the **first** matching one applies
 * and every later manipulator touching the same key is ignored. (2.1)
 *
 * Unknown keys are ignored at file and rule level, but inside `manipulators`
 * they are hard errors. (10.5)
 */
export type Manipulator =
  | BasicManipulator
  | MouseBasicManipulator
  | MouseMotionToScrollManipulator;

// ============================================================================
// FILE STRUCTURE
// ============================================================================

export type Rule = {
  /** Shown in Settings; keep it unique and human-readable. */
  description?: string;
  manipulators: Manipulator[];
  available_since?: string;
  /** Ignored by the parser; used by some third-party generators. (10.5) */
  enabled?: boolean;
};

export type ComplexModifications = {
  parameters?: KarabinerParameters;
  rules: Rule[];
};

/**
 * A standalone file under `~/.config/karabiner/assets/complex_modifications/`,
 * which is what makes rules individually enableable in the UI. Both fields are
 * required. (10.2)
 */
export type ComplexModificationsFile = {
  title: string;
  rules: Rule[];
};

export type Profile = {
  name: string;
  selected?: boolean;
  complex_modifications?: ComplexModifications;
  [key: string]: unknown;
};

/**
 * `karabiner.json`. Tolerates line and block comments, but every comment is
 * lost once the Settings UI or menu writes the file. (10.1)
 */
export type KarabinerConfig = {
  profiles: Profile[];
  [key: string]: unknown;
};
