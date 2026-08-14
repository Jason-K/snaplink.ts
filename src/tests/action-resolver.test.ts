import assert from "node:assert/strict";
import test from "node:test";
import type { Manipulator } from "../types/karabiner";
import { ensurePathQuotingInCommand, ensurePathQuotingInManipulators } from "../engine/utils";
import { resolveActionToEvents } from "../engine/resolve-to-action";

test("ensurePathQuotingInCommand encloses unquoted paths in quotes", () => {
  assert.equal(
    ensurePathQuotingInCommand("osascript /Users/jason/script.applescript arg1"),
    'osascript "/Users/jason/script.applescript" arg1'
  );
  assert.equal(
    ensurePathQuotingInCommand("/Users/jason/.local/bin/open-app -b 'com.apple.finder'"),
    '"/Users/jason/.local/bin/open-app" -b \'com.apple.finder\''
  );
});

test("ensurePathQuotingInCommand removes duplicate quoting", () => {
  assert.equal(
    ensurePathQuotingInCommand("osascript ''/Users/jason/script.applescript'' arg1"),
    'osascript "/Users/jason/script.applescript" arg1'
  );
  assert.equal(
    ensurePathQuotingInCommand('osascript ""/Users/jason/script.applescript"" arg1'),
    'osascript "/Users/jason/script.applescript" arg1'
  );
  assert.equal(
    ensurePathQuotingInCommand('osascript \'"/Users/jason/script.applescript"\' arg1'),
    'osascript "/Users/jason/script.applescript" arg1'
  );
});

test("ensurePathQuotingInCommand preserves single set of quotes", () => {
  assert.equal(
    ensurePathQuotingInCommand('osascript "/Users/jason/script.applescript" arg1'),
    'osascript "/Users/jason/script.applescript" arg1'
  );
  assert.equal(
    ensurePathQuotingInCommand("osascript '/Users/jason/script.applescript' arg1"),
    "osascript '/Users/jason/script.applescript' arg1"
  );
  assert.equal(
    ensurePathQuotingInCommand("open -g 'hammerspoon://layer_indicator?action=show&layer=space'"),
    "open -g 'hammerspoon://layer_indicator?action=show&layer=space'"
  );
  assert.equal(
    ensurePathQuotingInCommand(
      "'/opt/homebrew/bin/hs' -c 'local win = hs.window.focusedWindow(); local widthCoverage = (winFrame.w / screenFrame.w); hs.urlevent.openURL(url)'"
    ),
    "'/opt/homebrew/bin/hs' -c 'local win = hs.window.focusedWindow(); local widthCoverage = (winFrame.w / screenFrame.w); hs.urlevent.openURL(url)'"
  );
});

test("ensurePathQuotingInCommand places $HOME and ${HOME} outside single quotes", () => {
  assert.equal(
    ensurePathQuotingInCommand(
      "osascript '$HOME/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript'"
    ),
    "osascript $HOME'/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript'"
  );
  assert.equal(
    ensurePathQuotingInCommand(
      "osascript '${HOME}/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript'"
    ),
    "osascript ${HOME}'/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript'"
  );
  assert.equal(
    ensurePathQuotingInCommand(
      "osascript $HOME/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript"
    ),
    "osascript $HOME'/Scripts/apps/karabiner/snaplink.ts/scripts/applescripts/get-word-document-path.applescript'"
  );
  assert.equal(
    ensurePathQuotingInCommand(
      "'$HOME/Scripts/.venv/shared_venv/bin/python' '$HOME/Scripts/ui/ocrToMd/shot_to_md.py'"
    ),
    "$HOME'/Scripts/.venv/shared_venv/bin/python' $HOME'/Scripts/ui/ocrToMd/shot_to_md.py'"
  );
  assert.equal(
    ensurePathQuotingInCommand(
      "'$HOME/path/to/$HOME/file'"
    ),
    "$HOME'/path/to/'$HOME'/file'"
  );
});

test("ensurePathQuotingInManipulators normalizes paths across manipulator event fields", () => {
  const manipulator: Manipulator = {
    type: "basic",
    from: { key_code: "a" },
    to: [
      { shell_command: "osascript /Users/jason/script.applescript" } as any,
    ],
    to_if_alone: [
      { shell_command: "''/Users/jason/alone.sh''" } as any,
    ],
    to_if_held_down: [
      { shell_command: '""/Users/jason/hold.sh""' } as any,
    ],
    to_after_key_up: [
      { shell_command: "/Users/jason/keyup.sh" } as any,
    ],
    to_delayed_action: {
      to_if_invoked: [
        { shell_command: "''/Users/jason/invoked.sh''" } as any,
      ],
      to_if_canceled: [
        { shell_command: "/Users/jason/canceled.sh" } as any,
      ],
    },
  };

  const result = ensurePathQuotingInManipulators(manipulator) as any;

  assert.equal(
    (result.to?.[0] as any).shell_command,
    'osascript "/Users/jason/script.applescript"'
  );
  assert.equal(
    (result.to_if_alone?.[0] as any).shell_command,
    '"/Users/jason/alone.sh"'
  );
  assert.equal(
    (result.to_if_held_down?.[0] as any).shell_command,
    '"/Users/jason/hold.sh"'
  );
  assert.equal(
    (result.to_after_key_up?.[0] as any).shell_command,
    '"/Users/jason/keyup.sh"'
  );
  assert.equal(
    (result.to_delayed_action?.to_if_invoked?.[0] as any).shell_command,
    '"/Users/jason/invoked.sh"'
  );
  assert.equal(
    (result.to_delayed_action?.to_if_canceled?.[0] as any).shell_command,
    '"/Users/jason/canceled.sh"'
  );
});

test("resolveActionToEvents automatically normalizes shell command paths", () => {
  const events = resolveActionToEvents({
    type: "osascript",
    scriptPath: "/Users/jason/script.applescript",
    args: ["hello"],
  });
  assert.equal(events.length, 1);
  assert.equal(
    (events[0] as any).shell_command,
    'osascript "/Users/jason/script.applescript" \'hello\''
  );
});
