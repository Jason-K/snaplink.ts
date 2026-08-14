import { VM } from "../data";
import { bind, from, noop, press, to, type Binding } from "../engine";

// Disabled shortcuts swallow the chord entirely (noop = no `to` events).
//
// ⌘D in Antinote is deliberately absent here: `antinoteGuardBinding` in
// guards.ts claims the same trigger under the same condition and is emitted
// first, so a disable entry could never fire. Antinote's ⌘D is guarded
// (double-press to confirm), not disabled.
export const disabledHotkeys: Binding[] = [
  bind(from("h", ["L.cmd"]),
    to(press(noop()))),
  bind(from("h", VM.CO__),
    to(press(noop()))),
  bind(from("m", VM.CO__),
    to(press(noop()))),
];

