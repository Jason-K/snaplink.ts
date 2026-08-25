export const TIMINGS = {
  holdMs: 400,
  aloneMs: 1000,
  delayedMs: 300,
  simultaneousMs: 50,
  delayLeaderHoldMs: 200,
  timeoutDoubleTapMs: 300,
  timeoutWheelChordMs: 300,
  privilegesPostElevationDelayMs: 1000,
  privDelaySec: 0.2,
} as const;

export const KB_TIMINGS = {
  aloneMs: 1000,
  holdMs: 400,
  delayedMs: 300,
} as const;

export const MOUSE_TIMINGS = {
  aloneMs: 1000,
  holdMs: 400,
  delayedMs: 300,
} as const;

export const DEFAULT_TIMINGS = {
  "basic.simultaneous_threshold_milliseconds": 50,
  "basic.to_if_alone_timeout_milliseconds": 1000,
  "basic.to_if_held_down_threshold_milliseconds": 400,
  "basic.to_delayed_action_delay_milliseconds": 300,
  "mouse_motion_to_scroll.speed": 100,
} as const;

/**
 * Named timing profiles — a *feel*, not four numbers.
 *
 * Every threshold Karabiner exposes is independent, and nothing warns when a
 * combination is incoherent. Two combinations are wrong in ways that are
 * invisible in the emitted JSON:
 *
 * - **Dead zone** — `holdMs > aloneMs`. `to_if_alone` is cancelled by holding
 *   past `basic.to_if_alone_timeout_milliseconds` (gotcha 7.2), and
 *   `to_if_held_down` has not fired yet, so a release anywhere between the two
 *   thresholds emits *nothing*. Setting only `aloneMs` and inheriting the
 *   default `holdMs` (400) is the usual way in: `timing({ aloneMs: 150 })`
 *   buys a 250 ms window where the key is dead.
 * - **Double-fire zone** — `holdMs < aloneMs`. A release between the two can
 *   run the hold action *and* the tap action from the same press.
 *
 * Upstream's own tap-hold examples set the two equal
 * (`docs/karabiner_docs/.../to-if-held-down/_index.md`), which is the only
 * setting with neither hazard. Every profile below does the same, so a caller
 * who picks a profile cannot land in either zone.
 *
 * `delayedMs` is the double-tap / delayed-single-tap window
 * (`basic.to_delayed_action_delay_milliseconds`) and is deliberately *not*
 * tied to the tap threshold: it is how long a second tap may take to arrive,
 * which is a property of the hand, not of the gesture. It stays in the
 * 200–450 ms band where re-tapping is comfortable.
 *
 * `simultaneousMs` is deliberately absent. A profile describes how one key's
 * press is arbitrated between tap and hold; the chord window is a property of
 * *how many keys*, orthogonal to that, and applying it to a single-key trigger
 * would emit a parameter Karabiner never reads. Set it per chord when 50 ms is
 * not enough.
 */
export const TIMING_PROFILES = {
  /**
   * As fast as a gesture can be arbitrated. For a trigger that is never typed
   * in prose — a mouse button, a function key, a keypad key — where a
   * perceptible pause before the tap action is the only thing you would notice.
   */
  instant: { aloneMs: 120, holdMs: 120, delayedMs: 200 },

  /**
   * The default for letter and symbol keys that keep their normal meaning on
   * tap. Short enough that typing does not feel gated, long enough that a
   * deliberate hold is unambiguous.
   */
  snappy: { aloneMs: 200, holdMs: 200, delayedMs: 250 },

  /**
   * Karabiner-ish middle ground. Use when the hold action is disruptive enough
   * that a stray one is worse than a slightly late tap.
   */
  balanced: { aloneMs: 300, holdMs: 300, delayedMs: 300 },

  /**
   * For holds that launch or switch something. The longer threshold is the
   * confirmation.
   */
  relaxed: { aloneMs: 500, holdMs: 500, delayedMs: 350 },

  /**
   * For destructive or irreversible holds — the hold has to be meant. Pair
   * with `guard()` when even this is not enough.
   */
  deliberate: { aloneMs: 800, holdMs: 800, delayedMs: 450 },
} as const;

/** Name of a {@link TIMING_PROFILES} entry. */
export type TimingProfileName = keyof typeof TIMING_PROFILES;

/** `true` for a string that names a {@link TIMING_PROFILES} entry. */
export function isTimingProfileName(x: unknown): x is TimingProfileName {
  return typeof x === "string" && x in TIMING_PROFILES;
}
