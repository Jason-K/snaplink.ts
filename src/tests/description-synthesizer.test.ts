import assert from "node:assert/strict";
import test from "node:test";

import { APPS, CMDS, PATHS, URLS, type ActionSpec, type Binding } from "../data";
import {
  describeAction,
  describeConditionGroup,
  describeTrigger,
  synthesizeManipulatorLabel,
  synthesizeRuleDescription,
} from "../engine/resolve-description/description-synthesizer";

test("describeAction: app variants by mode + actionDesc", () => {
  assert.equal(describeAction({ type: "app", ref: APPS.excel }), "open Microsoft Excel");
  assert.equal(describeAction({ type: "app", ref: APPS.excel, mode: "shell" }), "open-shell Microsoft Excel");
  assert.equal(describeAction({ type: "app", ref: APPS.excel, actionDesc: "force" }), "open Microsoft Excel | force");
});

test("describeAction: appHistory / folder / raycast / cleanShot / command", () => {
  assert.equal(describeAction({ type: "appHistory", index: 2 }), "Go back 2 apps");
  assert.equal(describeAction({ type: "folder", ref: PATHS.dlsDir }), "open 'DLs'");
  assert.equal(
    describeAction({
      type: "folder",
      ref: PATHS.dlsDir,
      actionDesc: "new tab",
    }),
    "open 'DLs' | new tab",
  );
  assert.equal(describeAction({ type: "url", url: URLS.rayClipboard }), "Call 'open Raycast clipboard manager'");
  assert.equal(describeAction({ type: "url", url: URLS.csxArea }), "Capture area using CSX");
  assert.equal(describeAction({ type: "command", ref: CMDS.fillPw }), "Run command 'Fill password'");
  // shell accepts a CommandRef too — describes via refDesc (not the raw command).
  assert.equal(describeAction({ type: "shell", command: CMDS.fillPw }), "Run 'Fill password'");
  assert.equal(describeAction({ type: "shell", command: "echo ad-hoc" }), "Run 'echo ad-hoc'");
});

test("describeAction: actHere / caseChange / wrapString", () => {
  assert.equal(describeAction({ type: "actHere", action: "formatCutSeed" }), "Context action: formatCutSeed");
  assert.equal(describeAction({ type: "caseChange", operation: "uppercase" }), "Change case to uppercase");
  assert.equal(describeAction({ type: "wrapString", operation: "wrap_quotes" }), "Wrap selection in wrap_quotes");
});

test("describeAction: map", () => {
  const ref = {
    type: "map" as const,
    keyCode: "f",
    modifiers: ["command", "option"],
    refDesc: "Raycast Focus Mode",
  };
  assert.equal(describeAction({ type: "map", ref }), "map 'Raycast Focus Mode'");
  assert.equal(describeAction({ type: "map", ref, actionDesc: "toggle" }), "map 'Raycast Focus Mode' | toggle");
});

test("describeAction: key (with/without mods) + actionDesc", () => {
  assert.equal(describeAction({ type: "key", key: "f2" }), "Emit 'F2'");
  assert.equal(describeAction({ type: "key", key: "return_or_enter" }), "Emit '⏎'");
  assert.equal(describeAction({ type: "key", key: "h", modifiers: ["left_command"] }), "Emit ⌘ + 'H'");
  assert.equal(
    describeAction({
      type: "key",
      key: "h",
      modifiers: ["left_command", "left_option"],
    }),
    "Emit ⌘⌥ + 'H'",
  );
  assert.equal(describeAction({ type: "key", key: "f2", actionDesc: "edit cell" }), "Emit 'F2' | edit cell");
});

test("describeAction: url / shell / python / osascript", () => {
  assert.equal(describeAction({ type: "url", url: "https://x.io" }), "Open 'https://x.io'");
  assert.equal(describeAction({ type: "shell", command: "open -u x" }), "Run 'open -u x'");
  assert.equal(describeAction({ type: "python", scriptPath: "/p/s.py" }), "Run python '/p/s.py'");
  assert.equal(describeAction({ type: "osascript", scriptPath: "/p/a.scpt" }), "Run osascript '/p/a.scpt'");
});

