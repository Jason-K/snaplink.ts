## ExprTk Quick Reference — Karabiner `expression_if` / `expression_unless`

### Overview

`expression_if` and `expression_unless` conditionally trigger a manipulator based on
the evaluated result of an arithmetic expression. Designed for use with `set_variable`
and `--set-variables` (CLI).

```json
{
    "type": "expression_if",
    "expression": "command_q_expiration > system.now.milliseconds"
}
```

| Field        | Required     | Description                                 |
|--------------|--------------|---------------------------------------------|
| `type`       | **Required** | `"expression_if"` or `"expression_unless"`  |
| `expression` | **Required** | Target expression (exprtk syntax)           |

- `expression_if` — condition passes when expression evaluates **true** (non-zero)
- `expression_unless` — condition passes when expression evaluates **false** (zero)
- Undefined variables are treated as **0** (not a compile error, unlike raw exprtk)

---

### `set_variable`

Defines and updates variable values. Works with both `variable_if`/`variable_unless`
and `expression_if`/`expression_unless` conditions.

```json
{
    "to": [
        {
            "set_variable": {
                "name": "variable name",
                "value": value,
                "expression": expression,
                "key_up_value": value,
                "key_up_expression": expression,
                "type": "set"
            }
        }
    ]
}
```

| Field               | Required             | Description                      | Since   |
|---------------------|----------------------|----------------------------------|---------|
| `name`              | **Required**         | Target variable name             | 11.0.0  |
| `value`             | Required \| Optional | Target variable value            | 11.0.0  |
| `expression`        | Required \| Optional | Target expression (exprtk)       | 15.5.19 |
| `key_up_value`      | Optional             | Variable value on key up         | 14.12.6 |
| `key_up_expression` | Optional             | Expression evaluated on key up   | 15.5.19 |
| `type`              | Optional             | `"set"` or `"unset"`             | 14.99.2 |

Note: `value` may be omitted if `key_up_value` or `type` is specified.

#### Value types

| Type    | Examples                 |
|---------|--------------------------|
| integer | `0`, `1`, `2`            |
| boolean | `true`, `false`          |
| string  | `"layer1"`, `"layer2"`   |

#### `expression` and `key_up_expression`

Available since **15.5.19**. Undefined variables are treated as **0**.

---

### System-Provided Variables

| Variable                                          | Description                       |
|---------------------------------------------------|-----------------------------------|
| `system.now.milliseconds`                         | Current time in milliseconds      |
| `system.scroll_direction_is_natural`              | Natural scroll direction state    |
| `system.use_fkeys_as_standard_function_keys`      | Fn key mode state                 |
| `accessibility.focused_ui_element.role_string`    | Role of the focused UI element    |
| `accessibility.*`                                 | Other accessibility state vars    |

Inspect current values in **EventViewer → Variables**.

---

### Canonical Examples

#### Double-press Command+Q

```json
{
    "description": "Prevent unintended Command+Q presses by ignoring it unless it's double-pressed",
    "manipulators": [
        {
            "type": "basic",
            "from": {
                "key_code": "q",
                "modifiers": { "mandatory": ["command"], "optional": ["any"] }
            },
            "to": [
                { "key_code": "q", "modifiers": ["command"] }
            ],
            "conditions": [
                {
                    "type": "expression_if",
                    "expression": "command_q_expiration > system.now.milliseconds"
                }
            ]
        },
        {
            "type": "basic",
            "from": {
                "key_code": "q",
                "modifiers": { "mandatory": ["command"], "optional": ["any"] }
            },
            "to": [
                {
                    "set_variable": {
                        "name": "command_q_expiration",
                        "expression": "system.now.milliseconds + 300"
                    }
                }
            ]
        }
    ]
}
```

**Pattern:** first press sets expiration 300ms ahead; second press within window
satisfies `expression_if` and fires the action.

#### Double-press right_shift → Mission Control (available since 15.5.19)

Combines `expression_if`, `set_variable` with `expression`, and `to_delayed_action`.

```json
{
    "description": "Change right_shift x2 to mission_control (new style)",
    "manipulators": [
        {
            "type": "basic",
            "from": {
                "key_code": "right_shift",
                "modifiers": { "optional": ["any"] }
            },
            "to": [
                { "apple_vendor_keyboard_key_code": "mission_control" },
                { "key_code": "vk_none" }
            ],
            "conditions": [
                {
                    "type": "expression_if",
                    "expression": "right_shift_x2_expiration > system.now.milliseconds"
                }
            ]
        },
        {
            "type": "basic",
            "from": {
                "key_code": "right_shift",
                "modifiers": { "optional": ["any"] }
            },
            "to": [
                {
                    "set_variable": {
                        "name": "right_shift_x2_expiration",
                        "expression": "system.now.milliseconds + 300"
                    }
                },
                { "key_code": "right_shift" }
            ]
        }
    ]
}
```

#### Open files in Finder with Return key

Uses `accessibility.focused_ui_element.role_string` to suppress the remap during
text input (rename, search). Combines `frontmost_application_if` with `expression_unless`.

```json
{
    "description": "Open files in Finder using the return key",
    "manipulators": [
        {
            "type": "basic",
            "from": {
                "key_code": "return_or_enter",
                "modifiers": { "optional": ["caps_lock"] }
            },
            "to": [
                { "key_code": "o", "modifiers": ["left_command"] }
            ],
            "conditions": [
                {
                    "type": "frontmost_application_if",
                    "bundle_identifiers": ["^com\\.apple\\.finder$"]
                },
                {
                    "type": "expression_unless",
                    "expression": "accessibility.focused_ui_element.role_string like 'AXText*'"
                }
            ]
        }
    ]
}
```

