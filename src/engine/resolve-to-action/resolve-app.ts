import type {
  SoftwareFunctionOpenApplication,
  ToEvent,
} from "../../types/karabiner";

import type { AppHistoryExclude, AppTarget } from "../../data";
import { PATHS } from "../../data/registries/paths";
import { shellSingleQuote } from "../utils";

export interface OpenAppOpts {
  bundleIdentifier?: string;
  filePath?: string;
  historyIndex?: number;
  exclusionBundleIdentifiers?: string[];
  exclusionFilePaths?: string[];
}

/**
 * Build a `software_function.open_application` event.
 *
 * Karabiner resolves the target by priority: bundle identifier, then file path,
 * then frontmost-application history index.
 */
export function toApp(opts: OpenAppOpts): ToEvent {
  const target: SoftwareFunctionOpenApplication | undefined = opts.bundleIdentifier
    ? { bundle_identifier: opts.bundleIdentifier }
    : opts.filePath
      ? { file_path: opts.filePath }
      : opts.historyIndex !== undefined
        ? { frontmost_application_history_index: opts.historyIndex }
        : undefined;

  if (!target) {
    throw new Error(
      "toApp() needs a bundleIdentifier, filePath, or historyIndex to open.",
    );
  }

  return {
    software_function: {
      open_application: {
        ...target,
        ...(opts.exclusionBundleIdentifiers
          ? {
              frontmost_application_history_exclusion_bundle_identifiers:
                opts.exclusionBundleIdentifiers,
            }
          : {}),
        ...(opts.exclusionFilePaths
          ? {
              frontmost_application_history_exclusion_file_paths:
                opts.exclusionFilePaths,
            }
          : {}),
      },
    },
  };
}

export function toAppId(bundleIdentifier: string): string {
  return `${PATHS.binAppOpen.path} -b ${shellSingleQuote(bundleIdentifier)}`;
}

export function toAppPath(filePath: string): string {
  return `${PATHS.binAppOpen.path} ${shellSingleQuote(filePath)}`;
}

/**
 * Resolve an AppTarget ref to the correct app() argument shape.
 * - AppSpec  (type:"app")  → { bundleIdentifier } or { filePath }
 * - PathSpec (type:"path") → { filePath }
 * - raw string starting with "/" or ending with ".app" → { filePath }
 * - raw string otherwise → { bundleIdentifier } (treated as a bundle ID)
 */
export function resolveAppTarget(
  ref: AppTarget,
): { bundleIdentifier: string } | { filePath: string } {
  if (typeof ref === "string") {
    return ref.startsWith("/") || ref.endsWith(".app")
      ? { filePath: ref }
      : { bundleIdentifier: ref };
  }
  if (ref.type === "path") {
    const p = ref.path ?? (ref as any).name;
    return { filePath: Array.isArray(p) ? p[0]! : p };
  }
  if (ref.path) {
    const p = Array.isArray(ref.path) ? ref.path[0]! : ref.path;
    return { filePath: p };
  }
  if (ref.bundleId) {
    const b = Array.isArray(ref.bundleId) ? ref.bundleId[0]! : ref.bundleId;
    return { bundleIdentifier: b };
  }
  if ((ref as any).name) {
    const n = Array.isArray((ref as any).name) ? (ref as any).name[0]! : (ref as any).name;
    return n.startsWith("/") || n.endsWith(".app")
      ? { filePath: n }
      : { bundleIdentifier: n };
  }
  throw new Error(`Invalid AppSpec: missing bundleId or path`);
}

/**
 * Resolve an `AppHistoryExclude` target into Karabiner `exclusionBundleIdentifiers` and `exclusionFilePaths`.
 */
export function resolveAppExclusions(
  exclude?: AppHistoryExclude,
): { exclusionBundleIdentifiers?: string[]; exclusionFilePaths?: string[] } {
  if (!exclude) return {};

  const bundleIds: string[] = [];
  const filePaths: string[] = [];

  const addTarget = (target: AppTarget) => {
    if (typeof target === "string") {
      if (target.startsWith("/") || target.endsWith(".app")) {
        filePaths.push(target);
      } else {
        bundleIds.push(target);
      }
    } else if (target.type === "path") {
      const p = target.path ?? (target as any).name;
      if (Array.isArray(p)) filePaths.push(...p);
      else if (p) filePaths.push(p);
    } else if (target.type === "app") {
      if (target.bundleId) {
        const b = target.bundleId;
        if (Array.isArray(b)) bundleIds.push(...b);
        else bundleIds.push(b);
      }
      if (target.path) {
        const p = target.path;
        if (Array.isArray(p)) filePaths.push(...p);
        else filePaths.push(p);
      }
    } else if ((target as any).bundleId) {
      const b = (target as any).bundleId;
      if (Array.isArray(b)) bundleIds.push(...b);
      else bundleIds.push(b);
    } else if ((target as any).path) {
      const p = (target as any).path;
      if (Array.isArray(p)) filePaths.push(...p);
      else filePaths.push(p);
    }
  };

  const processItem = (item: any) => {
    if (!item) return;
    if (Array.isArray(item)) {
      for (const sub of item) {
        processItem(sub);
      }
      return;
    }
    if (
      typeof item === "string" ||
      (typeof item === "object" &&
        (item.type === "app" ||
          item.type === "path" ||
          ("bundleId" in item && !("bundle_identifiers" in item || "exclusionBundleIdentifiers" in item)) ||
          ("path" in item && !("file_paths" in item || "exclusionFilePaths" in item))))
    ) {
      addTarget(item);
      return;
    }
    if (typeof item === "object") {
      if (item.exclude) {
        processItem(item.exclude);
      }
      if (item.bundle_identifiers) {
        bundleIds.push(...item.bundle_identifiers);
      }
      if (item.exclusionBundleIdentifiers) {
        bundleIds.push(...item.exclusionBundleIdentifiers);
      }
      if (item.file_paths) {
        filePaths.push(...item.file_paths);
      }
      if (item.exclusionFilePaths) {
        filePaths.push(...item.exclusionFilePaths);
      }
    }
  };

  processItem(exclude);

  return {
    ...(bundleIds.length > 0 ? { exclusionBundleIdentifiers: bundleIds } : {}),
    ...(filePaths.length > 0 ? { exclusionFilePaths: filePaths } : {}),
  };
}
