# Karabiner User Command Server — Development Guide

> **No current callers.** `toUserCommand()` and `toLayerIndicator()`
> (`src/engine/resolve-to-action/resolve-script.ts`) are not invoked by anything
> in the build as of 2026-08-12 — their only consumer was the leader layer,
> which was removed. The server, the receiver and the launch agent still work;
> nothing is asking them to.

This guide explains when and how to use the user command server versus traditional shell commands, and how to extend it with new endpoints.

## Quick Reference: Server vs Shell

| Criterion     | Command Server                            | Shell Command                     |
| ------------- | ----------------------------------------- | --------------------------------- |
| **Latency**   | ~50ms (persistent daemon, pre-warmed)     | ~100–200ms (subprocess spawn)     |
| **Frequency** | High (10+/second)                         | Low (occasional, <5/second)       |
| **Safety**    | Allowlist-based endpoint registry         | Direct shell execution            |
| **State**     | Can maintain session state                | Stateless                         |
| **Use cases** | Layer indicator, notifications, app focus | One-off operations, complex logic |

---

## Decision Tree

```text
Start: I need to execute an operation from a Karabiner rule

├─ Do I need this > 5 times/second?
│  └─ YES → Use command server (lower latency, less overhead)
│  └─ NO → Continue
│
├─ Is the operation simple and deterministic? (open URL, launch app)
│  └─ YES (mostly) → Either works; consider frequency
│  └─ NO (complex logic, error handling) → Use shell_command
│
├─ Does the operation need to run asynchronously in background?
│  └─ YES → Either works; shell_command simpler for this
│  └─ NO → Continue
│
├─ Does the operation read/write system state?
│  └─ YES (clipboard, window focus, state) → Command server preferred
│  └─ NO → Either works
│
└─ Final: Use command server if the function is registered in allowlist
   Otherwise: Use fallback shell_command
```

---

## Existing Endpoints

### 1. `layer_indicator` (primary)

**Purpose:** Show/hide the karabiner layer indicator UI in Hammerspoon.

**Payload format:**

```typescript
// Show a layer
{ "action": "show", "layer": "space" }

// Hide the indicator
{ "action": "hide" }

// Optional: add a marker for latency tracking in logs
{ "action": "show", "layer": "space", "marker": "rule_id_123" }
```

**Usage in rules:**

```typescript
import { layerIndicatorCommand } from "../core/scripts";

rule("Show layer indicator on activation").manipulators([
  map("space_key").to(layerIndicatorCommand("show", "space_layer")).build(),
  // ... other manipulators
]);
```

**Characteristics:**

- Ultra-low latency requirement (must be <500ms, typically 40–50ms)
- High frequency (fires on every layer activation/deactivation)
- Fire-and-forget (no state-change feedback needed)
- Hardened against Hammerspoon failures

---

### 2. `hammerspoon` (generic)

**Purpose:** Execute arbitrary Hammerspoon functions via a safe allowlist.

**Performance note:** The common helper functions now use optimized native implementations:

- `showNotification()` — Hammerspoon when available, falls back to `osascript` (~50ms)
- `focusApp()` — Native `open -b bundleId` (~10–30ms)
- `copyToClipboard()` — Native `pbcopy` stdin (~2–5ms)

You can still route through the Hammerspoon endpoint for custom behavior via `userCommand("hammerspoon", {...})`.

**Currently allowed functions:**

#### a. `showNotification`

Display a macOS notification.

```typescript
import { showNotification } from "../core/scripts";

map("key_x")
  .to(
    showNotification("Alert!", {
      subtitle: "Something important",
      informativeText: "More details here",
    }),
  )
  .build();
```

**Payload:**

```json
{
  "endpoint": "hammerspoon",
  "function": "showNotification",
  "args": {
    "title": "Required title",
    "subtitle": "Optional subtitle",
    "informativeText": "Optional details"
  }
}
```

#### b. `focusApp`

Bring an application to focus by bundle ID.

```typescript
import { focusApp } from "../core/scripts";

map("cmd", ["ctrl"]).with("n").to(focusApp("com.apple.Safari")).build();
```

**Payload:**

