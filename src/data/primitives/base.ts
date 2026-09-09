/**
 * Meta-primitive base interface for all registry entities.
 * Provides shared identification metadata across applications, commands, paths, and hotkey maps.
 *
 * @see {@link AppSpec}
 * @see {@link CommandSpec}
 * @see {@link PathSpec}
 * @see {@link UrlSpec}
 * @see {@link MapSpec}
 * @see {@link ExprSpec}
 */
export interface BaseSpec {
  /**
   * Human-readable description label used in rule descriptions, logs, and generated documentation.
   *
   * @example "Activity Monitor application bundle"
   * @example "Brew auto-updater CLI command"
   */
  refDesc: string;
}
