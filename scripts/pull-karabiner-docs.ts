#!/usr/bin/env tsx
/**
 * Pulls upstream Karabiner documentation and references from GitHub:
 * 1. Karabiner-Elements keybinding lifecycle doc -> docs/karabiner_refs/karabiner-keybinding-lifecycle.md
 * 2. pqrs.org JSON docs tree -> docs/karabiner_docs/
 *    - Excludes pure-metadata `_index.md` files.
 *    - Flattens `index.md` and content `_index.md` to `{containing_folder_name}.md` in the parent directory.
 *    - Transforms Hugo shortcodes (parameter-table -> markdown tables, alert -> GFM alerts).
 *    - Formats all Markdown files with Prettier before comparison and writing.
 *    - Removes empty directories and skips image assets by default.
 * 3. Generates docs/DOCUMENTATION_INDEX.md with a directory tree of all docs & references, preserving comments/annotations.
 * 4. Generates a diff summary report in docs/karabiner_docs_updates/.
 *
 * Options:
 *   --include-images, --include_images  Include image folders and PNGs (default: false)
 *
 * Usage:
 *   npx tsx scripts/pull-karabiner-docs.ts
 *   npx tsx scripts/pull-karabiner-docs.ts --include-images
 *   npm run docs:pull
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = join(REPO_ROOT, "docs");
const DOCS_REFS_DIR = join(REPO_ROOT, "docs", "karabiner_refs");
const DOCS_KARABINER_DIR = join(REPO_ROOT, "docs", "karabiner_docs");
const DOCS_UPDATES_DIR = join(REPO_ROOT, "docs", "karabiner_docs_updates");
const DOCS_INDEX_FILE = join(DOCS_DIR, "DOCUMENTATION_INDEX.md");

const LIFECYCLE_SRC_URL =
  "https://raw.githubusercontent.com/pqrs-org/Karabiner-Elements/main/docs/karabiner-keybinding-lifecycle.md";
const LIFECYCLE_DEST_PATH = join(DOCS_REFS_DIR, "karabiner-keybinding-lifecycle.md");

const PQRS_TREE_API_URL =
  "https://api.github.com/repos/pqrs-org/pqrs.org/git/trees/main?recursive=1";
const PQRS_RAW_BASE_URL =
  "https://raw.githubusercontent.com/pqrs-org/pqrs.org/main/";
const PQRS_JSON_PREFIX = "sites/karabiner-elements/content/en/docs/json/";

const DEFAULT_FILE_ANNOTATIONS: Record<string, string> = {
  "karabiner-elements-deep-dive.md": "blog post summarizing Karabiner",
  "karabiner-gotchas.md": "summary of observations from working with Karabiner",
  "karabiner-keybinding-lifecycle.md":
    "pulled directly from [Karabiner-Elements Keybinding Lifecycle](https://raw.githubusercontent.com/pqrs-org/Karabiner-Elements/main/docs/karabiner-keybinding-lifecycle.md)",
};

const DEFAULT_UPSTREAM_DESCRIPTION =
  "Upstream documentation pulled from [pqrs.org docs/json](https://github.com/pqrs-org/pqrs.org/tree/main/sites/karabiner-elements/content/en/docs/json).";

interface FileChange {
  path: string;
  relPath: string;
  status: "added" | "modified" | "unchanged";
  oldContent?: string | undefined;
  newContent?: string | undefined;
  isBinary: boolean;
  sizeBefore?: number | undefined;
  sizeAfter: number;
}

let prettierConfigCache: prettier.Options | null = null;
async function getPrettierConfig(): Promise<prettier.Options> {
  if (!prettierConfigCache) {
    prettierConfigCache = (await prettier.resolveConfig(join(REPO_ROOT, ".prettierrc"))) ?? {};
  }
  return prettierConfigCache;
}

/**
 * Converts Hugo shortcodes in pqrs.org markdown docs into standard GitHub-Flavored Markdown:
 * 1. {{< parameter-table >}} JSON array {{< /parameter-table >}} -> Markdown table
 * 2. {{% alert title="..." color="..." %}} ... {{% /alert %}} -> > [!NOTE] / > [!TIP] / > [!CAUTION] / > [!WARNING]
 * 3. Removes Hugo template helpers like {{< karabiner-elements-complex-modifications-json-usage >}}
 * 4. Removes {{< local-image ... >}} tags when images are not included.
 */
