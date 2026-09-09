/**
 * Central registry of Karabiner-Elements configuration profiles.
 * Assigns profile-level simple modifications and profile metadata.
 */

import type { ProfileSpec } from "../primitives/profiles";
import { DEFAULT_PROFILE, PREFERRED_PROFILE } from "../constants/profiles";

export const PROFILES = {
  default: {
    name: DEFAULT_PROFILE,
    refDesc: "Default fallback Karabiner profile",
    simpleModifications: [],
  },
  jjkDefault: {
    name: PREFERRED_PROFILE,
    refDesc: "Primary customized profile",
    selected: true,
    simpleModifications: [
      {
        from: { key_code: "fn" },
        to: [{ key_code: "left_control" }],
      },
      {
        from: { key_code: "left_control" },
        to: [{ key_code: "fn" }],
      }]
  },
} as const satisfies Record<string, ProfileSpec>;