```json
{
  "endpoint": "hammerspoon",
  "function": "focusApp",
  "args": { "bundleId": "com.apple.Safari" }
}
```

#### c. `copyToClipboard`

Set clipboard contents.

```typescript
import { copyToClipboard } from "../core/scripts";

map("shift", ["ctrl"]).with("c").to(copyToClipboard("Predefined text")).build();
```

**Payload:**

```json
{
  "endpoint": "hammerspoon",
  "function": "copyToClipboard",
  "args": { "text": "Content to copy" }
}
```

---

## Extending the Command Server

### Adding a New Hammerspoon Function

#### Step 1: Verify safety

Before adding a function, ask:

- Can arguments be maliciously crafted? (Validate/sanitize.)
- Could the function have side effects? (Acceptable risk?)
- Is it deterministic? (No implicit external state.)

#### Step 2: Register in the server allowlist

Edit `scripts/layer_indicator_user_command_server.py`, `dispatch_hammerspoon()`:

```python
allowed_functions = {
    "showNotification": "showNotification",
    "focusApp": "focusApp",
    "copyToClipboard": "copyToClipboard",
    "myNewFunction": "myNewFunction",  # ← Add here
}
```

#### Step 3: Implement argument marshaling

The server serializes arguments to URL query parameters:

```python
# In dispatch_hammerspoon():
args_encoded = urllib.parse.urlencode({"args": json.dumps(args)})
url = f"hammerspoon://userCommand/{function}?{args_encoded}"
```

Your Hammerspoon receiver handler must deserialize. Example in `~/.hammerspoon/`:

```lua
function userCommandReceiver:userCommand(functionName, argsJson)
  local args = json.decode(argsJson)

  if functionName == "myNewFunction" then
    return myNewFunction(args)
  end
end
```

#### Step 4: Add a TypeScript helper

Edit `src/engine/resolve-to-action/resolve-script.ts`:

```typescript
export function myNewFunction(param1: string, param2?: number): ToEvent {
  return userCommand("hammerspoon", {
    function: "myNewFunction",
    args: { param1, param2 },
  });
}
```

#### Step 5: Test and document

- Test with `observability-bundle` to measure latency.
- Add an example to this guide.
- Update the `dispatch_hammerspoon()` docstring.

---

### Adding a New Endpoint Type

If your use case doesn't fit the "Hammerspoon function call" pattern, create a new endpoint:

#### Example: a `clipboard` endpoint that returns data

```python
# In layer_indicator_user_command_server.py:

def dispatch_clipboard(payload: dict[str, Any], dry_run: bool) -> float:
  """Handle clipboard read/write operations."""
  action = payload.get("action", "read")

  if action == "read":
    # Cannot easily return data over datagram socket.
    # Consider: write to a temp file, return path.
    pass
  elif action == "write":
    text = payload.get("text", "")
    subprocess.run(["pbcopy"], input=text.encode(), check=False)
```

For endpoints that need bidirectional communication, consider:

1. **Temp-file exchange** — write the result to `~/.config/karabiner/command_server/response-{marker}.json`.
2. **Return codes** — limited (0–255 range).
3. **Side effects** — write to log, clipboard, etc. instead of returning.
4. **A second socket** — spawn a response listener (more complex, not recommended).

Most use cases work well with fire-and-forget (the current model).

---

## Mouse Behaviors and the Command Server

The declarative mouse infrastructure lives in:

- `src/data/constants/devices.ts` — default mouse settings
- `src/data/primitives/devices.ts` — type definitions for mouse and keyboard devices
- `src/data/registries/buttons.ts` - button alias tables and device IDs
- `src/definitions/mouse.ts` — per-device tap-hold and double-tap mappings (the user edit surface)

Button tap-hold and double-tap mappings are fully supported there. Scroll-up/down chord triggers are not expressible as basic `from` events in Karabiner-Elements, so they live outside the rule pipeline. Use the command server or a Hammerspoon-side bridge for scroll-chord behaviours until a native declarative trigger path is available.

---

## Performance Tuning

### Measuring latency

Use the `smoke-check` command:

