import assert from "node:assert/strict";
import test from "node:test";
import { APPS, URLS } from "../data";
import {
  bind,
  bindKeys,
  cmd,
  condApp,
  condNotApp,
  condNotVar,
  condVar,
  copy,
  cut,
  doubleTap,
  map,
  guard,
  from,
  hold,
  key,
  noop,
  app,
  url,
  paste,
  press,
  python,
  release,
  sequence,
  setVar,
  shell,
  triggerKeys,
  triggerPointer,
  to,
  when,
  options,
  timing,
  defineBindings,
} from "../engine";

test("to(), when(), options(), and timing() DSL helpers construct flexible bindings", () => {
  const condSkim = condApp(APPS.skim);
  const condExcel = condApp(APPS.excel);

  // 1. Single to() with when()
  const b1 = bind(
    from("h", ["left_command"]),
    to(press(map({ type: "map", keyCode: "test", modifiers: [], refDesc: "test" }))),
    when(condSkim),
  );

  assert.deepEqual(b1.trigger, { keys: ["h"], modifiers: ["left_command"] });
  assert.equal(b1.cases.length, 1);
  assert.deepEqual(b1.conditions, [condSkim]);

  // 2. Multi-case to() without array brackets + timing() helper
  const b2 = bind(
    from("left_arrow", ["COCS"]),
    to(
      release(shell("cmd1")),
      hold(url("https://example.com", true)),
    ),
    timing({ aloneMs: 250, heldThresholdMs: 300 }),
  );

  assert.equal(b2.cases.length, 2);
  assert.equal(b2.cases[0]?.phase, "release");
  assert.equal(b2.cases[1]?.phase, "hold");
  assert.deepEqual(b2.timing, { aloneMs: 250, heldThresholdMs: 300 });

  // 3. options() and when() combined in flexible order
  const b3 = bind(
    from("right"),
    to(
      release(noop()),
      hold(noop()),
    ),
    when(condExcel),
    options({
      suppressCancelFallback: true,
      timing: { aloneMs: 150 },
    }),
  );

  assert.deepEqual(b3.conditions, [condExcel]);
  assert.equal(b3.suppressCancelFallback, true);
  assert.deepEqual(b3.timing, { aloneMs: 150 });
});

test("phase helpers produce expected Case objects", () => {
  const p = press({ type: "noop" });
  assert.equal(p.phase, "press");
  assert.deepEqual(p.do, [{ type: "noop" }]);

  const h = hold(app(APPS.ringCentral));
  assert.equal(h.phase, "hold");
  assert.deepEqual(h.do, [{ type: "app", ref: APPS.ringCentral }]);

  const r = release(url(URLS.winMaximize, true));
  assert.equal(r.phase, "release");
  assert.deepEqual(r.do, [{ type: "url", url: URLS.winMaximize, background: true }]);

  const dt = doubleTap({ type: "noop" });
  assert.equal(dt.phase, "press");
  assert.equal(dt.tapCount, 2);
});

test("fluent chaining methods on CaseBuilder", () => {
  const caseObj = hold(app(APPS.ringCentral))
    .when(condVar({ name: "flag", varDesc: "flag" }, 1))
    .withDelayed()
    .withSuppress()
    .describe("custom case desc");

  assert.equal(caseObj.phase, "hold");
  assert.deepEqual(caseObj.do, [{ type: "app", ref: APPS.ringCentral }]);
  assert.deepEqual(caseObj.conditions, [{ var: { name: "flag", varDesc: "flag" }, equals: 1 }]);
  assert.equal(caseObj.delayed, true);
  assert.equal(caseObj.suppress, true);
  assert.equal(caseObj.description, "custom case desc");
});

test("ActionSpec wrappers create expected typed actions", () => {
  assert.deepEqual(app(APPS.ringCentral), {
    type: "app",
    ref: APPS.ringCentral,
  });

  assert.deepEqual(url(URLS.winMaximize, true), {
    type: "url",
    url: URLS.winMaximize,
    background: true,
  });

  assert.deepEqual(key("f18", ["COC_"]), {
    type: "key",
    key: "f18",
    modifiers: ["COC_"],
    options: { repeat: false },
  });

  assert.deepEqual(map({ type: "map", keyCode: "test", modifiers: [], refDesc: "test" }), {
    type: "map",
    ref: { type: "map", keyCode: "test", modifiers: [], refDesc: "test" },
    options: { repeat: false },
  });

  assert.deepEqual(cmd({ type: "command", command: "test", refDesc: "test" }), {
    type: "command",
    ref: { type: "command", command: "test", refDesc: "test" },
  });

  assert.deepEqual(shell("echo 1"), {
    type: "shell",
    command: "echo 1",
  });

  assert.deepEqual(python("/path/to/script.py", ["arg1"]), {
    type: "python",
    scriptPath: "/path/to/script.py",
    args: ["arg1"],
  });

  assert.deepEqual(noop(), { type: "noop" });
  assert.deepEqual(cut(), { type: "cut" });
  assert.deepEqual(copy(), { type: "copy" });
  assert.deepEqual(paste(), { type: "paste" });

  assert.deepEqual(setVar({ name: "myVar", varDesc: "myVar" }, 1), {
    type: "setVar",
    var: { name: "myVar", varDesc: "myVar" },
    value: 1,
  });

  assert.deepEqual(sequence(cut(), paste()), {
    type: "sequence",
    actions: [{ type: "cut" }, { type: "paste" }],
  });
});