**Pattern:** `expression_unless` with a `like` string match blocks the remap whenever
focus is in any `AXText*` role element (text field, search box, rename field).

#### Toggle a flag

```json
{
    "set_variable": {
        "name": "my_flag",
        "expression": "my_flag != 0 ? 0 : 1"
    }
}
```

#### Hold-key state via key_up_value

```json
{
    "set_variable": {
        "name": "escape_pressed",
        "value": true,
        "key_up_value": false
    }
}
```

---

### exprtk Syntax Reference

#### Types
- **Scalar** (numeric), **String** (single-quoted) — scalars cover all Karabiner numeric conditions

#### Operators
| Category   | Operators                              |
|------------|----------------------------------------|
| Arithmetic | `+ - * / % ^`                          |
| Comparison | `== != < <= > >=`                      |
| Logic      | `and or not` (also `&&` / `\|\|`)      |
| Assignment | `:=` (also `+= -= *= /=`)              |
| Ternary    | `condition ? consequent : alternative` |

#### Key Built-ins
```cpp
abs(x)         min(x,y)       max(x,y)
clamp(lo,x,hi) floor(x)       ceil(x)
round(x)       frac(x)        trunc(x)
sin/cos/tan    log(x)         sqrt(x)
```

#### Variables & Locals
```cpp
var x := 3;
var y := abs(x - 8);
```
- Names: `[a-zA-Z][a-zA-Z0-9_]*` — case-insensitive
- In raw exprtk, undefined symbols → compile error; in Karabiner, undefined → 0

#### Control Flow
```cpp
// Ternary (preferred for inline conditions)
x > 2 ? y : z

// If-else
if (x > 0) { y := 1; } else { y := -1; }

// For loop (avoid in Karabiner — evaluation overhead)
for (var i := 0; i < n; i += 1) { ... }
```

#### Multi-statement (last value is return value)
```cpp
var temp := x;
x := y;
y := temp;
x + y          // ← this is what the expression returns
```

---

### String Operations

#### Equality / Inequality (case-sensitive)
```cpp
s == 'abc'
s != 'abc'
s <  'abc'      // lexicographic
s <= 'abc'
s >  'abc'
s >= 'abc'
```

#### Substring & Pattern Matching
```cpp
'sub' in s               // true if 'sub' appears anywhere in s
s like '*foo*'           // wildcard: * = zero or more chars
s like 'a?c'             // ? = exactly one char
s ilike '*Foo*'          // case-insensitive wildcard
```

Karabiner usage — test UI element role:
```cpp
accessibility.focused_ui_element.role_string like 'AXText*'
accessibility.focused_ui_element.role_string == 'AXTextField'
```

#### Ranges (slicing)
```cpp
s[1:4]       // chars at index 1–4 inclusive (0-based)
s[:4]        // from start through index 4
s[2:]        // from index 2 to end
s[:]         // full string copy
```
Range bounds are integers; fractional values are truncated.

#### Concatenation & Append
```cpp
s0 + s1                  // concatenate
s0 + 'literal'
s0 += ' appended'        // in-place append
```

#### Assignment
```cpp
s := 'new value'
s := s0[1:3]             // assign slice
s[i:j] := 'xyz'          // overwrite range (shorter range wins)
```

#### Size Operator
```cpp
s[]          // returns length of s as scalar
'hello'[]    // == 5
```

#### Swap
```cpp
s0 <=> s1    // swap values of two string variables
```

#### String Gotchas
- All comparisons are **case-sensitive** except `ilike`
- Strings **cannot interact with scalars** — no `s + x` where x is numeric
- Range `[r0:r1]` requires `r0 <= r1`; both bounds optional (default to 0 / end)
- `like`/`ilike` patterns: only `*` and `?` are wildcards — no regex
- String variables must be declared with an initializer: `var s := '';`
- Empty string is valid: `'' == s` works as expected

---

### Practical Karabiner Patterns

**Timing window (double-press, hold detection):**
```cpp
expiration_var > system.now.milliseconds
```

**Set expiration timestamp:**
```cpp
system.now.milliseconds + 300
```

**Toggle boolean:**
```cpp
my_flag != 0 ? 0 : 1
```

**Suppress remap during text input:**
```cpp
// expression_unless — fires only when focus is NOT in a text field
accessibility.focused_ui_element.role_string like 'AXText*'
```

**Known AXRole values for text input:**

| Role              | Context                        |
|-------------------|--------------------------------|
| `AXTextField`     | Single-line text field         |
| `AXTextArea`      | Multi-line text area           |
| `AXSearchField`   | Search box                     |
| `AXComboBox`      | Combo box with text input      |

Use `like 'AXText*'` to match all text-input roles in one expression.

**Threshold guard:**
```cpp
modifier_count > 0 and key_code != 0
```

**Clamped value:**
```cpp
clamp(0, repeat_count - 1, 5)
```

**State machine check:**
```cpp
(mode == 1 and layer == 2) ? action_a : action_b
```

**Null/NaN behavior** (when vars are unset — Karabiner treats as 0):
```cpp
null == x   // true — null equals anything
null + x    // returns x
```

---

### General Gotchas
- **Semicolons required** between statements; missing `;` triggers implied multiplication
- **`:=` not `=`** for assignment; `=` and `==` both mean equality
- **Compile once, evaluate many times** — don't rebuild expression objects per keypress
- **Strength reduction** (`2*x - 2*y → 2*(x-y)`) is on by default; disable if near numeric limits
- `true` → 1, `false` → 0

--- 

### References

[Full ExprTk README, local copy](exprtk-readme.md)
[ExprTk README, remote](https://www.partow.net/programming/exprtk/readme.html)
[ExprTk homepage, remote](https://www.partow.net/programming/exprtk/index.html)