function transformHugoShortcodes(markdown: string): string {
  let text = markdown;

  // 1. Transform parameter-table shortcodes to Markdown tables
  text = text.replace(
    /{{<\s*parameter-table\b([^>]*)>}}([\s\S]*?){{<\s*\/parameter-table\s*>}}/g,
    (_, attrsStr: string, bodyStr: string) => {
      let nameHeader = "Name";
      const nameHeaderMatch = /name-header="([^"]+)"/.exec(attrsStr);
      if (nameHeaderMatch?.[1]) {
        nameHeader = nameHeaderMatch[1];
      }

      // Extract JSON content (stripping markdown code fences if wrapped in ```json ... ```)
      const cleanJson = bodyStr.replace(/```(?:json)?/g, "").trim();
      let items: Record<string, unknown>[] = [];
      try {
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) {
          items = parsed as Record<string, unknown>[];
        }
      } catch (err) {
        console.warn("Failed to parse parameter-table JSON:", err, cleanJson);
        return bodyStr;
      }

      if (items.length === 0) {
        return "";
      }

      // Determine column order
      const knownColumnOrder = [
        "priority",
        "name",
        "value",
        "required",
        "description",
        "example_value",
        "fixed_value",
        "available_since",
      ];
      const presentKeys = new Set<string>();
      for (const item of items) {
        for (const k of Object.keys(item)) {
          presentKeys.add(k);
        }
      }

      const activeColumns: string[] = [];
      for (const col of knownColumnOrder) {
        if (presentKeys.has(col)) {
          activeColumns.push(col);
          presentKeys.delete(col);
        }
      }
      // Add any unexpected extra keys
      for (const col of presentKeys) {
        activeColumns.push(col);
      }

      const headerLabel = (col: string): string => {
        switch (col) {
          case "name":
            return nameHeader;
          case "value":
            return "Value";
          case "required":
            return "Required";
          case "description":
            return "Description";
          case "example_value":
            return "Example value";
          case "fixed_value":
            return "Fixed Value";
          case "available_since":
            return "Available since";
          case "priority":
            return "Priority";
          default:
            return col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, " ");
        }
      };

      const formatCellValue = (key: string, val: unknown): string => {
        if (val === undefined || val === null) return "";
        if (key === "required") {
          if (val === true) return "**Required**";
          if (val === false) return "Optional";
        }
        let str = String(val);
        // Replace unescaped newlines with <br />
        str = str.replace(/\r?\n/g, "<br />");
        // Escape unescaped pipe characters in cell content
        str = str.replace(/(?<!\\)\|/g, "\\|");
        return str;
      };

      const headers = activeColumns.map(headerLabel);
      const rows: string[] = [];
      rows.push(`| ${headers.join(" | ")} |`);
      rows.push(`| ${headers.map(() => ":---").join(" | ")} |`);

      for (const item of items) {
        const cells = activeColumns.map((col) => formatCellValue(col, item[col]));
        rows.push(`| ${cells.join(" | ")} |`);
      }

      return rows.join("\n");
    },
  );

  // 2. Transform Hugo alert shortcodes into GitHub-Flavored Markdown alerts
  text = text.replace(/{{%\s*alert\b([^%]*)%}}([\s\S]*?){{%\s*\/alert\s*%}}/g, (_, attrsStr: string, bodyStr: string) => {
    let title = "";
    let color = "";
    const titleMatch = /title="([^"]*)"/.exec(attrsStr);
    if (titleMatch?.[1]) title = titleMatch[1];
    const colorMatch = /color="([^"]*)"/.exec(attrsStr);
    if (colorMatch?.[1]) color = colorMatch[1];

    let alertType = "NOTE";
    const titleLower = title.toLowerCase();
    const colorLower = color.toLowerCase();

    if (titleLower.includes("caution") || colorLower === "danger") {
      alertType = "CAUTION";
    } else if (titleLower.includes("warning") || colorLower === "warning") {
      alertType = "WARNING";
    } else if (titleLower.includes("tip")) {
      alertType = "TIP";
    } else if (titleLower.includes("important")) {
      alertType = "IMPORTANT";
    } else {
      alertType = "NOTE";
    }

    const trimmedBody = bodyStr.trim();
    const bodyLines = trimmedBody.split("\n");

    const resultLines: string[] = [`> [!${alertType}]`];
    if (title && !["note", "tip", "caution", "warning", "important"].includes(titleLower)) {
      resultLines.push(`> **${title}**`);
      resultLines.push(">");
    }

    for (const line of bodyLines) {
      resultLines.push(`> ${line}`);
    }

    return resultLines.join("\n");
  });

  // 3. Remove Hugo usage notices and local-image shortcodes
  text = text.replace(/{{<\s*karabiner-elements-complex-modifications-(?:json|js)-usage\s*>}}\s*/g, "");
  text = text.replace(/{{<\s*local-image\s+src="([^"]+)"\s*>}}\s*/g, "");

  return text;
}

async function formatMarkdown(content: string, filePath?: string): Promise<string> {
  const transformed = transformHugoShortcodes(content);
  try {
    const config = await getPrettierConfig();
    return await prettier.format(transformed, {
      ...config,
      parser: "markdown",
      ...(filePath ? { filepath: filePath } : {}),
    });
  } catch {
    return transformed;
  }
}

function parseIncludeImagesFlag(): boolean {
  for (const arg of process.argv.slice(2)) {
    if (
      arg === "--include-images" ||
      arg === "--include_images" ||
      arg === "--include-images=true" ||
      arg === "--include_images=true" ||
      arg === "--include_images=1"
    ) {
      return true;
    }
  }
  return false;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Snaplink-Docs-Sync/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Snaplink-Docs-Sync/1.0",
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function isBinaryFile(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return ["png", "jpg", "jpeg", "gif", "ico", "webp", "pdf", "zip"].includes(ext);
}

function removeImagesRecursively(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === "images") {
        rmSync(fullPath, { recursive: true, force: true });
      } else {
        removeImagesRecursively(fullPath);
      }
    } else if (isBinaryFile(fullPath)) {
      rmSync(fullPath, { force: true });
    }
  }
}

function cleanEmptyDirectories(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      cleanEmptyDirectories(fullPath);
      if (readdirSync(fullPath).length === 0) {
        rmdirSync(fullPath);
      }
    }
  }
}

/**
 * Maps upstream repo paths:
 * - Pure-metadata `_index.md` -> null (skip)
 * - `.../folder/index.md` -> `.../folder.md`
 * - `.../folder/_index.md` (with substantive content) -> `.../folder.md`
 */
function mapUpstreamPath(subPath: string, content: string): string | null {
  const parts = subPath.split("/");
  const fileName = parts[parts.length - 1]!;

  if (fileName === "_index.md") {
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/, "").trim();
    if (!withoutFrontmatter) {
      return null;
    }
    if (parts.length === 1) {
      return null;
    }
    const folderName = parts[parts.length - 2]!;
    const parentDirs = parts.slice(0, -2);
    return [...parentDirs, `${folderName}.md`].join("/");
  }

  if (fileName === "index.md") {
    if (parts.length === 1) {
      return "index.md";
    }
    const folderName = parts[parts.length - 2]!;
    const parentDirs = parts.slice(0, -2);
    return [...parentDirs, `${folderName}.md`].join("/");
  }

  return subPath;
}

function computeSimpleDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const diffLines: string[] = [];

  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        i++;
        j++;
      } else {
        const nextMatchInNew = newLines.indexOf(oldLines[i]!, j);
        const nextMatchInOld = oldLines.indexOf(newLines[j]!, i);

        if (nextMatchInNew !== -1 && (nextMatchInOld === -1 || nextMatchInNew - j <= nextMatchInOld - i)) {
          while (j < nextMatchInNew) {
            diffLines.push(`+ ${newLines[j]}`);
            j++;
          }
        } else if (nextMatchInOld !== -1) {
          while (i < nextMatchInOld) {
            diffLines.push(`- ${oldLines[i]}`);
            i++;
          }
        } else {
          diffLines.push(`- ${oldLines[i]}`);
          diffLines.push(`+ ${newLines[j]}`);
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diffLines.push(`- ${oldLines[i]}`);
      i++;
    } else if (j < newLines.length) {
      diffLines.push(`+ ${newLines[j]}`);
      j++;
    }
  }

  return diffLines.join("\n");
}

async function syncDocs(includeImages: boolean): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  if (!includeImages) {
    removeImagesRecursively(DOCS_KARABINER_DIR);
  }

  console.log("1. Pulling keybinding lifecycle reference doc...");
  mkdirSync(DOCS_REFS_DIR, { recursive: true });
  const rawLifecycleBuf = await fetchBuffer(LIFECYCLE_SRC_URL);
  const formattedLifecycleStr = await formatMarkdown(rawLifecycleBuf.toString("utf8"), LIFECYCLE_DEST_PATH);
  const lifecycleBuf = Buffer.from(formattedLifecycleStr, "utf8");

  const lifecycleExists = existsSync(LIFECYCLE_DEST_PATH);
  let lifecycleOldStr: string | undefined;
  if (lifecycleExists) {
    const rawOld = readFileSync(LIFECYCLE_DEST_PATH, "utf8");
    lifecycleOldStr = await formatMarkdown(rawOld, LIFECYCLE_DEST_PATH);
  }
  const lifecycleChanged = !lifecycleExists || lifecycleOldStr !== formattedLifecycleStr;

  const lifecycleChange: FileChange = {
    path: LIFECYCLE_DEST_PATH,
    relPath: relative(REPO_ROOT, LIFECYCLE_DEST_PATH),
    status: !lifecycleExists ? "added" : lifecycleChanged ? "modified" : "unchanged",
    oldContent: lifecycleOldStr,
    newContent: formattedLifecycleStr,
    isBinary: false,
    sizeBefore: lifecycleOldStr ? Buffer.byteLength(lifecycleOldStr, "utf8") : undefined,
    sizeAfter: lifecycleBuf.length,
  };
  writeFileSync(LIFECYCLE_DEST_PATH, lifecycleBuf);
  changes.push(lifecycleChange);
  console.log(`   -> ${lifecycleChange.relPath} (${lifecycleChange.status})`);

  console.log("2. Querying pqrs.org repository tree...");
  interface GitTreeItem {
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
  }
  interface GitTreeResponse {
    sha: string;
    tree: GitTreeItem[];
  }

  const treeData = await fetchJson<GitTreeResponse>(PQRS_TREE_API_URL);
  let docBlobs = treeData.tree.filter(
    (item) => item.type === "blob" && item.path.startsWith(PQRS_JSON_PREFIX),
  );

  if (!includeImages) {
    docBlobs = docBlobs.filter((item) => !isBinaryFile(item.path) && !item.path.includes("/images/"));
  }

  console.log(
    `   Found ${docBlobs.length} documentation files to process under ${PQRS_JSON_PREFIX} (include_images=${includeImages})`,
  );
  mkdirSync(DOCS_KARABINER_DIR, { recursive: true });

  for (const item of docBlobs) {
    const subPath = item.path.slice(PQRS_JSON_PREFIX.length);
    const itemUrl = `${PQRS_RAW_BASE_URL}${item.path}`;
    const fileBuf = await fetchBuffer(itemUrl);
    const binary = isBinaryFile(item.path);
    const rawContentStr = !binary ? fileBuf.toString("utf8") : "";

    const mappedRelPath = mapUpstreamPath(subPath, rawContentStr);
    if (!mappedRelPath) {
      // Skipped metadata-only file
      continue;
    }

    const destPath = join(DOCS_KARABINER_DIR, mappedRelPath);
    mkdirSync(dirname(destPath), { recursive: true });

    let finalBuf = fileBuf;
    let formattedNewStr: string | undefined;
    let formattedOldStr: string | undefined;

    if (!binary) {
      formattedNewStr = await formatMarkdown(rawContentStr, destPath);
      finalBuf = Buffer.from(formattedNewStr, "utf8");
    }

    const fileExists = existsSync(destPath);
    if (fileExists && !binary) {
      const rawOld = readFileSync(destPath, "utf8");
      formattedOldStr = await formatMarkdown(rawOld, destPath);
    }

    const fileChanged = !fileExists || (binary ? !readFileSync(destPath).equals(finalBuf) : formattedOldStr !== formattedNewStr);

    const change: FileChange = {
      path: destPath,
      relPath: relative(REPO_ROOT, destPath),
      status: !fileExists ? "added" : fileChanged ? "modified" : "unchanged",
      oldContent: !binary ? formattedOldStr : undefined,
      newContent: !binary ? formattedNewStr : undefined,
      isBinary: binary,
      sizeBefore: fileExists ? (binary ? statSync(destPath).size : (formattedOldStr ? Buffer.byteLength(formattedOldStr, "utf8") : undefined)) : undefined,
      sizeAfter: finalBuf.length,
    };

    writeFileSync(destPath, finalBuf);
    changes.push(change);
    if (change.status !== "unchanged") {
      console.log(`   -> ${change.relPath} (${change.status})`);
    }
  }

  // Remove any obsolete index.md / _index.md files that were replaced by flattened .md
  function cleanObsoleteNestedFiles(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        cleanObsoleteNestedFiles(fullPath);
      } else if (entry === "index.md" || entry === "_index.md") {
        rmSync(fullPath, { force: true });
      }
    }
  }

  cleanObsoleteNestedFiles(DOCS_KARABINER_DIR);
  cleanEmptyDirectories(DOCS_KARABINER_DIR);

  return changes;
}

/**
 * Extracts existing annotations from DOCUMENTATION_INDEX.md so custom descriptions are preserved.
 */
function extractExistingAnnotations(indexPath: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(DEFAULT_FILE_ANNOTATIONS)) {
    map.set(k, v);
  }
  if (!existsSync(indexPath)) return map;

  const content = readFileSync(indexPath, "utf8");
  for (const line of content.split("\n")) {
    const match = /^\s*-\s*\[([^\]]+)\]\([^)]+\)\s*-\s*(.+)$/.exec(line);
    if (match?.[1] && match[2]) {
      map.set(match[1].trim(), match[2].trim());
    }
  }
  return map;
}

function buildDirectoryTree(
  currentDir: string,
  annotations: Map<string, string>,
  indentLevel: number = 0,
): string[] {
  const lines: string[] = [];
  if (!existsSync(currentDir)) return lines;

  const entries = readdirSync(currentDir).sort((a, b) => a.localeCompare(b));
  const files: string[] = [];
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(currentDir, entry);
    if (statSync(fullPath).isDirectory()) {
      dirs.push(entry);
    } else if (entry.endsWith(".md")) {
      files.push(entry);
    }
  }

  const indent = "  ".repeat(indentLevel);

  for (const file of files) {
    const fullPath = join(currentDir, file);
    const relFromDocs = relative(DOCS_DIR, fullPath);
    const annotation = annotations.get(file);
    const suffix = annotation ? ` - ${annotation}` : "";
    lines.push(`${indent}- [${file}](./${relFromDocs})${suffix}`);
  }

  for (const dir of dirs) {
    lines.push(`${indent}- **${dir}/**`);
    lines.push(...buildDirectoryTree(join(currentDir, dir), annotations, indentLevel + 1));
  }

  return lines;
}

function generateDocumentationIndex(changes: FileChange[]): string {
  const now = new Date();
  const dateTimeStr = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  const annotations = extractExistingAnnotations(DOCS_INDEX_FILE);

  const added = changes.filter((c) => c.status === "added");
  const modified = changes.filter((c) => c.status === "modified");

  const lines: string[] = [];
  lines.push("# Documentation Index");
  lines.push("");
  lines.push("Index of Karabiner documentation and reference materials.");
  lines.push("");
  lines.push("## References (`docs/karabiner_refs`)");
  lines.push("");
  lines.push(...buildDirectoryTree(DOCS_REFS_DIR, annotations));
  lines.push("");
  lines.push("## Karabiner Upstream Documentation (`docs/karabiner_docs`)");
  lines.push("");
  lines.push(DEFAULT_UPSTREAM_DESCRIPTION);
  lines.push("");
  lines.push(...buildDirectoryTree(DOCS_KARABINER_DIR, annotations));
  lines.push("");
  lines.push(`## Recent Changes as of ${dateTimeStr}`);
  lines.push("");
  lines.push("### 🟢 New Documents");
  lines.push("");
  if (added.length > 0) {
    for (const item of added) {
      const relFromDocs = relative(DOCS_DIR, item.path);
      lines.push(`- [${basename(item.path)}](./${relFromDocs}) (\`${relFromDocs}\`)`);
    }
  } else {
    lines.push("_None in the last pull._");
  }
  lines.push("");
  lines.push("### 🟡 Modified Documents");
  lines.push("");
  if (modified.length > 0) {
    for (const item of modified) {
      const relFromDocs = relative(DOCS_DIR, item.path);
      lines.push(`- [${basename(item.path)}](./${relFromDocs}) (\`${relFromDocs}\`)`);
    }
  } else {
    lines.push("_None in the last pull._");
  }
  lines.push("");

  return lines.join("\n");
}

function generateDiffSummaryReport(changes: FileChange[], includeImages: boolean): string {
  const timestamp = new Date().toISOString();
  const added = changes.filter((c) => c.status === "added");
  const modified = changes.filter((c) => c.status === "modified");
  const unchanged = changes.filter((c) => c.status === "unchanged");

  const lines: string[] = [];
  lines.push("# Karabiner Documentation Sync & Diff Summary");
  lines.push("");
  lines.push(`**Generated at:** \`${timestamp}\`  `);
  lines.push(`**Include Images:** \`${includeImages}\`  `);
  lines.push(`**Prettier Formatted:** \`true\`  `);
  lines.push(`**Sources:**`);
  lines.push(`- Lifecycle Reference: [Karabiner-Elements Keybinding Lifecycle](${LIFECYCLE_SRC_URL})`);
  lines.push(`- Upstream JSON Docs: [pqrs.org docs/json](https://github.com/pqrs-org/pqrs.org/tree/main/sites/karabiner-elements/content/en/docs/json)`);
  lines.push("");
  lines.push("## Summary Stats");
  lines.push("");
  lines.push(`| Status | Count |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| 🟢 **Added (New Files)** | ${added.length} |`);
  lines.push(`| 🟡 **Modified** | ${modified.length} |`);
  lines.push(`| ⚪ **Unchanged** | ${unchanged.length} |`);
  lines.push(`| **Total Synced** | ${changes.length} |`);
  lines.push("");

  if (added.length > 0) {
    lines.push("## 🟢 Added Files");
    lines.push("");
    for (const item of added) {
      lines.push(`- \`${item.relPath}\` (${item.sizeAfter} bytes)`);
    }
    lines.push("");
  }

  if (modified.length > 0) {
    lines.push("## 🟡 Modified Files");
    lines.push("");
    for (const item of modified) {
      lines.push(`### \`${item.relPath}\``);
      lines.push(`- Size before: ${item.sizeBefore} bytes, Size after: ${item.sizeAfter} bytes`);
      if (!item.isBinary && item.oldContent && item.newContent) {
        const diff = computeSimpleDiff(item.oldContent, item.newContent);
        lines.push("");
        lines.push("```diff");
        lines.push(diff.length > 3000 ? diff.slice(0, 3000) + "\n... (diff truncated)" : diff);
        lines.push("```");
      }
      lines.push("");
    }
  }

  if (unchanged.length > 0) {
    lines.push("## ⚪ Unchanged Files");
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>Click to view all unchanged files</summary>");
    lines.push("");
    for (const item of unchanged) {
      lines.push(`- \`${item.relPath}\``);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  try {
    const includeImages = parseIncludeImagesFlag();
    const changes = await syncDocs(includeImages);
    mkdirSync(DOCS_UPDATES_DIR, { recursive: true });

    // Generate DOCUMENTATION_INDEX.md
    const rawIndexMd = generateDocumentationIndex(changes);
    const indexMd = await formatMarkdown(rawIndexMd, DOCS_INDEX_FILE);
    writeFileSync(DOCS_INDEX_FILE, indexMd, "utf8");

    // Generate diff summary reports
    const rawSummaryMd = generateDiffSummaryReport(changes, includeImages);
    const summaryMd = await formatMarkdown(rawSummaryMd, join(DOCS_UPDATES_DIR, "README.md"));

    const dateStr = new Date().toISOString().split("T")[0];
    const summaryFile = join(DOCS_UPDATES_DIR, `diff-summary-${dateStr}.md`);
    const readmeFile = join(DOCS_UPDATES_DIR, "README.md");

    writeFileSync(summaryFile, summaryMd, "utf8");
    writeFileSync(readmeFile, summaryMd, "utf8");

    console.log(`\nDocumentation index generated at:`);
    console.log(`  - ${relative(REPO_ROOT, DOCS_INDEX_FILE)}`);
    console.log(`\nDiff summary written to:`);
    console.log(`  - ${relative(REPO_ROOT, summaryFile)}`);
    console.log(`  - ${relative(REPO_ROOT, readmeFile)}`);

    const added = changes.filter((c) => c.status === "added").length;
    const modified = changes.filter((c) => c.status === "modified").length;
    const unchanged = changes.filter((c) => c.status === "unchanged").length;
    console.log(`\nSync finished: ${added} added, ${modified} modified, ${unchanged} unchanged (include_images=${includeImages}).`);
  } catch (err) {
    console.error("Error syncing docs:", err);
    process.exit(1);
  }
}

void main();
