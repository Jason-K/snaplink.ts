import { toTrigger } from "../engine/resolve-to-action";
import { APPS, CMDS, COMBOS, DEVICES, TIMINGS, URLS, VARS, VM } from "../data";
import {
  bind,
  condApp,
  from,
  hold,
  key,
  options,
  press,
  release,
  tapAndHold,
  timing,
  to,
  when,
  type Binding,
  button,
  motionToScroll,
} from "../engine";
import type { PointerTweak } from "../data";

/**
 * G502X mouse mappings authored as plain `Binding[]` literals and consumed by
 * `defineBindings` (the same engine as keys). Device-specific button aliases
 * (shift, forward, wheelLeft, wheelRight, middleBack, leftForward, leftBack)
 * auto-scope to the G502X via the `BUTTONS` registry `nameScope`; the global
 * buttons used here (back, wheel, right, left) carry an explicit `device`
 * condition.
 */
export const mouseBindings: Binding[] = [
  // -------------------------------------------------------------
  // SHIFT BUTTON — Mission Control (tap) / Rectangle key (hold);
  // right-button chord → down_arrow
  // -------------------------------------------------------------
  bind(
    from("shift_button"),
    to(
      // override (right button held): immediate down_arrow
      press(COMBOS.showMissionControl).when(VARS.rButtonDown),
      release(key("up_arrow", ["control"])),
      hold(key("left_control", VM._OCS, { lazy: true })),
    ),
  ),
  // -------------------------------------------------------------
  // WHEEL LEFT — Move window left/up (hold) / Change workspace (hold in Zen)
  // -------------------------------------------------------------
  bind(
    from("wheelLeft"),
    to(
      // overrides declared in REVERSE of the bespoke prepend order so the
      // emitted manipulator order matches (groupByConditions keeps declaration
      // order between condition sets that neither implies the other).
      // Zen + right-button + wheel-up → prev workspace
      press(key("left_arrow", VM.C_CS)).when([APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0]]),
      // wheel held down → swallow (the wheel-as-button mapping handles it)
      press([]).when("wheelDown"),
      // base hold — wheel guards on the base only (matches bespoke injection)
      hold(URLS.hsWinLeftTop).when([VARS.wheelDown, false], [VARS.rButtonDown, false]),
    ),
    timing({
      aloneMs: TIMINGS.timeoutWheelChordMs,
      holdMs: TIMINGS.timeoutWheelChordMs,
    }),
  ),
  // -------------------------------------------------------------
  // WHEEL RIGHT — Move window right/down (hold) / Change workspace (hold in Zen)
  // -------------------------------------------------------------
  bind(
    from("wheelRight"),
    to(
      press(key("right_arrow", VM.C_CS)).when([APPS.zen, VARS.rButtonDown, [VARS.wheelDown, 0]]),
      hold(URLS.hsWinRightBottom).when([VARS.wheelDown, false], [VARS.rButtonDown, false]),
    ),
    timing({
      aloneMs: TIMINGS.timeoutWheelChordMs,
      holdMs: TIMINGS.timeoutWheelChordMs,
    }),
  ),
  // -------------------------------------------------------------
  // WHEEL (AS BUTTON) — Fill screen (hold) / Open link in glance (rbutton+wheel in Zen)
  // -------------------------------------------------------------
  bind(
    from("wheel"),
    to(
      press([{ pointing_button: "button1", modifiers: ["option"], repeat: false }]).when(APPS.zen, VARS.rButtonDown),
      release([{ pointing_button: "button3", repeat: false }]),
      hold(URLS.hsWinToggleFill),
    ),
    when(DEVICES.g502X),
    options({
      whileHoldVar: VARS.wheelDown,
    }),
  ),
  // -------------------------------------------------------------
  // G7 (left_back) — Fill screen (tap) / Move window to next display (hold)
  // -------------------------------------------------------------
  bind(from("leftBack"), to(tapAndHold(URLS.hsWinToggleFill, URLS.rectDisplayNext))),
  // -------------------------------------------------------------
  // G8 (left_forward) — Activate Popclip (tap) / Activate Sidenote (hold)
  // -------------------------------------------------------------
  bind(from("leftForward"), to(tapAndHold(CMDS.showPopclip, COMBOS.showSidenotes))),
  // -------------------------------------------------------------
  // G9 (middle_back) — Screenshot to text (tap) / markdown (hold)
  // -------------------------------------------------------------
  bind(
    from("middleBack"),
    to(
      release([URLS.csxOcrNoLinebreaks]).when([VARS.lButtonDown, false]),
      release([URLS.csxOcr]).when(VARS.lButtonDown),
      hold([CMDS.ocrToMd]),
    ),
  ),
  // -------------------------------------------------------------
  // BACK — Back (tap) / Window switch (hold); Browsers+rbutton → next tab
  // -------------------------------------------------------------
  bind(
    from("back"),
    to(
      press(key("close_bracket", VM.C__S, { repeat: true })).when(APPS.zen, VARS.rButtonDown),
      press(key("tab", ["L.ctrl"], { repeat: true })).when(APPS.brave, VARS.rButtonDown),
      release(button("button4", { repeat: false })),
      hold(key("tab", ["L.cmd"])),
    ),
    when(DEVICES.g502X),
    options({
      eventOptions: { halt: true, repeat: false },
    }),
  ),
  // -------------------------------------------------------------
  // FORWARD — Show windows of active app (hold) / Cycle tabs (rbutton+forward in Browsers)
  // -------------------------------------------------------------
  bind(
    from("forward"),
    to(
      press(key("open_bracket", VM.C__S, { repeat: true })).when(APPS.zen, VARS.rButtonDown),
      press(key("tab", VM.__CS, { repeat: true })).when(APPS.brave, VARS.rButtonDown),
      release(button("button5", { repeat: false })),
      hold(key("down_arrow", ["control"], { repeat: false })),
    ),
    options({
      eventOptions: { halt: true, repeat: false },
    }),
  ),
  // -------------------------------------------------------------
  // RIGHT — Right click (tap) / Browser chord modifier (hold).
  // whileHoldVar signals right_button_pressed; suppressCancelFallback drops
  // the stray click on a canceled hold (halt on to_if_held_down can't be used
  // here — it would also cancel the to_after_key_up that clears the var).
  // -------------------------------------------------------------
  bind(
    from("button2"),
    to(tapAndHold(button("button2", { repeat: false }), [])),
    when(DEVICES.g502X),
    options({
      whileHoldVar: VARS.rButtonDown,
      suppressCancelFallback: true,
    }),
  ),
  // -------------------------------------------------------------
  // LEFT BUTTON (right-button held) — single action by app (tap) / double tap
  // → next display. Browser vs non-browser split into condition-groups; the single tap
  // is DELAYED (fires via to_if_invoked after the timer) so a true double-tap
  // can still win. firstTapPendingVar is shared across both groups.
  // -------------------------------------------------------------
  bind(
    from("button1"),
    to(
      // Zen — tap = cmd+click (delayed), hold = option+click, double = next display
      release(button("button1", ["left_command"], { repeat: false }))
        .when(APPS.zen)
        .withDelayed(),
      hold(button("button1", ["option"], { repeat: false })).when(APPS.zen),
      release(URLS.rectDisplayNext).when(APPS.zen).withTapCount(2),
      // Non-Zen — tap = maximize (delayed), double = next display
      release(URLS.hsWinToggleFill).when(condApp(APPS.zen, false)).withDelayed(),
      release(URLS.rectDisplayNext).when(condApp(APPS.zen, false)).withTapCount(2),
    ),
    when(DEVICES.g502X, VARS.rButtonDown),
    options({
      multiTap: { firstTapPendingVar: VARS.lButtonTapCount },
    }),
  ),
  // -------------------------------------------------------------
  // LEFT BUTTON (right-button NOT held) — Left click (tap) / chord modifier (hold)
  // -------------------------------------------------------------
  bind(
    from("left"),
    to(release(key("return_or_enter")).when(APPS.onePiece, [APPS.onePiecePrefs, false]), hold([toTrigger()])),
    when(DEVICES.g502X, [VARS.rButtonDown, false]),
    options({
      whileHoldVar: VARS.lButtonDown,
      timing: { holdMs: 0 },
    }),
  ),
];

/**
 * Pointer tweaks — the two Karabiner manipulator types that are not `basic`.
 *
 * These carry no `from` key and no `to` events, so they are not `Binding`s and
 * do not pass through the resolve pipeline. `src/config.ts` collects them into
 * `POINTER_TWEAKS` and emits them directly.
 *
 * Anything added here is live the moment it is built, and both manipulator
 * types can leave a machine undriveable if mis-scoped (gotchas 1.2, 1.3). Keep
 * every entry scoped, and test with the built-in trackpad available.
 */
export const pointerTweaks: PointerTweak[] = [
  motionToScroll({
    description: "Hold right click and move the pointer to scroll",
    when: VARS.rButtonDown,
    speedMultiplier: 0.5,
  }),
];
