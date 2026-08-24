/**
 * Barrel export for data modules (primitives, registries, and settings).
 */

// PRIMITIVES
export type {
  AppSpec,
  BaseSpec,
  CommandSpec,
  DeviceSpec,
  DeviceDefaults,
  DeviceKey,
  DeviceOverrides,
  KbDefaults,
  KbOverrides,
  MouseDefaults,
  MouseOverrides,
  Map,
  MapSpec,
  PathSpec,
  ProfileSpec,
  SimpleModificationPair,
  UrlSpec,
  VarSpec,
  VarValueSpec,
  Action,
  ActionKeyModifier,
  ActionEventOptions,
  ActionSpec,
  AppHistoryExclude,
  AppHistoryOptions,
  PointerMotionTrigger,
  PointerMotionToScroll,
  PointerTransform,
  PointerTweak,
  AppTarget,
  Binding,
  BindingEventOptions,
  BindingMultiTap,
  BindingOtherKeyPressedEntry,
  BindingRuleGroup,
  BindingTiming,
  Case,
  Condition,
  Phase,
  SimOrder,
  Trigger,
  TriggerModifiers,
  ModAlias,
  FolderOpener,
} from "./primitives";

// SETTINGS
export { DESCRIPTION_SEPARATOR, KEY_SYMBOLS } from "./constants/descriptions";
export { GLOBAL_SETTINGS } from "./constants/global";
export { SHELL_ENV, FINDER_REPLACEMENT, HOME, HOMEBREW_PREFIX, SHARED_VENV, TP_CLI, TMPDIR, USER } from "./constants/env";
export { DEFAULT_PROFILE, PREFERRED_PROFILE } from "./constants/profiles";
export { DEFAULTS, KB_DEFAULTS, MOUSE_DEFAULTS } from "./constants/devices";
export {
  DEFAULT_TIMINGS,
  KB_TIMINGS,
  MOUSE_TIMINGS,
  TIMINGS,
} from "./constants/timings";
export {
  VM,
  MODKEY_CODES,
  type KeyCode,
  type ModComboAlias,
  type ModKey,
  type StandardKeyCode,
} from "./constants/keys";
export {
  ACCESSIBILITY_ROLES,
  INPUT_SOURCES,
  VAR_STATE,
  type AccessibilityRole,
  type InputSourceId,
} from "./constants/var-states";

// REGISTRIES
export { DEVICES } from "./registries/devices";
export {
  BUTTONS,
  BUTTON_DESCS,
  type ButtonSpec,
  type ButtonAlias,
  type DeviceName,
  type KnownPointerButton,
  type PointerButtonAlias,
  type TriggerKey,
} from "./registries/buttons";
export { VARS } from "./registries/vars";
export { STATES, STATE_GROUPS } from "./registries/var-states";
export { APPS, PW_IDS } from "./registries/apps";
export { CMDS } from "./registries/commands";
export { COMBOS } from "./registries/combos";
export { mapSpec, type ComboOpts, type HkInput } from "./registries/map-builder";
export { PROFILES } from "./registries/profiles";
export { PATHS } from "./registries/paths";
export { URLS } from "./registries/urls";
