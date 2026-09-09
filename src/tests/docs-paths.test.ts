/**
 * Every `src/...` path and every relative link named in the documentation must
 * resolve.
 *
 * A stale path in a doc is worse than no doc: it sends a reader — human or
 * agent — to a file that does not exist, and it is invisible to every other
 * check in this repo. Before this test existed, five of the six documents named
 * paths under a `src/core/` layout that had been gone for months, and one
 * function inventory listed eleven engine files of which zero remained.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Paths inside fenced code blocks are illustrative, not references. */
function stripFencedBlocks(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function markdownFiles(): string[] {
  const docs = join(REPO, "docs");
  const files = readdirSync(docs)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(docs, f));
  return [...files, join(REPO, "README.md")];
}

const label = (file: string): string => file.slice(REPO.length + 1);

/**
 * Top-level entries of this `src/`, used to tell our paths from foreign ones.
 *
 * SCHEMA.md cites Karabiner-Elements' own tree (`src/share/manipulator/...`),
 * which is a real path in a repository that is not this one. Gating on the
 * first segment keeps those out while still catching what this test is for: a
 * path that *was* ours and has since moved. A move always leaves the first
 * segment intact (`src/engine/mouse-rules.ts`), so nothing real escapes.
 */
const SRC_ROOTS = new Set(readdirSync(join(REPO, "src")).map((e) => e.replace(/\.ts$/, "")));

function isOurs(path: string): boolean {
  const segment = path.split("/")[1];
  return segment !== undefined && SRC_ROOTS.has(segment.replace(/\.ts$/, ""));
}

/**
 * Docs name both files (`src/config.ts`) and module specifiers
 * (`src/types/karabiner`, as it appears in an import). Accept either, plus a
 * directory reached through its barrel.
 */
function resolvesInTree(path: string): boolean {
  const bare = path.replace(/\/$/, "");
  return [bare, `${bare}.ts`, `${bare}/index.ts`].some((candidate) =>
    existsSync(join(REPO, candidate)),
  );
}

test("every src/ path named in the docs exists", () => {
  for (const file of markdownFiles()) {
    const text = stripFencedBlocks(readFileSync(file, "utf8"));
    const named = new Set(text.match(/`(src\/[A-Za-z0-9_./-]+)`/g) ?? []);
    for (const backticked of named) {
      const path = backticked.slice(1, -1);
      if (!isOurs(path)) continue;
      assert.ok(
        resolvesInTree(path),
        `${label(file)} names \`${path}\`, which does not exist`,
      );
    }
  }
});

test("every relative markdown link resolves", () => {
  for (const file of markdownFiles()) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\]\((\.{1,2}\/[^)#]+)\)/g)) {
      const link = match[1];
      if (!link) continue;
      const target = resolve(dirname(file), link.split("#")[0] ?? link);
      assert.ok(existsSync(target), `${label(file)} links to ${link}, which does not exist`);
    }
  }
});

test("no doc references a retired document", () => {
  const retired = [
    "FUTURE_FEATURES.md",
    "DECLARATIVE_CONFIG_PLAN.md",
    "TS_BEST_PRACTICES_REVIEW.md",
    "BETA_IMPLEMENTATION_SUMMARY.md",
    "INTEGRATION_SUMMARY.md",
    "INTEGRATION_CONFLICTS.md",
    "UPSTREAM_SYNC.md",
    "docs/superpowers",
  ];
  for (const file of markdownFiles()) {
    const text = readFileSync(file, "utf8");
    for (const name of retired) {
      assert.ok(
        !text.includes(name),
        `${label(file)} references ${name}, which has been retired`,
      );
    }
  }
});
