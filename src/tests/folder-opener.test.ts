import assert from "node:assert/strict";
import test from "node:test";

import { toFolder } from "../engine/resolve-to-action";

test("bloom opener escapes spaces", () => {
  const command = toFolder("/Users/jason/My Folder", "bloom");
  assert.equal(command, "open -a Bloom '/Users/jason/My\\ Folder'");
});

test("qspace opener uses bundle open syntax", () => {
  const command = toFolder("/Users/jason/My Folder", "qspace");
  assert.equal(
    command,
    "open -b com.jinghaoshe.qspace.pro '/Users/jason/My Folder'",
  );
});

test("finder opener (default) uses plain open", () => {
  assert.equal(
    toFolder("/Users/jason/My Folder", "finder"),
    "open '/Users/jason/My Folder'",
  );
  // default (no opener arg) also resolves to finder
  assert.equal(
    toFolder("/Users/jason/My Folder"),
    "open '/Users/jason/My Folder'",
  );
});
