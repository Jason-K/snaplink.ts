import { APPS, CMDS, URLS } from "../data";
import { bind, key, press, simultaneous, tap, to, type Binding } from "../engine";

export const simultaneousBindings: Binding[] = [
  // Examples:
  // bind(simultaneous("j", "k"), to(press(key("escape")))),
  // bind(chord("s", "w"), to(hold(url("cleanshot://capture-window?action=copy&pin")))),
  bind(simultaneous("left_option", "right_option"), to(press(key("slash", ["right_control"])))),
  bind(simultaneous("e", "k").uninterrupted().timing(30), to(tap(APPS.keSettings))),
  bind(simultaneous("e", "v").uninterrupted().timing(30), to(tap(APPS.keEvents))),
  bind(simultaneous("q", "r").uninterrupted().timing(30), to(tap(CMDS.recentAdditions))),
  bind(simultaneous("r", "w").uninterrupted().timing(30), to(tap(URLS.rayRecentDocs))),
];
