import type { AppSpec, Map, MapSpec, PathSpec } from "../primitives";

export type ComboOpts = {
  app?: AppSpec | PathSpec | string;
  activeAppOnly?: boolean;
  options?: { repeat?: boolean; halt?: boolean; lazy?: boolean };
};

export type HkInput =
  | string
  | [string, string[]]
  | { key?: string; name?: string; modifiers?: string[] };

export function normalizeCombo(input: HkInput): Map {
  if (typeof input === "string") {
    return { key: input, modifiers: [] };
  }
  if (Array.isArray(input)) {
    return { key: input[0], modifiers: input[1] ?? [] };
  }
  return {
    key: input.key ?? input.name ?? "",
    modifiers: input.modifiers ?? [],
  };
}

 
export function mapSpec(
  key: string,
  modifiers: string[],
  refDesc: string,
  opts?: ComboOpts,
): MapSpec;
export function mapSpec(
  combos: HkInput[],
  refDesc: string,
  opts?: ComboOpts,
): MapSpec;
export function mapSpec(
  keyOrCombos: string | HkInput[],
  modifiersOrRefDesc: string[] | string,
  refDescOrOpts?: string | ComboOpts,
  optsParam?: ComboOpts,
): MapSpec {
   
  if (Array.isArray(keyOrCombos)) {
    const combos = keyOrCombos.map(normalizeCombo);
    const refDesc = modifiersOrRefDesc as string;
    const opts = refDescOrOpts as ComboOpts | undefined;
    const first = combos[0] ?? { key: "", modifiers: [] };
    return {
      type: "map" as const,
      keyCode: first.key,
      modifiers: first.modifiers,
      combos,
      refDesc,
      ...(opts?.app !== undefined ? { app: opts.app } : {}),
      ...(opts?.activeAppOnly ? { activeAppOnly: true } : {}),
      ...(opts?.options ? { options: opts.options } : {}),
    };
  }
  const key = keyOrCombos;
  const modifiers = modifiersOrRefDesc as string[];
  const refDesc = refDescOrOpts as string;
  const opts = optsParam;
  return {
    type: "map" as const,
    keyCode: key,
    modifiers,
    refDesc,
    ...(opts?.app !== undefined ? { app: opts.app } : {}),
    ...(opts?.activeAppOnly ? { activeAppOnly: true } : {}),
    ...(opts?.options ? { options: opts.options } : {}),
  };
}
