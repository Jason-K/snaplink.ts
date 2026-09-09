import type { BaseSpec } from "./base";

/**
 * Registry specification for URLs and custom URI schemes.
 * Used for web browsing and deep-link launcher actions (`url`).
 *
 * @example
 * ```ts
 * const spotifyPlay: UrlSpec = {
 *   type: "url",
 *   url: "raycast://extensions/raycast/spotify-player/play-pause",
 *   category: "raycast",
 *   refDesc: "Toggle Spotify playback via Raycast",
 * };
 * ```
 */
export interface UrlSpec extends BaseSpec {
  /** Discriminator identifying this primitive as a URL specification. */
  type: "url";

  /**
   * The web URL or custom URI scheme string to open.
   *
   * @example "https://github.com"
   * @example "rectangle-pro://execute-action?name=maximize"
   */
  url: string;

  /**
   * Optional integration category or vendor tag.
   *
   * @example "raycast"
   * @example "rectangle"
   * @example "cleanshot"
   */
  category?: string;

  /**
   * Whether `open` leaves the current app focused (`open -g`, background) or
   * activates the target app in the foreground (`open -u`).
   *
   * When this is left unset AND the `url()` call site doesn't override it
   * either, `url()` in `to-action-wrappers.ts` falls back to `true`
   * (background) — the safer default for automation-style URL schemes
   * (Hammerspoon, window managers) that should never steal focus. Registry
   * categories that should keep today's foreground behavior set this to
   * `false` explicitly at the factory level (see `registries/urls.ts`).
   *
   * Full precedence, highest first: an explicit `url()` call-site argument,
   * then this field, then the wrapper's `true` fallback.
   */
  background?: boolean;
}