test("describeAction: cut / copy / paste / noop", () => {
  assert.equal(describeAction({ type: "cut" }), "Cut selection");
  assert.equal(describeAction({ type: "copy" }), "Copy selection");
  assert.equal(describeAction({ type: "paste" }), "Paste selection");
  assert.equal(describeAction({ type: "noop" }), "No operation");
});

test("describeAction: sequence joins sub-actions with ' then '", () => {
  const seq: ActionSpec = { type: "sequence", actions: [{ type: "cut" }, { type: "paste" }] };
  assert.equal(describeAction(seq), "Cut selection then Paste selection");
});

test("describeAction: setVar uses the var label", () => {
  assert.equal(
    describeAction({ type: "setVar", var: { name: "right_button_pressed", varDesc: "Right button held" } }),
    "Set Right button held",
  );
});

const excelCond = {
  type: "app" as const,
  bundleId: "com.microsoft.Excel",
  refDesc: "Microsoft Excel",
};
const roleVar = {
  name: "accessibility.focused_ui_element.role_string",
  varDesc: "Focused UI role",
};

test("describeConditionGroup: empty -> Always", () => {
  assert.equal(describeConditionGroup(undefined), "Always");
  assert.equal(describeConditionGroup([]), "Always");
});

test("describeConditionGroup: app if/unless + multi-app", () => {
  assert.equal(describeConditionGroup([{ app: excelCond }]), "In Microsoft Excel");
  assert.equal(describeConditionGroup([{ app: excelCond, unless: true }]), "Outside Microsoft Excel");
  assert.equal(
    describeConditionGroup([{ app: [excelCond, { type: "app", bundleId: "b", refDesc: "B" }] }]),
    "In Microsoft Excel/B",
  );
});

test("describeConditionGroup: var if/unless", () => {
  assert.equal(describeConditionGroup([{ var: roleVar, equals: "AXTextField" }]), "Focused UI role");
  assert.equal(describeConditionGroup([{ var: roleVar, equals: "AXTextField", unless: true }]), "not Focused UI role");
});

test("describeConditionGroup: multiple joined with ' and '", () => {
  assert.equal(
    describeConditionGroup([{ app: excelCond }, { var: roleVar, equals: "AXTextField" }]),
    "In Microsoft Excel and Focused UI role",
  );
});

test("describeConditionGroup: device if/unless", () => {
  const dev = { name: "g502X", deviceDesc: "Logitech G502 X", product_id: 49305, vendor_id: 1133 };
  assert.equal(describeConditionGroup([{ device: dev as any }]), "on Logitech G502 X");
  assert.equal(describeConditionGroup([{ device: dev as any, unless: true }]), "not on Logitech G502 X");
});

test("describeTrigger: single key + modifier chords", () => {
  assert.equal(describeTrigger({ keys: ["return_or_enter"] }), "[⏎]:");
  assert.equal(describeTrigger({ keys: ["escape"] }), "[␛]:");
  assert.equal(describeTrigger({ keys: ["home"] }), "[HOME]:");
  assert.equal(describeTrigger({ keys: ["h"], modifiers: ["left_command"] }), "[⌘]+[H]:");
  assert.equal(
    describeTrigger({
      keys: ["m"],
      modifiers: ["left_command", "left_option"],
    }),
    "[⌘⌥]+[M]:",
  );
});

test("describeTrigger: simultaneous chord joins keys with ']+['", () => {
  assert.equal(describeTrigger({ keys: ["j", "k"] }), "[J]+[K]:");
});

test("describeTrigger: pointer (button labels)", () => {
  assert.equal(describeTrigger({ pointer: "left" }), "left click:");
  assert.equal(describeTrigger({ pointer: "shift_button" }), "Shift button:");
  assert.equal(describeTrigger({ pointer: "left", modifiers: ["left_command"] }), "[⌘]+Left click:");
});

const evaluateCmd = { type: "command" as const, command: "x", refDesc: "Evaluate selection" };