test("Condition wrappers create expected condition objects", () => {
  assert.deepEqual(condVar({ name: "myVar", varDesc: "myVar" }, 1), {
    var: { name: "myVar", varDesc: "myVar" },
    equals: 1,
  });

  assert.deepEqual(condApp(APPS.excel), {
    app: APPS.excel,
  });

  assert.deepEqual(condApp(APPS.excel, false), {
    app: APPS.excel,
    unless: true,
  });

  assert.deepEqual(condNotApp(APPS.excel), {
    app: APPS.excel,
    unless: true,
  });

  assert.deepEqual(condNotVar({ name: "myVar", varDesc: "myVar" }, 1), {
    var: { name: "myVar", varDesc: "myVar" },
    equals: 1,
    unless: true,
  });
});

test("defineBindings integration with case & action helpers", () => {
  const rules = defineBindings([
    {
      description: "test binding",
      trigger: { keys: ["8"] },
      cases: [
        hold(app(APPS.ringCentral)),
        release(url(URLS.winsUnstashAll)),
      ],
    },
  ]);

  assert.equal(rules.length, 1);
  const built = rules[0] as any;
  // Hold & release sharing conditions are grouped into 1 tap-hold manipulator
  assert.equal(built.manipulators.length, 1);

  // Distinct condition cases produce distinct manipulators
  const rulesWithConds = defineBindings([
    {
      description: "test binding with conds",
      trigger: { keys: ["8"] },
      cases: [
        press(key("down_arrow")).when(condVar({ name: "flag", varDesc: "flag" }, 1)),
        release(key("up_arrow")),
      ],
    },
  ]);
  const builtWithConds = rulesWithConds[0] as any;
  assert.equal(builtWithConds.manipulators.length, 2);
});

test("Trigger and Bind wrappers create expected Binding and Trigger objects", () => {
  const tk = triggerKeys("a", ["left_command"]);
  assert.deepEqual(tk, { keys: ["a"], modifiers: ["left_command"] });

  const tp = triggerPointer("back", ["left_command"]);
  assert.deepEqual(tp, { pointer: "back", modifiers: ["left_command"] });

  const b1 = bind(tk, press(noop()));
  assert.deepEqual(b1, {
    trigger: { keys: ["a"], modifiers: ["left_command"] },
    cases: [press(noop())],
  });

  const b2 = bindKeys("8", hold(app(APPS.ringCentral)));
  assert.deepEqual(b2, {
    trigger: { keys: ["8"] },
    cases: [hold(app(APPS.ringCentral))],
  });

  const b3 = bindKeys("s", hold(url(URLS.csxWindow)), ["shift"]);
  assert.deepEqual(b3, {
    trigger: { keys: ["s"], modifiers: ["shift"] },
    cases: [hold(url(URLS.csxWindow))],
  });
});

test("from() wrapper handles single keys, key chords, SimOrder, TriggerModifiers, and pointers", () => {
  // Single key
  assert.deepEqual(from("a"), { keys: ["a"] });
  assert.deepEqual(from("a", ["left_command"]), { keys: ["a"], modifiers: ["left_command"] });

  // Key chord with SimOrder
  assert.deepEqual(from(["j", "k"], ["left_shift"], { down: "strict" }), {
    keys: ["j", "k"],
    modifiers: ["left_shift"],
    order: { down: "strict" },
  });

  // Object spec with key/keys/pointer
  assert.deepEqual(from({ key: "spacebar", modifiers: ["control"] }), {
    keys: ["spacebar"],
    modifiers: ["control"],
  });

  assert.deepEqual(
    from({ keys: ["a", "b"], modifiers: { mandatory: ["command"], optional: ["any"] }, order: { up: "strict" } }),
    {
      keys: ["a", "b"],
      modifiers: { mandatory: ["command"], optional: ["any"] },
      order: { up: "strict" },
    },
  );

  assert.deepEqual(from({ pointer: "button1", modifiers: ["left_option"] }), {
    pointer: "button1",
    modifiers: ["left_option"],
  });

  // Direct bind with from() or shorthand strings
  const bFromKey = bind(from("b", ["command"]), press(noop()));
  assert.deepEqual(bFromKey.trigger, { keys: ["b"], modifiers: ["command"] });

  const bShorthand = bind("c", press(noop()));
  assert.deepEqual(bShorthand.trigger, { keys: ["c"] });

  const bChord = bind(["j", "k"], press(noop()), { timing: { simultaneousMs: 50 } });
  assert.deepEqual(bChord.trigger, { keys: ["j", "k"] });
});

test("defineBindings supports mixed key and pointer button simultaneous triggers", () => {
  const rules = defineBindings([
    bind(
      from(["spacebar", "right"], ["left_command"]),
      press(app(APPS.excel)),
    ),
  ]);

  assert.equal(rules.length, 1);
  const rule = rules[0] as any;
  const manip = rule.manipulators[0];
  assert.deepEqual(manip.from.simultaneous, [
    { key_code: "spacebar" },
    { pointing_button: "button2" },
  ]);
});

test("guard() produces a press case marked guard with the action", () => {
  const g = guard(key("q", ["left_command"]));
  assert.equal(g.phase, "press");
  assert.equal((g as any).guard, true);
  assert.equal(g.do.length, 1);
  const action = g.do[0] as any;
  assert.equal(action.type, "key");
  assert.equal(action.key, "q");
  assert.deepEqual(action.modifiers, ["left_command"]);
});

test("guard() without arguments produces a press case marked guard with empty actions", () => {
  const g = guard();
  assert.equal(g.phase, "press");
  assert.equal((g as any).guard, true);
  assert.equal(g.do.length, 0);
});

test("guard() accepts condition as single parameter", () => {
  const cond = condApp({ type: "app", bundleId: "com.x", refDesc: "X" });
  const g = guard(cond);
  assert.equal((g as any).guard, true);
  assert.equal(g.do.length, 0);
  assert.deepEqual(g.conditions ?? [], [cond]);
});

