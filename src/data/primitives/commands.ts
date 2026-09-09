import type { BaseSpec } from "./base";

/**
 * Registry specification for shell command executions.
 * Encapsulates CLI commands invoked via Karabiner `shell_command` or DSL `cmd()` / `shell()` actions.
 *
 * @example
 * ```ts
 * const killApp: CommandSpec = {
 *   type: "command",
 *   command: "killall Finder",
 *   refDesc: "Restart Finder process",
 * };
 * ```
 */
export interface CommandSpec extends BaseSpec {
  /** Discriminator identifying this primitive as a command specification. */
  type: "command";

  /**
   * Raw shell command string to execute in zsh.
   *
   * @example "open -a 'Activity Monitor'"
   * @example "osascript -e 'tell application \"Popclip\" to appear'"
   */
  command: string;
}
