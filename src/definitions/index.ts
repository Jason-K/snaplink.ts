// User edit surface: modify files in this directory to customize your Karabiner config.

import type { Binding } from "../engine";
import { singleKeyTapHoldBindings } from "./complex-modifications";

export { buildCapsLockBindings, capsVars } from "./caps-lock";
export { disabledHotkeys } from "./disable-hotkeys";
export { antinoteGuardBinding, globalGuardBinding, guardBindings } from "./guards";
//  export { mouseBindings, pointerTweaks } from "./mouse";

/** All tap-hold bindings. */
export const tapHoldBindings: Binding[] = singleKeyTapHoldBindings;

export { simultaneousBindings } from "./simultaneous";
export { NUMPAD_REMAPS, SWAP_CTRL_FN } from "./simple-modifications";
