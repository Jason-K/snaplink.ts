// User edit surface: modify files in this directory to customize your Karabiner config.

import type { Binding } from "../engine";
import { modifiedSingleKeyTapHoldBindings } from "./modified-single-key";
import { singleKeyTapHoldBindings } from "./single-key";

export { buildCapsLockBindings, capsVars } from "./caps-lock";
export { disabledHotkeys } from "./disable-hotkeys";
export { antinoteGuardBinding, globalGuardBinding, guardBindings } from "./guards";
export { mouseBindings, pointerTweaks } from "./mouse";

/** All tap-hold bindings. */
export const tapHoldBindings: Binding[] = [
  ...singleKeyTapHoldBindings,
  ...modifiedSingleKeyTapHoldBindings,
];

export { simultaneousBindings, simultaneousMappings } from "./simultaneous";
export { NUMPAD_REMAPS, SWAP_CTRL_FN } from "./simple-modifications";