```bash
bash scripts/install-layer-indicator-user-command-server.sh smoke-check
# smoke-check: pass show_ms=49.39 hide_ms=45.71 max_allowed_ms=500.00
```

Or the bundled diagnostic:

```bash
bash scripts/install-layer-indicator-user-command-server.sh observability-bundle
```

### Tuning thresholds

Override latency limits when installing:

```bash
SMOKE_MAX_LATENCY_MS=1000 bash scripts/install-layer-indicator-user-command-server.sh smoke-check
```

### Why latency matters

- Karabiner processes key events with <10ms overhead.
- The layer indicator needs to follow visually instantly (<100ms).
- Shell-spawn background processes: ~150ms startup + execution.
- Command server: ~50ms (daemon already warm + socket I/O).

---

## Testing Command Server Rules

### Unit tests

Add tests under `src/tests/scripts.test.ts` style:

```typescript
import test from "node:test";
import { strict as assert } from "node:assert";
import { showNotification } from "../core/scripts";

test("showNotification emits correct payload structure", () => {
  const result = showNotification("Test", { subtitle: "Sub" });
  assert.match(JSON.stringify(result), /hammerspoon.*showNotification.*function/);
});
```

### Integration tests

Manually test with:

```bash
# 1. Start command server in background
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh install

# 2. Test individual commands
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh status

# 3. Test with bundled diagnostics
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh observability-bundle
```

### Logging

All commands are logged to:

```text
~/.config/karabiner/logs/layer-indicator-user-command-server.log
```

Example log line:

```text
2026-03-19 13:25:57,569 INFO dispatched action=show marker=space_layer_show elapsed_ms=49.39
```

---

## Fallback Behavior

When the command server is unavailable, helpers have configurable fallbacks:

**`layerIndicatorCommand()`:**

```typescript
// If server is down, falls back to:
cmd(`open -g 'hammerspoon://layer_indicator?action=show&layer=${layer}'`);
```

**`userCommand()` and other endpoints:**

```typescript
// No fallback available; logs warning
console.warn(`userCommand: endpoint 'hammerspoon' requires command server`);
return cmd('open -g "hammerspoon://noop"');
```

To ensure reliability:

1. Test `install-layer-indicator-user-command-server.sh status --json`.
2. Verify `socket_present: true` and `loaded: true`.
3. Run `observability-bundle` regularly to catch latency regressions.

---

## Troubleshooting

### Command server socket not responsive

```bash
# Check status
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh status

# Restart service
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh restart

# View recent logs
tail -f ~/.config/karabiner/logs/layer-indicator-user-command-server.log
```

### High latency (>200ms)

```bash
# Run periodic auto-rotate to keep logs manageable
bash scripts/layer-indicator/ install-layer-indicator-user-command-server.sh enable-auto-rotate

# Benchmark current state
bash scripts/layer-indicator/install-layer-indicator-user-command-server.sh smoke-check

# Check Hammerspoon responsiveness separately:
open -g 'hammerspoon://layer_indicator?action=show&layer=test'
```

### New function not working

1. Verify the function is in the `allowed_functions` dict.
2. Check the `observability-bundle` output for errors.
3. Validate the JSON payload format in the rule builder.
4. Test manually with a socket tool:

   ```bash
   echo '{"endpoint":"hammerspoon","function":"showNotification","args":{"title":"Test"}}' | nc -U /tmp/karabiner-layer-indicator.sock
   ```

---

## Summary: When to Use What

| Operation       | Best tool                       | Example                                   |
| --------------- | ------------------------------- | ----------------------------------------- |
| Layer show/hide | Command server (fast)           | Space bar indicator                       |
| Notifications   | Hybrid (Hammerspoon + fallback) | Key macro confirmations                   |
| App focus       | Native `open -b`                | Cmd+Alt+S → Safari                        |
| Clipboard       | Native `pbcopy`                 | Macro paste templates                     |
| Complex logic   | Shell command                   | Multi-step scripts, conditional execution |
| One-off launch  | Shell command                   | `open -a AppName`                         |
| Error handling  | Shell command                   | Check exit code, conditional flows        |

**Golden rule:** If you're calling Hammerspoon URL schemes from rules, migrate to the command server for better latency and maintainability.
