import assert from "node:assert/strict";
import test from "node:test";
import { APPS, CMDS, COMBOS, URLS, VARS } from "../data";
import {
  bind,
  bindKeys,
  bindTable,
  cmd,
  condApp,
  condNotApp,
  condNotVar,
  condVar,
  copy,
  cut,
  doubleTap,
  doubleTapHold,
  delayedSingleTap,
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
  tapAndHold,
  triggerKeys,
  triggerPointer,
  to,
  when,
  state,
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
    to(release(shell("cmd1")), hold(url("https://example.com", true))),
    timing({ aloneMs: 250, heldThresholdMs: 300 }),
  );

  assert.equal(b2.cases.length, 2);
  assert.equal(b2.cases[0]?.phase, "release");
  assert.equal(b2.cases[1]?.phase, "hold");
  assert.deepEqual(b2.timing, { aloneMs: 250, heldThresholdMs: 300 });

  // 3. options() and when() combined in flexible order
  const b3 = bind(
    from("right"),
    to(release(noop()), hold(noop())),
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
      cases: [hold(app(APPS.ringCentral)), release(url(URLS.winsUnstashAll))],
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
      cases: [press(key("down_arrow")).when(condVar({ name: "flag", varDesc: "flag" }, 1)), release(key("up_arrow"))],
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
  const rules = defineBindings([bind(from(["spacebar", "right"], ["left_command"]), press(app(APPS.excel)))]);

  assert.equal(rules.length, 1);
  const rule = rules[0] as any;
  const manip = rule.manipulators[0];
  assert.deepEqual(manip.from.simultaneous, [{ key_code: "spacebar" }, { pointing_button: "button2" }]);
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

/**
 * Phase A: registry primitives (URLS.*, COMBOS.*, CMDS.*, APPS.*) passed
 * directly to press()/release()/hold()/tap()/guard() are promoted to their
 * ActionSpec automatically, instead of requiring an explicit map()/url()/
 * cmd()/app() wrapper. See the DSL improvement plan discussion: the naive
 * approach (gating on isActionSpec()) is unsafe because MapSpec/UrlSpec/
 * CommandSpec/AppSpec reuse the same `type` tag as their ActionSpec variant
 * — these tests exist specifically to catch that regression.
 */

test("map/url/command/app registry primitives infer the same ActionSpec as their explicit wrapper", () => {
  // map: the crash case — a raw MapSpec's `type` is "map", identical to the
  // `map` ActionSpec's discriminant, so this only works if detection is
  // shape-based (refDesc) rather than isActionSpec()'s tag check.
  const viaCombo = release(COMBOS.focusWinRight);
  const viaWrapper = release(map(COMBOS.focusWinRight));
  assert.deepEqual(viaCombo.do, viaWrapper.do);
  assert.deepEqual(viaCombo.do, [{ type: "map", ref: COMBOS.focusWinRight, options: { repeat: false } }]);

  const viaUrl = hold(URLS.winMaximize);
  // rectangleUrls entries pin background:false in the registry (preserving
  // today's foreground `open -u` behavior), so url()'s resolved value shows
  // up here even though this call site never mentions background.
  assert.deepEqual(viaUrl.do, [{ type: "url", url: URLS.winMaximize, background: false }]);

  const viaCmd = press(CMDS.wordPrint);
  assert.deepEqual(viaCmd.do, [{ type: "command", ref: CMDS.wordPrint }]);

  const viaApp = hold(APPS.ringCentral);
  assert.deepEqual(viaApp.do, [{ type: "app", ref: APPS.ringCentral }]);
});

test("press/release/hold pass built Actions and raw ToEvents through unchanged, even mixed with registry primitives", () => {
  const rawEvent = { pointing_button: "button1" } as const;
  const built = key("a");
  const c = hold([rawEvent, built, COMBOS.focusWinRight]);
  assert.deepEqual(c.do, [rawEvent, built, { type: "map", ref: COMBOS.focusWinRight, options: { repeat: false } }]);
});

test("guard() normalizes registry primitives too, since it delegates to press()", () => {
  const g = guard(URLS.winMaximize);
  assert.deepEqual(g.do, [{ type: "url", url: URLS.winMaximize, background: false }]);
  assert.equal((g as any).guard, true);
});

/**
 * url() background precedence: explicit call-site arg > UrlSpec.background >
 * true (the fallback default). See UrlSpec.background's JSDoc and url()'s
 * own JSDoc in to-action-wrappers.ts for the full contract.
 */

test("url() background: explicit call-site argument overrides the registry entry's own setting", () => {
  // URLS.rectDisplayNext is a rectangleUrls entry, pinned background:false
  // in the registry — an explicit `true` here must still win.
  assert.deepEqual(url(URLS.rectDisplayNext, true), {
    type: "url",
    url: URLS.rectDisplayNext,
    background: true,
  });
});

test("url() background: registry entry's own setting is honored when the call site doesn't override", () => {
  // rectangleUrls pins background:false (preserves today's foreground open -u).
  assert.deepEqual(url(URLS.rectDisplayNext), {
    type: "url",
    url: URLS.rectDisplayNext,
    background: false,
  });

  // HsUrls leaves background unset, so it falls through to the true default.
  assert.deepEqual(url(URLS.hsWinToggleFill), {
    type: "url",
    url: URLS.hsWinToggleFill,
    background: true,
  });
});

test("url() background: falls back to true when neither the call site nor the ref specifies it", () => {
  // Raw string ref: no UrlSpec.background to consult at all.
  assert.deepEqual(url("https://example.com"), {
    type: "url",
    url: "https://example.com",
    background: true,
  });

  // A UrlSpec with `background` genuinely absent (not just falsy).
  const bareSpec = { type: "url", url: "sidenotes://x", refDesc: "x" } as const;
  assert.deepEqual(url(bareSpec), {
    type: "url",
    url: bareSpec,
    background: true,
  });
});

test("url() background: bare registry inference (hold(URLS.x)) resolves identically to an explicit url(URLS.x) call", () => {
  const viaBareHs = hold(URLS.hsWinToggleFill);
  const viaExplicitHs = hold(url(URLS.hsWinToggleFill));
  assert.deepEqual(viaBareHs.do, viaExplicitHs.do);
  assert.deepEqual(viaBareHs.do, [{ type: "url", url: URLS.hsWinToggleFill, background: true }]);

  const viaBareRect = hold(URLS.rectDisplayNext);
  const viaExplicitRect = hold(url(URLS.rectDisplayNext));
  assert.deepEqual(viaBareRect.do, viaExplicitRect.do);
  assert.deepEqual(viaBareRect.do, [{ type: "url", url: URLS.rectDisplayNext, background: false }]);
});


test("doubleTapHold and delayedSingleTap also accept registry primitives (the Phase A gap this closes)", () => {
  const dth = doubleTapHold(COMBOS.focusWinRight);
  assert.equal(dth.phase, "hold");
  assert.equal(dth.tapCount, 2);
  assert.deepEqual(dth.do, [{ type: "map", ref: COMBOS.focusWinRight, options: { repeat: false } }]);

  const dst = delayedSingleTap(APPS.ringCentral);
  assert.equal(dst.phase, "release");
  assert.equal(dst.delayed, true);
  assert.deepEqual(dst.do, [{ type: "app", ref: APPS.ringCentral }]);
});

test("tapAndHold() is exactly [release(tapAction), hold(holdAction)]", () => {
  const [tapCase, holdCase] = tapAndHold(CMDS.wordPrint, URLS.winMaximize);
  const expectedTap = release(cmd(CMDS.wordPrint));
  const expectedHold = hold(url(URLS.winMaximize));

  assert.equal(tapCase.phase, "release");
  assert.deepEqual(tapCase.do, expectedTap.do);
  assert.equal(holdCase.phase, "hold");
  assert.deepEqual(holdCase.do, expectedHold.do);
});

test("tapAndHold() applies the same conditions to both cases", () => {
  const cond = condApp(APPS.skim);
  const [tapCase, holdCase] = tapAndHold(APPS.ringCentral, APPS.kitty, cond);

  assert.deepEqual(tapCase.conditions, [cond]);
  assert.deepEqual(holdCase.conditions, [cond]);
});

test("tapAndHold() mixes bare registry primitives with explicit wrapper calls", () => {
  // The hold side needs url()'s `background` option, so it stays explicit —
  // tapAndHold() doesn't require both sides to be bare registry references.
  const [, holdCase] = tapAndHold(URLS.hsWinToggleFill, url(URLS.rectAppPrevDisplay, true));
  assert.deepEqual(holdCase.do, [{ type: "url", url: URLS.rectAppPrevDisplay, background: true }]);
});

test("when() infers a bare app spec exactly like state()/condApp() would", () => {
  assert.deepEqual(when(APPS.ringCentral), when(condApp(APPS.ringCentral)));
  assert.deepEqual(when(APPS.ringCentral).conditions, [state(APPS.ringCentral)]);
});

test("when() infers a bare var/state registry spec exactly like state() would", () => {
  assert.deepEqual(when(VARS.elementType).conditions, [state(VARS.elementType)]);
});

test("when() still accepts pre-built Conditions and Condition arrays unchanged (backward compat)", () => {
  const cond1 = condApp(APPS.skim);
  const cond2 = condVar(VARS.elementType, "AXButton");

  assert.deepEqual(when(cond1, cond2).conditions, [cond1, cond2]);
  assert.deepEqual(when([cond1, cond2]).conditions, [cond1, cond2]);
});

test("when() resolves an array of bare specs as independent conditions, matching state()", () => {
  const w = when([APPS.ringCentral, VARS.elementType]);
  assert.deepEqual(w.conditions, state([APPS.ringCentral, VARS.elementType]));
});

test("when() resolves a bare [target, value] tuple as a single condition, matching state()", () => {
  const w = when([VARS.elementType, "AXButton"]);
  assert.deepEqual(w.conditions, [state([VARS.elementType, "AXButton"])]);
});

test("when() mixes a pre-built Condition with a bare spec in the same call", () => {
  const cond = condApp(APPS.skim);
  const w = when(cond, VARS.elementType);
  assert.deepEqual(w.conditions, [cond, state(VARS.elementType)]);
});

test("CaseBuilder.when() infers bare specs exactly like the top-level when()", () => {
  const viaBare = press(key("a")).when(APPS.ringCentral);
  const viaExplicit = press(key("a")).when(condApp(APPS.ringCentral));
  assert.deepEqual(viaBare.conditions, viaExplicit.conditions);
});

test("CaseBuilder.when() called across multiple chained calls still appends, mixing bare and built conditions", () => {
  const c = press(key("a")).when(APPS.ringCentral).when(condVar(VARS.elementType, "AXButton"));
  assert.deepEqual(c.conditions, [state(APPS.ringCentral), condVar(VARS.elementType, "AXButton")]);
});

test("constructor-level conditions param on press/release/hold still only accepts built Conditions (when() is the bare-spec entry point)", () => {
  const cond = condApp(APPS.skim);
  const c = press(key("a"), cond);
  assert.deepEqual(c.conditions, [cond]);
});

test("bindTable() produces one bindKeys()-equivalent Binding per entry, sharing phase and modifiers", () => {
  const table = bindTable(
    "hold",
    {
      h: URLS.rayHere2There,
      j: URLS.rayRecentDownloads,
    },
    ["shift"],
  );

  assert.deepEqual(table, [
    bindKeys("h", hold(url(URLS.rayHere2There)), ["shift"]),
    bindKeys("j", hold(url(URLS.rayRecentDownloads)), ["shift"]),
  ]);
});

test("bindTable() auto-normalizes bare registry primitives the same way hold()/press() do", () => {
  const [b] = bindTable("release", { e: COMBOS.focusWinRight });
  assert.deepEqual(b, bindKeys("e", release(map(COMBOS.focusWinRight))));
});

test("bindTable() lets one entry override phase/conditions with a pre-built Case, unwrapped", () => {
  const cond = condApp(APPS.skim);
  const custom = hold(map(COMBOS.showPopclip)).when(cond);
  const table = bindTable("hold", {
    n: shell(CMDS.neruHints),
    p: custom,
  });

  assert.deepEqual(table[0], bindKeys("n", hold(shell(CMDS.neruHints))));
  // The table's "hold" phase is ignored for `p` — the pre-built Case is used
  // as-is, conditions included (already proven by the deepEqual above).
  assert.deepEqual(table[1], bindKeys("p", custom));
});

test("bindTable() accepts an ActionInput[] as a single multi-action case for one entry", () => {
  const [b] = bindTable("hold", {
    keypad_equal_sign: [map(COMBOS.selectWordLeft), shell(CMDS.quickDate)],
  });
  assert.deepEqual(b, bindKeys("keypad_equal_sign", hold([map(COMBOS.selectWordLeft), shell(CMDS.quickDate)])));
});

test("bindTable() accepts a Case[] as multiple cases for one entry, e.g. a per-key tap/hold pair", () => {
  const [b] = bindTable("release", {
    equal_sign: [release(key("keypad_equal_sign", { halt: true })), hold(map(COMBOS.selectWordLeft))],
  });
  assert.deepEqual(
    b,
    bindKeys("equal_sign", [release(key("keypad_equal_sign", { halt: true })), hold(map(COMBOS.selectWordLeft))]),
  );
});

test("bindTable() forwards shared BindingOptions to every entry", () => {
  // No modifiers: options is passed as the 3rd positional argument, same as
  // bindKeys() — bindKeys()'s own modifiers-vs-options disambiguation only
  // recognizes options in the 4th slot when the 3rd slot is real
  // TriggerModifiers; an explicit `undefined` 3rd arg is not equivalent to
  // omitting it, so options must not be passed 4th here.
  const table = bindTable("press", { a: key("a"), b: key("b") }, { description: "letters" });
  assert.equal(table[0]?.description, "letters");
  assert.equal(table[1]?.description, "letters");
});

test("bindTable() forwards shared BindingOptions alongside real modifiers in the 4th slot", () => {
  const table = bindTable("press", { a: key("a"), b: key("b") }, ["shift"], { description: "letters" });
  assert.deepEqual(table[0]?.trigger, { keys: ["a"], modifiers: ["shift"] });
  assert.equal(table[0]?.description, "letters");
  assert.equal(table[1]?.description, "letters");
});
