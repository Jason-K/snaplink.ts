# Karabiner-Elements: compiled gotchas and developer notes

Every item is traceable to a source. Citations use these prefixes:

- `docs:<path>` — `pqrs-org/pqrs.org`, `sites/karabiner-elements/content/en/docs/<path>`
- `src:<path>` — `pqrs-org/Karabiner-Elements`, `<path>`

Items marked **[UNDOCUMENTED]** come from the parser source only and do not appear in
the published documentation. Treat them as accurate but unsupported.

Compiled 2026-08-12 against `main` of both repositories.

---

## 1. Dangerous — can leave the machine unusable

| # | Note | Source |
|---|------|--------|
| 1.1 | `"pointing_button": "button1"` and `"any": "pointing_button"` in `from` can cost you the left click and leave the system unusable. | `docs:json/complex-modifications-manipulator-definition/from/_index.md`, `.../from/any/index.md` |
| 1.2 | `mouse_basic` with `discard` must be scoped with `conditions` (e.g. `device_if`), or the cursor can become completely unmovable. | `docs:.../other-types/mouse-basic/_index.md` |
| 1.3 | `mouse_motion_to_scroll` without `from.modifiers` **and** without `conditions` converts all pointer motion to scrolling permanently — the mouse becomes unusable. | `docs:.../other-types/mouse-motion-to-scroll/_index.md` |

Keep a second input device or a Karabiner-free login path available when testing these.

## 2. Evaluation order and rule interaction

| # | Note | Source |
|---|------|--------|
| 2.1 | Manipulators are evaluated top to bottom; **only the first matching manipulator applies**. Later manipulators touching the same key are ignored. | `docs:json/complex-modifications-manipulator-evaluation-priority/index.md` |
| 2.2 | Simple Modifications are applied **before** Complex Modifications, and the two are independent. A key changed by Simple Modifications enters Complex Modifications as the *new* key. Example: Simple `right_shift → right_command`, Complex `right_command → right_command + right_option` yields `right_command + right_option`. | `docs:json/complex-modifications-manipulator-evaluation-priority/index.md` |
| 2.3 | Once an event has been modified it is exempt from subsequent rules. This is the mechanism behind pass-through mode: match early with `from.any` + `to.from_event` and every later rule is effectively disabled. | `docs:.../to/from-event/index.md` |
| 2.4 | A pass-through rule does **not** disable Simple Modifications. To disable those too, migrate them into Complex Modifications and place them *after* the pass-through rule. | `docs:.../to/from-event/index.md` |
| 2.5 | `event_changed_if` / `event_changed_unless` used in Complex Modifications causes the rule to be skipped for keys that were changed by Simple Modifications. `event_changed_unless` exists mainly to stop Function Keys Modifications from re-changing fx keys already changed in Complex Modifications. | `docs:.../conditions/event-changed/index.md` |

## 3. `from` — modifiers

| # | Note | Source |
|---|------|--------|
| 3.1 | `mandatory` modifiers are **consumed** — they are removed from the `to` events. `optional` modifiers are **kept** and passed through. | `docs:.../from/modifiers/index.md` |
| 3.2 | Without `"optional": ["any"]`, the manipulator will not fire when *any* extra modifier is held. This is the single most common cause of "my rule doesn't fire". | `docs:.../from/modifiers/index.md` |
| 3.3 | With no `modifiers` key at all, the rule fires only when no modifiers are held — including `caps_lock`. | `docs:.../from/modifiers/index.md` |
| 3.4 | In `from.modifiers`, `command`/`control`/`option`/`shift` mean **either side**. In `to.modifiers`, the same names are aliases of the **left** variants only. Same spelling, different meaning. | `docs:.../from/modifiers/index.md`, `docs:.../to/modifiers/index.md` |
| 3.5 | `caps_lock` as a mandatory modifier will get toggled off unless handled. Either add `caps_lock` to `to.modifiers` (preferred, more stable), or explicitly toggle caps_lock off and back on in `to` with `hold_down_milliseconds: 200`. | `docs:.../from/modifiers/index.md` |
| 3.6 | Aliases `left_alt`, `left_gui`, `right_alt`, `right_gui` require KE 12.3.0+. | `docs:.../from/modifiers/index.md` |
| 3.7 | **[UNDOCUMENTED]** `modifiers.mandatory` / `modifiers.optional` accept a bare string as well as an array (`"mandatory": "right_shift"`). Used in the official `mouse_key` examples but never stated. | `src:src/share/manipulator/types/modifier_definition.hpp` |
| 3.8 | **[UNDOCUMENTED]** `"any"` is accepted in `to.modifiers` but maps to no modifier flag — it is silently a no-op there. | `src:src/share/manipulator/types/modifier_definition.hpp` |

