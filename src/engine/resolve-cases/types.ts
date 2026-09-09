import type { ToEvent } from "../../types/karabiner";
import type { Condition, Phase } from "../../data";

export type ResolvedCase = {
  tapCount: number;
  phase: Phase;
  delayed: boolean;
  guard: boolean;
  conditions: unknown[];
  rawConditions: Condition[]; // original Condition[] — for slice-labels
  do: ToEvent[];
};

export type CaseGroup = {
  conditions: unknown[];
  rawConditions: Condition[];
  pressDo: ToEvent[];
  releaseDo: ToEvent[];
  holdDo: ToEvent[];
  hasRelease: boolean;
  hasHold: boolean;
};