test("synthesizeRuleDescription: simple unconditional remap", () => {
  const binding: Binding = {
    trigger: { keys: ["home"] },
    cases: [{ phase: "press", do: [{ type: "key", key: "left_arrow", modifiers: ["left_command"] }] }],
  };
  assert.equal(synthesizeRuleDescription(binding), "[HOME]:\n---\n\tOn Tap:\n\t\tAlways:\tEmit ⌘ + '←'");
});

test("synthesizeRuleDescription: conditional tap+hold (spec §9 canonical)", () => {
  const binding: Binding = {
    trigger: { keys: ["return_or_enter"] },
    cases: [
      { phase: "release", conditions: [{ app: excelCond }], do: [{ type: "key", key: "f2" }] },
      {
        phase: "release",
        conditions: [{ app: excelCond, unless: true }],
        do: [{ type: "key", key: "return_or_enter" }],
      },
      { phase: "hold", conditions: [{ app: excelCond }], do: [{ type: "key", key: "f2" }] },
      {
        phase: "hold",
        conditions: [{ app: excelCond, unless: true }],
        do: [{ type: "command", ref: evaluateCmd }],
      },
    ],
  };
  assert.equal(
    synthesizeRuleDescription(binding),
    "[⏎]:\n---\n\tOn Tap:\n\t\tIn Microsoft Excel:\tEmit 'F2'\n\t\tOutside Microsoft Excel:\tEmit '⏎'\n\tOn Hold:\n\t\tIn Microsoft Excel:\tEmit 'F2'\n\t\tOutside Microsoft Excel:\tRun command 'Evaluate selection'",
  );
});

test("synthesizeRuleDescription: multi-action case joined with ' then '", () => {
  const binding: Binding = {
    trigger: { keys: ["slash"], modifiers: ["left_command"] },
    cases: [
      {
        phase: "press",
        conditions: [{ app: { type: "app", bundleId: "w", refDesc: "Word" } }],
        do: [
          { type: "osascript", scriptPath: "/a.scpt" },
          { type: "shell", command: "elevate" },
        ],
      },
    ],
  };
  assert.equal(
    synthesizeRuleDescription(binding),
    "[⌘]+[/]:\n---\n\tOn Tap:\n\t\tIn Word:\tRun osascript '/a.scpt' then Run 'elevate'",
  );
});

test("synthesizeRuleDescription: Case.description overrides the action line", () => {
  const binding: Binding = {
    trigger: { keys: ["x"] },
    cases: [{ phase: "press", do: [{ type: "noop" }], description: "Custom fragment" }],
  };
  assert.equal(synthesizeRuleDescription(binding), "[X]:\n---\n\tOn Tap:\n\t\tAlways:\tCustom fragment");
});

test("synthesizeManipulatorLabel: undefined when unconditional", () => {
  assert.equal(synthesizeManipulatorLabel(undefined), undefined);
  assert.equal(synthesizeManipulatorLabel([]), undefined);
});

test("synthesizeManipulatorLabel: condition-group label when conditional", () => {
  assert.equal(synthesizeManipulatorLabel([{ app: { type: "app", bundleId: "x", refDesc: "Excel" } }]), "In Excel");
  assert.equal(
    synthesizeManipulatorLabel([{ app: { type: "app", bundleId: "x", refDesc: "Excel" }, unless: true }]),
    "Outside Excel",
  );
});

test("describeTrigger formats optional modifiers correctly", () => {
  assert.equal(describeTrigger({ keys: ["a"], modifiers: { optional: ["left_shift"] } }), "(⇧)?+[A]:");
  assert.equal(
    describeTrigger({
      keys: ["escape"],
      modifiers: { mandatory: ["left_command"], optional: ["left_shift", "left_control"] },
    }),
    "[⌘]+(⇧⌃)?+[␛]:",
  );
  assert.equal(
    describeTrigger({
      pointer: "left",
      modifiers: { mandatory: ["left_command"], optional: ["left_shift"] },
    }),
    "[⌘]+(⇧)?+Left click:",
  );
});
