import { APPS, CMDS, URLS } from "../data";
import { bind, key, press, simultaneous, to, type Binding } from "../engine";

export const simultaneousBindings: Binding[] = [
  // Examples:
  // bind(simultaneous("j", "k"), to(press(key("escape")))),
  // bind(chord("s", "w"), to(hold(url("cleanshot://capture-window?action=copy&pin")))),
  bind(simultaneous("left_option", "right_option"), to(press(key("slash", ["right_control"])))),
  bind(simultaneous("e", "k", 30).uninterrupted(), to(press(APPS.keSettings))),
  bind(simultaneous("e", "v", 30).uninterrupted(), to(press(APPS.keEvents))),
  bind(simultaneous("q", "r", 30).uninterrupted(), to(press(CMDS.recentAdditions))),
  bind(simultaneous("r", "w", 30).uninterrupted(), to(press(URLS.rayRecentDocs))),
];
