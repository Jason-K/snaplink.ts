import type { BaseSpec } from "./base";

/**
 * Registry specification for local filesystem paths.
 * Represents file paths and directory locations used in folder launch actions (`folder`) and shell scripts.
 *
 * @example
 * ```ts
 * const scriptsDir: PathSpec = {
 *   type: "path",
 *   path: "/Users/jason/Scripts",
 *   refDesc: "Scripts directory",
 * };
 * ```
 */
export interface PathSpec extends BaseSpec {
  /** Discriminator identifying this primitive as a path specification. */
  type: "path";

  /**
   * Absolute file or directory path string.
   *
   * @example "/opt/homebrew/bin"
   * @example "/Users/jason/Downloads"
   */
  path: string;
}
