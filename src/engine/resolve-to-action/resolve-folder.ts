import type { FolderOpener } from "../../data/primitives/actions";

export type { FolderOpener };

/**
 * Generate a shell command to open a folder, using the given opener app.
 * Defaults to the system Finder when no opener is specified.
 */
export const toFolder = (
  folderPath: string,
  opener: FolderOpener = "finder",
): string => {
  if (opener === "bloom") {
    const escapedPath = folderPath.replace(/ /g, "\\ ");
    return `open -a Bloom '${escapedPath}'`;
  }
  if (opener === "qspace") {
    return `open -b com.jinghaoshe.qspace.pro '${folderPath}'`;
  }
  return `open '${folderPath}'`;
};