## 4. `from` — event keys, `any`, `simultaneous`, `integer_value`

| # | Note | Source |
|---|------|--------|
| 4.1 | `key_code`, `consumer_key_code`, `pointing_button` and `any` are mutually exclusive; exactly one must be specified. | `docs:.../from/_index.md` |
| 4.2 | Key codes may be given as raw numbers — **without quotes** (`"key_code": 41`). Quoting a number is an error. | `docs:.../from/_index.md`, `docs:.../to/_index.md` |
| 4.3 | `simultaneous` requires all `from` keys to be pressed within `basic.simultaneous_threshold_milliseconds` (default 50 ms). | `docs:.../from/simultaneous/index.md` |
| 4.4 | `simultaneous` does **not** fire if any `from` key is released before all are pressed, or if the sequence is interrupted by another key_down (unless `detect_key_down_uninterruptedly` is true). | `docs:.../from/simultaneous/index.md`, `.../from/simultaneous-options/index.md` |
| 4.5 | For `simultaneous`, key_up is posted when *any* `from` key is released (default `key_up_when: any`). | `docs:.../from/simultaneous/index.md` |
| 4.6 | `key_up_order` is ignored once `simultaneous_threshold_milliseconds` elapses — raise that parameter substantially (the docs' example uses 500) when relying on `key_up_order`. | `docs:.../from/simultaneous-options/index.md` |
| 4.7 | With `key_up_order`, events are posted just before the *last* `from` key's key_up. | `docs:.../from/simultaneous-options/index.md` |
| 4.8 | `simultaneous_options.to_after_key_up` fires when all `from` events are released — the standard place to clear mode-flag variables. | `docs:.../from/simultaneous-options/index.md` |
| 4.9 | `from.integer_value` is only for devices that distinguish buttons by integer value (e.g. VEC USB Footpedal INFINITY USB-3). Values that change mid-press are unsupported: the value is read from the first button pressed, so Left+Middle (which reports 3) evaluates as 1. | `docs:.../from/integer-value/index.md` |
| 4.10 | **[UNDOCUMENTED]** `apple_vendor_keyboard_key_code`, `apple_vendor_top_case_key_code` and `generic_desktop` are valid event keys in both `from` and `to`. `generic_desktop` appears nowhere in the docs; the first two appear only inside examples. | `src:src/share/manipulator/types/event_definition.hpp` |
| 4.11 | **[UNDOCUMENTED]** `from.any` also accepts `"apple_vendor_keyboard_key_code"` and `"apple_vendor_top_case_key_code"`, not just the three documented values. | `src:src/share/manipulator/types/event_definition.hpp` |
| 4.12 | **[UNDOCUMENTED]** `description` is accepted inside `from` and `to` event definitions (and inside `simultaneous_options`), not only at manipulator level. | `src:src/share/manipulator/types/event_definition.hpp`, `src:src/share/manipulator/manipulators/basic/simultaneous_options.hpp` |

## 5. `to` — structure and exclusivity

| # | Note | Source |
|---|------|--------|
| 5.1 | These keys are mutually exclusive within one `to` entry: `key_code`, `consumer_key_code`, `pointing_button`, `shell_command`, `select_input_source`, `set_variable`, `mouse_key`, `sticky_modifier`, `software_function`. One entry, one action. | `docs:.../to/_index.md` |
| 5.2 | `software_function` requires KE 13.5.1+. | `docs:.../to/_index.md` |
| 5.3 | Some keys (notably `mission_control`) act on key_up, so press-and-hold then release re-closes what was just opened. Append `{"key_code": "vk_none"}` to send key_down+key_up at press time; no event then fires on release. | `docs:.../to/_index.md` |
| 5.4 | `to.lazy` on a modifier suppresses its key events until another key is pressed with it. Designed for use with `to_if_alone` and for combos like `left_control + h → delete_or_backspace`. | `docs:.../to/lazy/index.md` |
| 5.5 | `to.repeat` defaults to **true**. It also changes timing: with `repeat: true`, key_up is sent on physical release; with `repeat: false`, key_down and key_up are both sent at press time. Set `repeat: false` on the *last* event of a string-typing sequence to avoid "hellooooooo". | `docs:.../to/repeat/index.md` |
| 5.6 | `to.halt` belongs in `to_if_alone` or `to_if_held_down`; it cancels the subsequent `to_after_key_up` / `to_delayed_action`. | `docs:.../to/halt/index.md`, `docs:.../to-if-held-down/_index.md` |
| 5.7 | `hold_down_milliseconds` is the gap between key_down and key_up when both are sent at once. `caps_lock` needs roughly 200 ms. | `docs:.../to/hold-down-milliseconds/index.md` |
| 5.8 | When using `hold_down_milliseconds` with caps_lock, `vk_none` is required to swallow the hardware key_up — without it, key_down/key_up pairs are emitted per hardware event and the delay never applies. | `docs:.../to/hold-down-milliseconds/index.md` |
| 5.9 | `to.conditions` requires KE 15.3.7+ and is for narrow cases only; for "enable only in Finder" use manipulator-level `conditions` instead. | `docs:.../to/to-conditions/index.md` |
| 5.10 | `to.conditions` are evaluated **once, before the first event in the `to` array is processed**. A `set_variable` earlier in the same `to` array is *not* visible to a later entry's condition. | `docs:.../to/to-conditions/index.md` |
| 5.11 | **[UNDOCUMENTED]** `to`, `to_if_alone`, `to_if_held_down`, `to_after_key_up`, `to_delayed_action.to_if_invoked`, `to_delayed_action.to_if_canceled` and `simultaneous_options.to_after_key_up` each accept **a single object or an array**. | `src:src/share/manipulator/manipulators/basic/basic.hpp`, `.../to_if_held_down.hpp`, `.../to_delayed_action.hpp`, `.../simultaneous_options.hpp` |
| 5.12 | **[UNDOCUMENTED]** `held_down_milliseconds` is accepted as an alias of `hold_down_milliseconds`. | `src:src/share/manipulator/types/to_event_definition.hpp` |
| 5.13 | **[UNDOCUMENTED]** `to_if_other_key_pressed` is the exception to 5.11: its entries' `other_keys` and `to` must be arrays, and the entry rejects a `description` key. | `src:src/share/manipulator/manipulators/basic/to_if_other_key_pressed.hpp` |

## 6. `to` — specific actions

| # | Note | Source |
|---|------|--------|
| 6.1 | `shell_command` runs with a very limited environment (`$HOME`, `$UID`, `$USER`, ...). Locale-sensitive commands (e.g. `tr` on Unicode) misbehave unless you export `LC_ALL` inside the command string. | `docs:.../to/shell-command/index.md` |
| 6.2 | `select_input_source` may fail for input sources with an `input_mode_id` (Chinese, Japanese, Korean, Vietnamese) due to a macOS issue. Send the OS input-source shortcut instead for CJKV. | `docs:.../to/select-input-source/index.md` |
| 6.3 | `set_variable` value types are strict: `1 != true` and `true != "true"`. Comparing across types never matches. | `docs:.../conditions/variable/index.md` |
| 6.4 | An unset variable evaluates as `0` in both conditions and expressions. | `docs:.../conditions/variable/index.md`, `.../conditions/expression/index.md` |
| 6.5 | `set_variable` version floors: `value` 11.0.0; boolean/string values 14.4.20; `key_up_value` 14.12.6; `type: "unset"` 14.99.2; `expression` / `key_up_expression` 15.5.19. | `docs:.../to/set-variable/index.md` |
| 6.6 | `value` may be omitted when `key_up_value` or `type` is specified. | `docs:.../to/set-variable/index.md` |
| 6.7 | Expressions use exprtk syntax and may read `system.now.milliseconds`, `system.scroll_direction_is_natural`, `system.use_fkeys_as_standard_function_keys`. | `docs:.../to/set-variable/index.md` |
| 6.8 | `set_notification_message` must be cleared explicitly — set `text` to an empty string with the same `id`. A forgotten message stays on screen indefinitely. `duration_milliseconds` (KE 16.1.18+) is the only auto-dismiss. | `docs:.../to/set-notification-message/index.md` |
| 6.9 | `sticky_modifier` takes exactly one modifier per entry; use multiple `to` entries for multiple sticky modifiers. `toggle` suits most cases. Supported: the eight left/right modifiers plus `fn`. | `docs:.../to/sticky-modifier/index.md` |
| 6.10 | `mouse_key` speed and scroll direction depend on System Settings > Mouse. Sign conventions differ per axis: `horizontal_wheel > 0` scrolls **left**, while `vertical_wheel > 0` scrolls **down**. | `docs:.../to/mouse-key/index.md` |
| 6.11 | `cg_event_double_click` is software-generated and laggy; sending `pointing_button: button1` twice is better. It also requires Accessibility permission for `karabiner_console_user_server`. | `docs:.../to/software_function/cg_event_double_click/index.md` |
| 6.12 | When `cg_event_double_click` follows a `from.modifiers.mandatory`, insert `{"key_code": "vk_none", "hold_down_milliseconds": 100}` first to let the mandatory modifier release. Not needed when no mandatory modifier is used. | `docs:.../to/software_function/cg_event_double_click/index.md` |
| 6.13 | `open_application` requires exactly one of `bundle_identifier` (priority 1), `file_path` (2), `frontmost_application_history_index` (3). When several are given, the highest priority wins and the rest are **silently ignored**. | `docs:.../to/software_function/open_application/index.md` |
| 6.14 | `frontmost_application_history_index` is 1-based; only currently running apps launched **after** Karabiner-Elements started are candidates. Apps opened by any means (Launchpad etc.) count. Exclusion filters are regexes and require KE 15.7.3+. | `docs:.../to/software_function/open_application/index.md` |
| 6.15 | `iokit_power_management_sleep_system` requires KE 13.7.1+; `delay_milliseconds` defaults to 500. | `docs:.../to/software_function/iokit_power_management_sleep_system/index.md` |
| 6.16 | `set_mouse_cursor_position` accepts either an integer point or a percent string (`"50%"`). | `docs:.../to/software_function/set_mouse_cursor_position/index.md` |
| 6.17 | **[UNDOCUMENTED]** `set_mouse_cursor_position` also accepts `relative_to` (`"screen"` default, or `"focused_window"`) and `fallback_to` (`"none"` default, or `"screen"`). | `src:src/share/types/software_function_details/set_mouse_cursor_position.hpp` |
| 6.18 | `send_user_command` needs an external UNIX-domain **datagram** server. Default socket: `/Library/Application Support/org.pqrs/tmp/user/{UID}/user_command_receiver.sock`; override with `endpoint`. The payload arrives JSON-serialized. | `docs:.../to/send-user-command/index.md` |

## 7. `to_if_alone`, `to_if_held_down`, `to_if_other_key_pressed`, `to_delayed_action`

| # | Note | Source |
|---|------|--------|
| 7.1 | `to_if_alone` fires on **release**, and is cancelled by any other key, button, or scroll event while `from` is held. | `docs:.../to-if-alone/_index.md` |
| 7.2 | `to_if_alone` is also cancelled by holding longer than `basic.to_if_alone_timeout_milliseconds` (default 1000). | `docs:.../to-if-alone/_index.md` |
| 7.3 | `to_if_alone` posts key_down and key_up together, so **key repeat is impossible** for those events. | `docs:.../to-if-alone/_index.md` |
| 7.4 | For the same reason, sending `caps_lock` from `to_if_alone` requires `hold_down_milliseconds` (caps_lock needs to be held). | `docs:.../to-if-alone/_index.md` |
| 7.5 | If `to` events exist, the `to` key_up is sent *before* `to_if_held_down` events are posted. | `docs:.../to-if-held-down/_index.md` |
| 7.6 | `to_if_held_down` inherently fires *after* keys pressed subsequently, so events can arrive out of typing order. For hold-to-modify on letter keys, combine `to_if_alone` + `halt` with `to_delayed_action.to_if_canceled`. | `docs:.../to-if-held-down/_index.md` |
| 7.7 | Remapping `option+tab → command+tab` via `from.modifiers.mandatory` is a known bad pattern: only the `tab` output changes, so pressing another modifier afterwards releases `left_command` and the app switcher closes. Use `to_if_other_key_pressed` to rewrite the modifier key itself. | `docs:.../to-if-other-key-pressed/_index.md` |
| 7.8 | `to_delayed_action` fires `basic.to_delayed_action_delay_milliseconds` (default 500) after `from` is pressed: `to_if_invoked` when nothing else was pressed, `to_if_canceled` when another key intervened. Typical uses are double-tap and two-stroke (Emacs C-x) bindings. | `docs:.../to-delayed-action/_index.md` |
| 7.9 | `to_after_key_up` fires on release; its usual jobs are unsetting variables and providing the fallback branch alongside `to_if_held_down` + `halt`. | `docs:.../to-after-key-up/_index.md` |

## 8. Conditions

| # | Note | Source |
|---|------|--------|
| 8.1 | Within one `identifiers` / `input_sources` entry, keys are ANDed. Across entries in the array, they are ORed. Same for `bundle_identifiers`, `file_paths` and `keyboard_types` (OR). | `docs:.../conditions/device/index.md`, `.../input-source/index.md`, `.../frontmost-application/index.md`, `.../keyboard-type/index.md` |
| 8.2 | `bundle_identifiers` and `file_paths` are **regexes** — dots must be escaped, and in JSON that means double backslashes: `"^com\\\\.apple\\\\.Terminal$"`. | `docs:.../conditions/frontmost-application/index.md` |
| 8.3 | `location_id` changes when the device is plugged into a different USB port — unstable as an identifier. | `docs:.../conditions/device/index.md` |
| 8.4 | `device_address` (Bluetooth MAC, KE 14.12.2+) changes when the hardware is replaced. | `docs:.../conditions/device/index.md` |
| 8.5 | Device condition version floors: `device_exists_if` / `device_exists_unless` 14.8.4; `is_built_in_keyboard` 14.8.2; `is_game_pad` 14.12.4; `is_consumer` 15.3.18. | `docs:.../conditions/device/index.md` |
| 8.6 | `keyboard_type_if` refers to the **virtual** keyboard type (ansi/iso/jis) configured in Karabiner, not the physical device. Note that `[` is `close_bracket` on JIS. | `docs:.../conditions/keyboard-type/index.md` |
| 8.7 | System variables and their floors: `system.scroll_direction_is_natural` and `system.use_fkeys_as_standard_function_keys` 15.2.3; `system.now.milliseconds` 15.5.19; `system.temporarily_ignore_all_devices` 15.5.91. Accessibility variables (`accessibility.focused_ui_element.*`): window geometry 15.90.17, role/subrole/title strings 15.90.22. | `docs:.../conditions/variable/index.md` |
| 8.8 | **[UNDOCUMENTED]** `device` condition identifiers also accept `is_virtual_device`. | `src:src/share/types/device_identifiers.hpp` |

## 9. Parameters

| # | Note | Source |
|---|------|--------|
| 9.1 | Parameters may be set at profile `complex_modifications` level and overridden per manipulator. | `docs:json/root-data-structure/index.md`, `docs:.../to-if-alone/_index.md` |
| 9.2 | **[UNDOCUMENTED]** Defaults and clamps: `basic.simultaneous_threshold_milliseconds` 50 (clamped 0–1000); `basic.to_if_alone_timeout_milliseconds` 1000 (≥0); `basic.to_if_held_down_threshold_milliseconds` 500 (≥0); `basic.to_delayed_action_delay_milliseconds` 500 (≥0); `mouse_motion_to_scroll.speed` 100 (clamped 1–10000, divided by 100 at runtime). | `src:src/share/core_configuration/details/profile/complex_modifications_parameters.hpp` |
| 9.3 | **[UNDOCUMENTED]** Out-of-range values are **clamped with a log warning**, not rejected. Unrecognized parameter names are silently ignored — a typo like `basic.to_if_alone_threshold_milliseconds` (real, in the published `vim_mode_plus` rule) never takes effect and never errors. | `src:src/share/core_configuration/details/profile/complex_modifications_parameters.hpp` |

## 10. File and format

| # | Note | Source |
|---|------|--------|
| 10.1 | `karabiner.json` tolerates `//` and `/* */` comments, but **every comment is lost** once the Settings UI or menu writes the file. | `docs:json/root-data-structure/index.md` |
| 10.2 | A custom `*.json` in `~/.config/karabiner/assets/complex_modifications/` is what makes rules individually enableable in the UI. It requires `title` and `rules`. | `docs:json/root-data-structure/index.md` |
| 10.3 | Karabiner does not provide virtual modifiers. Emulate them with a variable set in `to` and cleared in `to_after_key_up`. | `docs:json/extra/virtual-modifier/index.md` |
| 10.4 | Key, button, device, input-source and frontmost-application identifiers are all discoverable in EventViewer (Main / Devices / Variables / Frontmost Application tabs). | `docs:.../from/_index.md`, `.../conditions/*/index.md` |
| 10.5 | Unknown keys at file and rule level are ignored by Karabiner; third-party generators add their own (`version`, `repo`, `maintainer`, `enabled`, `_comment`, ...). Inside `manipulators`, unknown keys are hard errors. | `src:src/share/manipulator/manipulators/basic/basic.hpp` |
