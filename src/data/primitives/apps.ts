import type { BaseSpec } from "./base";

/**
 * Registry specification for macOS application bundles.
 * Used for application targeting in condition blocks (`ifApp`/`unlessApp`) and launch actions (`app`).
 *
 * @example
 * ```ts
 * const finder: AppSpec = {
 *   type: "app",
 *   bundleId: "com.apple.finder",
 *   refDesc: "Finder",
 * };
 * ```
 */
export interface AppSpec extends BaseSpec {
  /** Discriminator identifying this primitive as an application specification. */
  type: "app";

  /**
   * macOS App Bundle Identifier(s), e.g., `"com.apple.finder"`.
   * Can be a single bundle ID or an array of bundle IDs for multi-app matching.
   *
   * @example "com.microsoft.VSCode"
   * @example ["com.apple.Safari", "app.zen-browser.zen"]
   */
  bundleId?: string | string[];

  /**
   * Optional file path(s) to application binary or bundle folder.
   *
   * @example "/Applications/Visual Studio Code.app"
   */
  path?: string | string[];
}
