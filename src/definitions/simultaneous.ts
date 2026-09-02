import { CMDS } from "../data";
import { bind, key, press, simultaneous, tap, to, type Binding } from "../engine";

export const simultaneousBindings: Binding[] = [
  // Examples:
  // bind(simultaneous("j", "k"), to(press(key("escape")))),
  // bind(chord("s", "w"), to(hold(url("cleanshot://capture-window?action=copy&pin")))),
  bind(simultaneous("left_option", "right_option"), to(press(key("slash", ["right_control"])))),
  bind(simultaneous("q", "r"), to(tap(CMDS.recentAdditions))),
];
