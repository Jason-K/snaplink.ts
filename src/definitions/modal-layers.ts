/**
 * Modal leader layers — tap or hold one key to enter a mode, then select.
 *
 * Nothing here is active. A modal layer claims a leader key and, while it is
 * up, every other key on the keyboard, so switching one on is a decision about
 * how the machine behaves rather than one more binding. The example below is
 * complete and correct; uncomment it, adjust the mappings, and follow the three
 * wiring steps at the bottom of this file.
 *
 * See `src/engine/modal-layer.ts` for the variable choreography this builds,
 * and why there is no timeout.
 */

import type { Binding } from "../engine";
// import { APPS, PATHS, URLS } from "../data";
// import { folder, modalLayer, type ModalLayer } from "../engine";

/**
 * Example: `spacebar` held opens a navigation layer.
 *
 * ```ts
 * export const navLayer: ModalLayer = modalLayer({
 *   leader: "spacebar",
 *   description: "Navigation layer",
 *
 *   // Held to enter, so a tap still types a space. `enterOn: "tap"` is for a
 *   // leader with nothing else to do.
 *   enterOn: "hold",
 *   timing: { aloneMs: 200, holdMs: 200 },
 *
 *   // Fired straight from the layer, then the layer closes.
 *   mappings: {
 *     q: APPS.qspace,
 *   },
 *
 *   sublayers: {
 *     d: {
 *       description: "Downloads",
 *       mappings: { f: folder(PATHS.downloads) },
 *     },
 *     w: {
 *       description: "Window management",
 *       // Sticky: nudging a window is meant to be repeated, so the layer stays
 *       // up until escape or the leader closes it.
 *       sticky: true,
 *       mappings: {
 *         h: URLS.hsWinLeftTop,
 *         l: URLS.hsWinRightBottom,
 *       },
 *     },
 *   },
 * });
 * ```
 *
 * ## Wiring it up
 *
 * A modal layer is not one more entry in `BINDING_SETS` — it has to be planned
 * ahead of the plain rules, and everything else has to be told to stay quiet
 * while it is up. Three edits in `src/config.ts`:
 *
 * ```ts
 * // 1. Its own set, planned first — a layer mapping for `f` carries no
 * //    mandatory modifiers, so trigger order alone would sort it level with
 * //    the plain `f` rule and the plain rule would consume the key.
 * export const MODAL_LAYER_SET = { name: "nav-layer", bindings: navLayer.bindings };
 *
 * // 2. Everything else gated on the layer being down.
 * export const BINDING_SETS = [
 *   { name: "tap-hold", bindings: navLayer.suppress(tapHoldBindings) },
 *   …
 * ];
 *
 * // 3. The layer ahead of the rest, alongside the caps layer.
 * export function rulePlan(): RulePlan[] {
 *   return [
 *     ...planRules([CAPS_LAYER_SET]),
 *     ...planRules([MODAL_LAYER_SET]),
 *     ...planRules(BINDING_SETS),
 *   ];
 * }
 * ```
 *
 * Then `npm run explain -- spacebar` to see the layer in evaluation order, and
 * `npm run explain -- --lint` to confirm nothing is wired to a variable that is
 * never set.
 */
export const modalLayerBindings: Binding[] = [];
