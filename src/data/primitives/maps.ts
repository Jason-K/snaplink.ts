import type { BaseSpec } from "./base";
import type { AppSpec } from "./apps";
import type { PathSpec } from "./paths";

/**
 * Representation of a single key press + modifier combination in a hotkey map sequence.
 */
export type Map = {
  /** Target Karabiner key code (e.g., `"f"`, `"spacebar"`, `"return_or_enter"`). */
  key: string;

  /** Array of modifier keys to hold while pressing {@link key}. */
  modifiers: string[];
};

/**
 * Registry specification for hotkey mapping definitions.
 * Defines target key combinations, hotkey sequences, and optional app scoping.
 *
 * @example
 * ```ts
 * const searchMap: MapSpec = {
 *   type: "map",
 *   keyCode: "f",
 *   modifiers: ["command"],
 *   refDesc: "Find in document",
 * };
 * ```
 */
export interface MapSpec extends BaseSpec {
  /** Discriminator identifying this primitive as a map specification. */
  type: "map";

  /**
   * Primary key code to emit (e.g., `"f"`, `"spacebar"`, `"return_or_enter"`).
   * If a sequence of combos is defined, this is the key code of the first combo.
   */
  keyCode: string;

  /** Modifiers to hold while emitting `keyCode`. */
  modifiers: string[];

  /** Optional multi-step combo sequence executed in order. */
  combos?: Map[];

  /**
   * Optional application that "owns" this hotkey.
   * Accepts an {@link AppSpec}, a {@link PathSpec}, or a raw bundle ID / file path string.
   */
  app?: AppSpec | PathSpec | string;

  /** When true, this hotkey mapping is active only while `app` is frontmost. */
  activeAppOnly?: boolean;

  /** Key emission behavior options. */
  options?: {
    /** Enable auto-repeat on hold. */
    repeat?: boolean;
    /** Halt subsequent key sequence on error. */
    halt?: boolean;
    /** Send modifiers lazily. */
    lazy?: boolean;
  };
}
