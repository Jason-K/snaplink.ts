export const TIMINGS = {
  holdMs: 400,
  aloneMs: 1000,
  delayedMs: 300,
  simultaneousMs: 50,
  delayLeaderHoldMs: 200,
  timeoutDoubleTapMs: 300,
  timeoutWheelChordMs: 200,
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
