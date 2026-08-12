import assert from "node:assert/strict";
import test from "node:test";

import type { AppSpec, Condition, DeviceSpec, PathSpec, VarSpec } from "../data";
import {
  CONDITION_HANDLERS,
  conditionKey,
  conditionKind,
  conditionsContradict,
  describeCondition,
  resolveCondition,
} from "../engine";

/**
 * The condition handler registry is the single source of truth for how each
 * `Condition` variant compiles, reads, and interacts with conflict analysis.
 *
 * Coverage is enforced at compile time by `satisfies ConditionHandlers`.
 * `conditionKind` is the one place a condition's shape is inspected.
 */

const app: AppSpec = { type: "app", bundleId: "com.example.a", refDesc: "App A" };
const appMulti: AppSpec = {
  type: "app",
  bundleId: ["com.example.a", "com.example.b"],
  refDesc: "Either app",
};
const path: PathSpec = { type: "path", path: "/Applications/Thing.app", refDesc: "Thing" };
const flag: VarSpec = { name: "flag", varDesc: "Flag" };
const device: DeviceSpec = {
  name: "m",
  deviceDesc: "Mouse",
  vendor_id: 1,
  product_id: 2,
  is_pointing_device: true,
};

test("every condition kind has a handler", () => {
  assert.deepEqual(Object.keys(CONDITION_HANDLERS).sort(), ["app", "device", "var"]);
});

test("conditionKind classifies each authoring shape", () => {
  assert.equal(conditionKind({ app }), "app");
  assert.equal(conditionKind({ var: flag, equals: 1 }), "var");
  assert.equal(conditionKind({ device }), "device");
});

test("conditionKind throws on an unrecognised shape rather than guessing", () => {
  assert.throws(
    () => conditionKind({ nonsense: true } as unknown as Condition),
    /Unrecognised condition shape/,
  );
});

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

test("app condition compiles to frontmost_application_if with bundle identifiers", () => {
  // No `description` key at all when none was supplied — exactOptionalPropertyTypes
  // keeps undefined-valued keys out of the emitted Karabiner JSON.
  assert.deepEqual(resolveCondition({ app }), {
    type: "frontmost_application_if",
    bundle_identifiers: ["com.example.a"],
  });
});

test("app condition with unless flips to frontmost_application_unless", () => {
  const resolved = resolveCondition({ app, unless: true }) as { type: string };
  assert.equal(resolved.type, "frontmost_application_unless");
});

test("app condition mixing bundle ids and paths emits both fields", () => {
  const resolved = resolveCondition({ app: [app, path] }) as {
    bundle_identifiers: string[];
    file_paths: string[];
  };
  assert.deepEqual(resolved.bundle_identifiers, ["com.example.a"]);
  assert.deepEqual(resolved.file_paths, ["/Applications/Thing.app"]);
});

test("bare strings are routed by shape: paths to file_paths, else bundle ids", () => {
  const resolved = resolveCondition({ app: ["/Apps/X.app", "com.example.z"] }) as {
    bundle_identifiers?: string[];
    file_paths?: string[];
  };
  assert.deepEqual(resolved.file_paths, ["/Apps/X.app"]);
  assert.deepEqual(resolved.bundle_identifiers, ["com.example.z"]);
});

test("var condition compiles to variable_if / variable_unless", () => {
  const resolved = resolveCondition({ var: flag, equals: 1 });
  assert.deepEqual(resolved, {
    type: "variable_if",
    name: "flag",
    value: 1,
  });
  assert.deepEqual(resolveCondition({ var: flag, equals: 1, unless: true }), {
    type: "variable_unless",
    name: "flag",
    value: 1,
  });
});

test("device condition strips registry metadata from the emitted identifiers", () => {
  const resolved = resolveCondition({ device }) as {
    type: string;
    identifiers: Record<string, unknown>[];
  };
  assert.equal(resolved.type, "device_if");
  assert.deepEqual(resolved.identifiers, [
    { product_id: 2, vendor_id: 1, is_pointing_device: true },
  ]);
});

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

test("descriptions read naturally for each kind and polarity", () => {
  assert.equal(describeCondition({ app }), "In App A");
  assert.equal(describeCondition({ app, unless: true }), "Outside App A");
  assert.equal(describeCondition({ var: flag, equals: 1 }), "Flag");
  assert.equal(describeCondition({ var: flag, equals: 1, unless: true }), "not Flag");
  assert.equal(describeCondition({ device }), "on Mouse");
  assert.equal(describeCondition({ device, unless: true }), "not on Mouse");
});

// ---------------------------------------------------------------------------
// Identity and contradiction — consumed by conflict analysis
// ---------------------------------------------------------------------------

test("conditionKey distinguishes polarity and target but not object identity", () => {
  assert.equal(conditionKey({ app }), conditionKey({ app: { ...app } }));
  assert.notEqual(conditionKey({ app }), conditionKey({ app, unless: true }));
  assert.notEqual(
    conditionKey({ var: flag, equals: 1 }),
    conditionKey({ var: flag, equals: 2 }),
  );
});

test("multi-bundle app conditions key order-insensitively", () => {
  const reversed: AppSpec = { ...appMulti, bundleId: ["com.example.b", "com.example.a"] };
  assert.equal(conditionKey({ app: appMulti }), conditionKey({ app: reversed }));
});

test("contradiction: same variable, opposite polarity", () => {
  assert.equal(
    conditionsContradict({ var: flag, equals: 1 }, { var: flag, equals: 1, unless: true }),
    true,
  );
});

test("contradiction: same variable, two different required values", () => {
  assert.equal(
    conditionsContradict({ var: flag, equals: 1 }, { var: flag, equals: 2 }),
    true,
  );
});

test("no contradiction: unless against a different value can both hold", () => {
  assert.equal(
    conditionsContradict({ var: flag, equals: 1 }, { var: flag, equals: 2, unless: true }),
    false,
  );
});

test("contradiction: two different apps cannot both be frontmost", () => {
  const other: AppSpec = { type: "app", bundleId: "com.example.b", refDesc: "App B" };
  assert.equal(conditionsContradict({ app }, { app: other }), true);
  // ...but "in A" and "not in B" is perfectly satisfiable.
  assert.equal(conditionsContradict({ app }, { app: other, unless: true }), false);
});

test("contradiction: an event cannot come from two different devices", () => {
  const other: DeviceSpec = { ...device, name: "n", product_id: 99 };
  assert.equal(conditionsContradict({ device }, { device: other }), true);
  assert.equal(conditionsContradict({ device }, { device: other, unless: true }), false);
});

test("conditions of different kinds never contradict each other", () => {
  assert.equal(conditionsContradict({ app }, { var: flag, equals: 1 }), false);
  assert.equal(conditionsContradict({ device }, { app }), false);
});
