import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PROFILE, PREFERRED_PROFILE, PROFILES } from "../data";
import {
  applyConfigUpdate,
  getProfileSpec,
  ProfileNotFoundError,
  resolveProfileName,
  type ConfigUpdate,
} from "../engine/config-writer";
import type { KarabinerConfig, Profile } from "../types/karabiner";

test("getProfileSpec returns registered profile spec or falls back to jjkDefault", () => {
  assert.equal(getProfileSpec(DEFAULT_PROFILE).name, DEFAULT_PROFILE);
  assert.equal(getProfileSpec(PREFERRED_PROFILE).name, PREFERRED_PROFILE);
  assert.equal(getProfileSpec().name, PREFERRED_PROFILE);
  assert.equal(getProfileSpec("unknown_profile").name, PREFERRED_PROFILE);
});

test("resolveProfileName resolves to preferred profile when no explicit override is given", () => {
  const configWithDefaultOnly: KarabinerConfig = {
    profiles: [
      {
        name: DEFAULT_PROFILE,
        selected: true,
        complex_modifications: { rules: [] },
      },
    ],
  };

  const resolved = resolveProfileName(configWithDefaultOnly, {
    preferred: PREFERRED_PROFILE,
    fallback: DEFAULT_PROFILE,
  });

  assert.equal(resolved, PREFERRED_PROFILE);
});

test("resolveProfileName accepts explicit override for existing or registered profiles", () => {
  const config: KarabinerConfig = {
    profiles: [
      {
        name: DEFAULT_PROFILE,
        selected: true,
      },
      {
        name: "Custom User Profile",
        selected: false,
      },
    ],
  };

  assert.equal(
    resolveProfileName(config, {
      explicit: "Custom User Profile",
      preferred: PREFERRED_PROFILE,
      fallback: DEFAULT_PROFILE,
    }),
    "Custom User Profile",
  );

  assert.equal(
    resolveProfileName(config, {
      explicit: PREFERRED_PROFILE,
      preferred: PREFERRED_PROFILE,
      fallback: DEFAULT_PROFILE,
    }),
    PREFERRED_PROFILE,
  );
});

test("resolveProfileName throws ProfileNotFoundError for unknown explicit profile", () => {
  const config: KarabinerConfig = {
    profiles: [{ name: DEFAULT_PROFILE, selected: true }],
  };

  assert.throws(
    () =>
      resolveProfileName(config, {
        explicit: "NonExistentProfile",
        preferred: PREFERRED_PROFILE,
        fallback: DEFAULT_PROFILE,
      }),
    ProfileNotFoundError,
  );
});

test("applyConfigUpdate adds missing registered profiles (including JJK_Default)", () => {
  const initialConfig: KarabinerConfig = {
    profiles: [
      {
        name: DEFAULT_PROFILE,
        selected: true,
        complex_modifications: { rules: [] },
        devices: [],
        simple_modifications: [],
      },
    ],
  };

  const update: ConfigUpdate = {
    profileName: PREFERRED_PROFILE,
    rules: [
      {
        description: "Test Rule",
        manipulators: [
          {
            type: "basic",
            from: { key_code: "a" },
            to: [{ key_code: "b" }],
          },
        ],
      },
    ],
    simpleModifications: PROFILES.jjkDefault.simpleModifications,
  };

  const result = applyConfigUpdate(initialConfig, update);

  assert.equal(result.profiles.length, 2);

  const jjkProfile = result.profiles.find((p) => p.name === PREFERRED_PROFILE);
  assert.ok(jjkProfile, "JJK_Default profile must exist in output");
  assert.equal(jjkProfile.selected, true, "JJK_Default must be selected");
  assert.equal(jjkProfile.complex_modifications?.rules.length, 1);
  assert.deepEqual(jjkProfile.simple_modifications, [
    { from: { key_code: "fn" }, to: [{ key_code: "left_control" }] },
    { from: { key_code: "left_control" }, to: [{ key_code: "fn" }] },
  ]);

  const defaultProfile = result.profiles.find((p) => p.name === DEFAULT_PROFILE);
  assert.ok(defaultProfile, "Default profile must be preserved");
  assert.equal(defaultProfile.selected, false, "Default profile must be unselected");
});

test("applyConfigUpdate preserves unmanaged extra profiles", () => {
  const initialConfig: KarabinerConfig = {
    profiles: [
      {
        name: "Custom Profile",
        selected: true,
        complex_modifications: { rules: [] },
      },
    ],
  };

  const update: ConfigUpdate = {
    profileName: PREFERRED_PROFILE,
    rules: [],
  };

  const result = applyConfigUpdate(initialConfig, update);

  assert.ok(result.profiles.some((p) => p.name === "Custom Profile"));
  assert.ok(result.profiles.some((p) => p.name === DEFAULT_PROFILE));
  assert.ok(result.profiles.some((p) => p.name === PREFERRED_PROFILE));

  const customProfile = result.profiles.find((p) => p.name === "Custom Profile") as Profile;
  assert.equal(customProfile.selected, false);
});
