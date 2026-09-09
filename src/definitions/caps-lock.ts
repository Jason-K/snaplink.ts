import type { Binding, VarSpec } from "../data";
import { capsLayer } from "../engine";

// CAPS LOCK — modifier layer.
//
// - Tapped: emits ⌘⌥⌃⇧ + F15 (a Hammerspoon hotkey). "Tapped" means no key was
//   translated through the layer; holding modifiers alongside it does not count.
// - Held: every non-modifier key comes out with ⌘⌥⌃⇧, minus whichever single
//   left-side modifier is held at the moment that key is pressed — that
//   modifier is consumed by the layer and does not reach the app.
//
// Which modifier is held is read when the translated key goes down, not when
// caps goes down, so `caps → shift → a`, `shift → caps → a` and pressing them
// together all produce ⌘⌥⌃ + A.
//
// Bindings written against the combination a layer emits — `⌘⌥⌃⇧+E` and the
// rest — are adopted into the layer rather than shadowed by it, so caps+E runs
// the same action it always did. See `capsLayer()`.

/**
 * Caps-lock state.
 *
 * `pressed` is the layer flag: every layer manipulator is conditioned on it,
 * and other bindings read it to stay out of the layer's way (see the
 * `left_command` / `left_shift` multi-tap rules in `single-key.ts`).
 *
 * `used` distinguishes a tap from a hold that did something. It is armed to 0
 * when caps goes down, set to 1 by any manipulator the layer translates, and
 * read on key-up to decide whether to emit the tap combo.
 */
export const capsVars = {
  pressed: { name: "caps_lock_pressed", varDesc: "Caps lock pressed" },
  used: { name: "caps_lock_used", varDesc: "Caps lock layer used" },
} as const satisfies Record<string, VarSpec>;

/**
 * Build the layer.
 *
 * Takes the rest of the configuration as an argument rather than importing it,
 * both to keep the adoption join explicit at the call site and because
 * `single-key.ts` imports {@link capsVars} from here — reaching back the other
 * way would be a cycle.
 */
export function buildCapsLockBindings(adopt: readonly Binding[]): Binding[] {
  return capsLayer({
    triggerKey: "caps_lock",
    pressedVar: capsVars.pressed,
    usedVar: capsVars.used,
    tapKey: "f15",
    adopt,
  });
}
