# Karabiner Documentation Sync & Diff Summary

**Generated at:** `2026-09-01T23:54:12.433Z`  
**Sources:**

- Lifecycle Reference: [Karabiner-Elements Keybinding Lifecycle](https://raw.githubusercontent.com/pqrs-org/Karabiner-Elements/main/docs/karabiner-keybinding-lifecycle.md)
- Upstream JSON Docs: [pqrs.org docs/json](https://github.com/pqrs-org/pqrs.org/tree/main/sites/karabiner-elements/content/en/docs/json)

## Summary Stats

| Status                   | Count |
| :----------------------- | :---- |
| 🟢 **Added (New Files)** | 13    |
| 🟡 **Modified**          | 24    |
| ⚪ **Unchanged**         | 32    |
| **Total Synced**         | 69    |

## 🟢 Added Files

- `docs/karabiner_refs/karabiner-keybinding-lifecycle.md` (7063 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/device/images/eventviewer-devices@2x.png` (243815 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/expression/images/eventviewer-variables@2x.png` (127795 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/frontmost-application/images/eventviewer-frontmost-application@2x.png` (315480 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/input-source/images/eventviewer-input-source-identifiers@2x.png` (223176 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/variable/images/eventviewer-variables@2x.png` (127795 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous/images/karabiner-elements-simultaneous_threshold_milliseconds@2x.png` (72673 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/select-input-source/images/eventviewer-input-source-identifiers@2x.png` (128889 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/set-notification-message/images/set-notification-message@2x.png` (17126 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/set-variable/images/eventviewer-variables@2x.png` (127795 bytes)
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/cg_event_double_click/images/karabiner_console_user_server_accessibility@2x.png` (53984 bytes)
- `docs/karabiner_docs/external-json-generators/index.md` (1205 bytes)
- `docs/karabiner_docs/extra/multitouch-extension/images/karabiner-elements-eventviewer-variables@2x.png` (127795 bytes)

## 🟡 Modified Files

### `docs/karabiner_docs/complex-modifications-manipulator-definition/_index.md`

- Size before: 2440 bytes, Size after: 2973 bytes

````diff
- ______________________________________________________________________
+ ---
+ title: 'complex_modifications manipulator definition'
+ weight: 500
+ ---
- ## title: 'complex_modifications manipulator definition' weight: 500
-
- | Name | Required | Description |
+ {{< parameter-table >}}
- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- |
- | `type` | **Required** | `"basic"` is specified |
- | [`from`](from/) | **Required** | The name of key code, consumer key code or pointing button which you want to change |
- | [`to`](to/) | Optional | Events which are sent when you press `from` key |
- | [`to_if_alone`](to-if-alone/) | Optional | Events which are sent when you press `from` key alone |
- | [`to_if_held_down`](to-if-held-down/) | Optional | Events which are sent when you hold down `from` key |
- | [`to_if_other_key_pressed`](to-if-other-key-pressed/) | Optional | Events which are sent when you press other keys with `from` key |
- | [`to_after_key_up`](to-after-key-up/) | Optional | Events which are sent after you release `from` key |
- | [`to_delayed_action`](to-delayed-action/) | Optional | Events which are sent after 500 milliseconds at you press `from` key |
- | [`conditions`](conditions/) | Optional | Manipulator is applied only if condition is matched (e.g., the frontmost application) |
- | `parameters` | Optional | Override parameters such as `to_if_alone_timeout_milliseconds` |
- | `description` | Optional | A human-readable comment |
+ ```json
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"basic\"` is specified"
+     },
+     {
+         "name": "[`from`](from/)",
+         "required": true,
+         "description": "The name of key code, consumer key code or pointing button which you want to change"
+     },
+     {
+         "name": "[`to`](to/)",
+         "required": false,
+         "description": "Events which are sent when you press `from` key"
+     },
+     {
+         "name": "[`to_if_alone`](to-if-alone/)",
+         "required": false,
+         "description": "Events which are sent when you press `from` key alone"
+     },
+     {
+         "name": "[`to_if_held_down`](to-if-held-down/)",
+         "required": false,
+         "description": "Events which are sent when you hold down `from` key"
+     },
+     {
+         "name": "[`to_if_other_key_pressed`](to-if-other-key-pressed/)",
+         "required": false,
+         "description": "Events which are sent when you press other keys with `from` key"
+     },
+     {
+         "name": "[`to_after_key_up`](to-after-key-up/)",
+         "required": false,
+         "description": "Events which are sent after you release `from` key"
+     },
+     {
+         "name": "[`to_delayed_action`](to-delayed-action/)",
+         "required": false,
+         "description": "Events which are sent after 500 milliseconds at y
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/device/index.md`

- Size before: 6284 bytes, Size after: 5719 bytes

````diff
- | Name          | Required     | Description                                                                            |
+ {{< parameter-table >}}
- | ------------- | ------------ | -------------------------------------------------------------------------------------- |
- | `type`        | **Required** | `"device_if"` or `"device_unless"` or `"device_exists_if"` or `"device_exists_unless"` |
- | `identifiers` | **Required** | Target device definitions                                                              |
- | `description` | Optional     | A human-readable comment                                                               |
+ ```json
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"device_if\"` or `\"device_unless\"` or `\"device_exists_if\"` or `\"device_exists_unless\"`"
+     },
+     {
+         "name": "`identifiers`",
+         "required": true,
+         "description": "Target device definitions"
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
- | Type                   | Description                                                | Available since           |
+ {{< parameter-table name-header="Type" >}}
- | ---------------------- | ---------------------------------------------------------- | ------------------------- |
- | `device_if`            | Valid only for devices specified in identifiers            | Karabiner-Elements 11.0.0 |
- | `device_unless`        | Valid only for devices other than specified in identifiers | Karabiner-Elements 11.0.0 |
- | `device_exists_if`     | Valid if a specified device is connected                   | Karabiner-Elements 14.8.4 |
- | `device_exists_unless` | Valid unless a specified device is connected               | Karabiner-Elements 14.8.4 |
- ### `identifiers`
-
- `identifiers` is an array of objects.
-
- | Name                   | Required | Description                                                                                                                                         | Fixed Value |
- | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
- | `vendor_id`            | Optional | Vendor ID of device                                                                                                                                 | Yes         |
- | `product_id`           | Optional | Product ID of device                                                                                                                                | Yes         |
- | `device_address`       | Optional | Bluetooth address (Bluetooth MAC address) of device <br />(only available for Bluetooth devices) <br />(available since Karabiner-Elements 14.12.2) | Yes `[1]`
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/event-changed/index.md`

- Size before: 1835 bytes, Size after: 1856 bytes

````diff
- | Name          | Required     | Description                                      |
+ {{< parameter-table >}}
- | ------------- | ------------ | ------------------------------------------------ |
- | `type`        | **Required** | `"event_changed_if"` or `"event_changed_unless"` |
- | `value`       | **Required** | `true` or `false`                                |
- | `description` | Optional     | A human-readable comment                         |
+ ```json
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"event_changed_if\"` or `\"event_changed_unless\"`"
+     },
+     {
+         "name": "`value`",
+         "required": true,
+         "description": "`true` or `false`"
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/expression/index.md`

- Size before: 2873 bytes, Size after: 2880 bytes

````diff
- | Name         | Required     | Description                                 |
+ {{< parameter-table >}}
- | ------------ | ------------ | ------------------------------------------- |
- | `type`       | **Required** | `"expression_if"` or `"expression_unless"`. |
- | `expression` | **Required** | Target expression.                          |
+ ```json
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"expression_if\"` or `\"expression_unless\"`."
+     },
+     {
+         "name": "`expression`",
+         "required": true,
+         "description": "Target expression."
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/frontmost-application/index.md`

- Size before: 2824 bytes, Size after: 2701 bytes

````diff
- | Name                 | Required     | Description                                                                                    |
+ {{< parameter-table >}}
- | -------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
- | `type`               | **Required** | `"frontmost_application_if"` or `"frontmost_application_unless"`                               |
- | `bundle_identifiers` | Optional     | Bundle identifier regexs such as `["^com\\.apple\\.Terminal$", "^com\\.googlecode\\.iterm2$"]` |
- | `file_paths`         | Optional     | File path regexs such as `["/Finder$"]`                                                        |
- | `description`        | Optional     | A human-readable comment                                                                       |
- ### Multiple bundle identifiers or file paths
-
- Multiple entries in `bundle_identifiers` and `file_paths` are joined by "or".
-
- The following condition is matched if bundle identifier is "com.apple.Terminal" **or** "com.googlecode.iterm2".
-
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"frontmost_application_if\"` or `\"frontmost_application_unless\"`"
+     },
+     {
+         "name": "`bundle_identifiers`",
+         "required": false,
+         "description": "Bundle identifier regexs such as `[\"^com\\\\.apple\\\\.Terminal$\", \"^com\\\\.googlecode\\\\.iterm2$\"]`"
+     },
+     {
+         "name": "`file_paths`",
+         "required": false,
+         "description": "File path regexs such as `[\"/Finder$\"]`"
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ ### Multiple bundle identifiers or file paths
+
+ Multiple entries in `bundle_identifiers` and `file_paths` are joined by "or".
+
+ The following condition is matched if bundle identifier is "com.apple.Terminal" **or** "com.googlecode.iterm2".
+
+ ```json
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/input-source/index.md`

- Size before: 4579 bytes, Size after: 4601 bytes

````diff
- | Name            | Required     | Description                                    |
+ {{< parameter-table >}}
- | --------------- | ------------ | ---------------------------------------------- |
- | `type`          | **Required** | `"input_source_if"` or `"input_source_unless"` |
- | `input_sources` | **Required** | Target input source definitions                |
- | `description`   | Optional     | A human-readable comment                       |
- ### `input_sources`
-
- `input_sources` is an array of objects.
-
- | Name              | Required | Description                                                                           |
- | ----------------- | -------- | ------------------------------------------------------------------------------------- |
- | `language`        | Optional | The language regex such as `"^en$"`, `"^ja$"`                                         |
- | `input_source_id` | Optional | The input source id regex such as `"^com\\.apple\\.keylayout\\.US$"`                  |
- | `input_mode_id`   | Optional | The input mode id regex such as `"^com\\.apple\\.inputmethod\\.Japanese\\.Hiragana$"` |
-
- #### Multiple identifiers
-
- If you specify multiple identifiers (`language`, `input_source_id` or `input_mode_id`), these are joined by "and".
-
- The following condition is matched if language is "ja" **and** input_mode_id is "com.apple.inputmethod.Japanese.Hiragana".
-
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"input_source_if\"` or `\"input_source_unless\"`"
+     },
+     {
+         "name": "`input_sources`",
+         "required": true,
+         "description": "Target input source definitions"
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ ### `input_sources`
+
+ `input_sources` is an array of objects.
+
+ {{< parameter-table >}}
+
+ ```json
+ [
+     {
+         "name": "`language`",
+         "required": false,
+         "description": "The language regex such as `\"^en$\"`, `\"^ja$\"`"
+     },
+     {
+         "name": "`input_source_id`",
+         "required": false,
+         "description": "The input source id regex such as `\"^com\\\\.apple\\\\.keylayout\\\\.US$\"`"
+     },
+     {
+         "name": "`input_mode_id`",
+         "required": false,
+         "description": "The input mode id regex such as `\"^com\\\\.apple\\\\.inputmethod\\\\.Japanese\\\\.Hiragana$\"`"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ #### Multiple identifiers
+
+ If you specify multiple identifiers (`language`, `input_source_id` or `input_mode_id`), these are joined by "and".
+
+ The following condition is matched if language is "ja" **and** input_mode_id is "com.apple.inputmethod.Japanese.Hiragana".
+
+ ```json
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/keyboard-type/index.md`

- Size before: 2407 bytes, Size after: 2451 bytes

````diff
- | Name             | Required     | Description                                      |
+ {{< parameter-table >}}
- | ---------------- | ------------ | ------------------------------------------------ |
- | `type`           | **Required** | `"keyboard_type_if"` or `"keyboard_type_unless"` |
- | `keyboard_types` | **Required** | An array of `"ansi"`, `"iso"` or `"jis"`         |
- | `description`    | Optional     | A human-readable comment                         |
- ### Multiple keyboard types
-
- `keyboard_types` are joined by "or".
-
- The following condition is matched if the keyboard type is "ansi" **or** "iso".
-
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"keyboard_type_if\"` or `\"keyboard_type_unless\"`"
+     },
+     {
+         "name": "`keyboard_types`",
+         "required": true,
+         "description": "An array of `\"ansi\"`, `\"iso\"` or `\"jis\"`"
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ ### Multiple keyboard types
+
+ `keyboard_types` are joined by "or".
+
+ The following condition is matched if the keyboard type is "ansi" **or** "iso".
+
+ ```json
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/variable/index.md`

- Size before: 6366 bytes, Size after: 7065 bytes

````diff
- | Name          | Required     | Description                             |
+ {{< parameter-table >}}
- | ------------- | ------------ | --------------------------------------- |
- | `type`        | **Required** | `"variable_if"` or `"variable_unless"`. |
- | `name`        | **Required** | Target variable name.                   |
- | `value`       | **Required** | Target variable value.                  |
- | `description` | Optional     | A human-readable comment                |
+ ```json
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"variable_if\"` or `\"variable_unless\"`."
+     },
+     {
+         "name": "`name`",
+         "required": true,
+         "description": "Target variable name."
+     },
+     {
+         "name": "`value`",
+         "required": true,
+         "description": "Target variable value."
+     },
+     {
+         "name": "`description`",
+         "required": false,
+         "description": "A human-readable comment"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
- | Type    | Example value      | Available since            |
+ {{< parameter-table name-header="Type" >}}
- | ------- | ------------------ | -------------------------- |
- | integer | 0,1,2,...          | Karabiner-Elements 11.0.0  |
- | boolean | true, false        | Karabiner-Elements 14.4.20 |
- | string  | "layer1", "layer2" | Karabiner-Elements 14.4.20 |
+ ```json
+ [
+     {
+         "name": "integer",
+         "example_value": "0,1,2,...",
+         "available_since": "Karabiner-Elements 11.0.0"
+     },
+     {
+         "name": "boolean",
+         "example_value": "true, false",
+         "available_since": "Karabiner-Elements 14.4.20"
+     },
+     {
+         "name": "string",
+         "example_value": "\"layer1\", \"layer2\"",
+         "available_since": "Karabiner-Elements 14.4.20"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
- | Name                                         | Type    | Data source                                                                                      | Available since            |
+ {{< parameter-table >}}
- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ | -------------------------- |
- | `system.scroll_direction_is_natural`         | boolean | The scroll direction setting of mouse in System Settings                                         | Karabiner-Elements 15.2.3  |
- | `system.use_fkeys_as_standard_function_keys` | boolean | The "Use all F1, F2, etc. keys as standard function keys" setting in System Settings             | Karabiner-Elements 15.2.3  |
- | `system.now.milliseconds`                    | integer | The current UNIX time in milliseconds                                                            | Karabiner-Elements 15.5.19 |
- | `system.temporarily_ignore_all_devices`      | boolean | True when "Temporarily turns off al
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/from/_index.md`

- Size before: 3783 bytes, Size after: 3730 bytes

```diff
- | Name                                           | Required | Description                                                                     |
+ {{< parameter-table >}}
- | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
- | `key_code`                                     | Optional | Key code which you want to change                                               |
- | `consumer_key_code`                            | Optional | Consumer key code (media key code) which you want to change                     |
- | `pointing_button`                              | Optional | Pointing button name which you want to change                                   |
- | [`any`](any/)                                  | Optional | `"any": "key_code"`, `"any": "consumer_key_code"` or `"any": "pointing_button"` |
- | [`modifiers`](modifiers/)                      | Optional | Specify mandatory and optional modifiers (e.g., "change control-h to delete")   |
- | [`integer_value`](integer-value/)              | Optional | Modify only events with a specific integer value.                               |
- | [`simultaneous`](simultaneous/)                | Optional | Specify multiple events which are pressed simultaneously                        |
- | [`simultaneous_options`](simultaneous-options) | Optional | Options for `simultaneous`                                                      |
- {{% alert title="Note" color="primary" %}}
- `key_code`, `consumer_key_code`, `pointing_button` and `any` are exclusive.<br />
- You have to specify one of them.
- {{% /alert %}}
-
- {{% alert title="Caution" color="danger" %}}
- Be careful using `"pointing_button": "button1"` and `"any": "pointing_button"`.<br />
- You may lose the left click button and system will be unusable.
- {{% /alert %}}
-
- ## Investigate key names
-
- - You can find `key_code`, `consumer_key_code` and `pointing_button` names by [EventViewer](../../../manual/operation/eventviewer/).
- - You can also confirm [names in list](https://github.com/pqrs-org/Karabiner-Elements/blob/main/src/apps/SettingsWindow/Resources/simple_modifications.json).
-   (See `"data"` in the list.)
-
- {{% alert title="Tip" color="primary" %}}
-
- You can also specify `key_code`, `consumer_key_code`, `pointing_button` with raw number as follows.<br />
-
+ [
+     {
+         "name": "`key_code`",
+         "required": false,
+         "description": "Key code which you want to change"
+     },
+     {
+         "name": "`consumer_key_code`",
+         "required": false,
+         "description": "Consumer key code (media key code) which you want to change"
+     },
+     {
+         "name": "`pointing_button`",
+         "required": false,
+         "description": "Pointing button name which you want to change"
+     },
+     {
+         "name": "[`any`](any/)",
+         "required": false,
+         "description": "`\"any\": \"key_co
... (diff truncated)
```

### `docs/karabiner_docs/complex-modifications-manipulator-definition/from/modifiers/index.md`

- Size before: 9751 bytes, Size after: 9637 bytes

````diff
- | Key         | Value               | Required | Description                     |
+ {{< parameter-table name-header="Key" >}}
- | ----------- | ------------------- | -------- | ------------------------------- |
- | `mandatory` | An array of strings | Optional | Modifiers which must be pressed |
- | `optional`  | An array of strings | Optional | Modifiers which can be pressed  |
+ ```json
+ [
+     {
+         "name": "`mandatory`",
+         "value": "An array of strings",
+         "required": false,
+         "description": "Modifiers which must be pressed"
+     },
+     {
+         "name": "`optional`",
+         "value": "An array of strings",
+         "required": false,
+         "description": "Modifiers which can be pressed"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
- | Name            | Description                                                          |
+ {{< parameter-table >}}
- | --------------- | -------------------------------------------------------------------- |
- | `caps_lock`     | ---                                                                  |
- | `left_command`  | ---                                                                  |
- | `left_control`  | ---                                                                  |
- | `left_option`   | ---                                                                  |
- | `left_shift`    | ---                                                                  |
- | `right_command` | ---                                                                  |
- | `right_control` | ---                                                                  |
- | `right_option`  | ---                                                                  |
- | `right_shift`   | ---                                                                  |
- | `fn`            | ---                                                                  |
- | `command`       | Either left command or right command is pressed                      |
- | `control`       | Either left control or right control is pressed                      |
- | `option`        | Either left option or right option is pressed                        |
- | `shift`         | Either left shift or right shift is pressed                          |
- | `left_alt`      | Alias of `left_option` (available since Karabiner-Elements 12.3.0)   |
- | `left_gui`      | Alias of `left_command` (available since Karabiner-Elements 12.3.0)  |
- | `right_alt`     | Alias of `right_option` (available since Karabiner-Elements 12.3.0)  |
- | `right_gui`     | Alias of `right_command` (available since Karabiner-Elements 12.3.0) |
- | `any`           | Any modifiers                                                        |
- ## Examples
-
- ### Without `modifiers`
-
- This json defines manipulator which changes `escape` to `tab`.
-
- {{< karabiner-elements-complex-modifications-json-usage >}}
-
+ [
+     { "name": "`caps_lock`", "descript
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous-options/index.md`

- Size before: 5343 bytes, Size after: 5248 bytes

````diff
- | Key                               | Value                                       | Description                                                             |
+ {{< parameter-table name-header="Key" >}}
- | --------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
- | `detect_key_down_uninterruptedly` | `true` or `false`                           | Specify whether key_down detection is interrupted with unrelated events |
- | `key_down_order`                  | `insensitive`, `strict` or `strict_inverse` | Restriction of key_down order                                           |
- | `key_up_order`                    | `insensitive`, `strict` or `strict_inverse` | Restriction of key_up order                                             |
- | `key_up_when`                     | `any` or `all`                              | When key_up events are posted                                           |
- | `to_after_key_up`                 | An array of `to` event definitions          | Events will be posted when all `from` events are released               |
- ## `detect_key_down_uninterruptedly`
-
- If `detect_key_down_uninterruptedly` is true, Karabiner-Elements changes simultaneous events even if unrelated key down event exists between target events.
-
- For example, when `escape+3 -> mission_control`, `escape,1,3` will be `mission_control,1` if `detect_key_down_uninterruptedly` is true.
-
- The default value is `false`.
-
- ## `key_down_order`
-
- `simultaneous` checks the order of key_down events if `key_down_order` is specified and is not `insensitive`.
-
- For example, this definition manipulates `tab,q` to `mission_control` and does not manipulate `q,tab` events.
-
- {{< karabiner-elements-complex-modifications-json-usage >}}
-
+ [
+     {
+         "name": "`detect_key_down_uninterruptedly`",
+         "value": "`true` or `false`",
+         "description": "Specify whether key_down detection is interrupted with unrelated events"
+     },
+     {
+         "name": "`key_down_order`",
+         "value": "`insensitive`, `strict` or `strict_inverse`",
+         "description": "Restriction of key_down order"
+     },
+     {
+         "name": "`key_up_order`",
+         "value": "`insensitive`, `strict` or `strict_inverse`",
+         "description": "Restriction of key_up order"
+     },
+     {
+         "name": "`key_up_when`",
+         "value": "`any` or `all`",
+         "description": "When key_up events are posted"
+     },
+     {
+         "name": "`to_after_key_up`",
+         "value": "An array of `to` event definitions",
+         "description": "Events will be posted when all `from` events are released"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ ## `detect_key_down_uninterruptedly`
+
+ If `detect_key_down_uninterruptedly` is true, Karabiner-Elements changes simultaneous events even if unrelated key down event exists between
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/other-types/mouse-basic/_index.md`

- Size before: 2732 bytes, Size after: 2604 bytes

````diff
- | Key          | Required     | Description                                                                                            |
+ {{< parameter-table name-header="Key" >}}
- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------ |
- | `type`       | **Required** | `"mouse_basic"` is specified                                                                           |
- | `flip`       | Optional     | An array of directions you want to invert.                                                             |
- | `swap`       | Optional     | Use `"xy"` if you want to rotate the mouse cursor movement by 90 degrees. Use it together with `flip`. |
- | `discard`    | Optional     | An array of directions in which events should not be sent.                                             |
- | `conditions` | Optional     | Same as [basic.conditions](../../conditions/)                                                          |
- {{% alert title="Caution" color="danger" %}}
-
- When using discard, make sure to explicitly specify the device using conditions.
- Otherwise, there's a risk that the mouse cursor may become completely unmovable.
-
- {{% /alert %}}
-
- ## Example
-
- Disable the scroll wheel on Logitech mice.
-
- {{< karabiner-elements-complex-modifications-json-usage >}}
-
+ [
+     {
+         "name": "`type`",
+         "required": true,
+         "description": "`\"mouse_basic\"` is specified"
+     },
+     {
+         "name": "`flip`",
+         "required": false,
+         "description": "An array of directions you want to invert."
+     },
+     {
+         "name": "`swap`",
+         "required": false,
+         "description": "Use `\"xy\"` if you want to rotate the mouse cursor movement by 90 degrees. Use it together with `flip`."
+     },
+     {
+         "name": "`discard`",
+         "required": false,
+         "description": "An array of directions in which events should not be sent."
+     },
+     {
+         "name": "`conditions`",
+         "required": false,
+         "description": "Same as [basic.conditions](../../conditions/)"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ {{% alert title="Caution" color="danger" %}}
+
+ When using discard, make sure to explicitly specify the device using conditions.
+ Otherwise, there's a risk that the mouse cursor may become completely unmovable.
+
+ {{% /alert %}}
+
+ ## Example
+
+ Disable the scroll wheel on Logitech mice.
+
+ {{< karabiner-elements-complex-modifications-json-usage >}}
+
+ ```json
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/other-types/mouse-motion-to-scroll/_index.md`

- Size before: 3205 bytes, Size after: 3078 bytes

````diff
- | Key              | Value                                                 | Required     | Description                                                        |
+ {{< parameter-table name-header="Key" >}}
- | ---------------- | ----------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
- | `type`           | `"mouse_motion_to_scroll"`                            | **Required** | ---                                                                |
- | `from.modifiers` | Same as [basic.from.modifiers](../../from/modifiers/) | Optional     | Enable `mouse_motion_to_scroll` if specified modifiers are pressed |
- | `conditions`     | Same as [basic.conditions](../../conditions/)         | Optional     | Enable `mouse_motion_to_scroll` when specified conditions          |
- | `options`        | An object of parameters                               | Optional     | ---                                                                |
- {{% alert title="Caution" color="danger" %}}
-
- You should set either `from.modifiers` or `conditions`.
-
- Your mouse cursor movement will be always changed to scroll and your mouse will be unusable without `from.modifiers` and `conditions`.
-
- {{% /alert %}}
-
- ## Options
-
- | Key                       | Value             | Required | Description                                          |
- | ------------------------- | ----------------- | -------- | ---------------------------------------------------- |
- | `momentum_scroll_enabled` | `true` or `false` | Optional | Enable Momentum scroll. The default value is `true`. |
- | `speed_multiplier`        | float value       | Optional | Multiply scroll speed. The default value is `1.0`.   |
-
- ## Example
-
- The following json changes `button4 + mouse movement` to `scroll`.
-
- {{< karabiner-elements-complex-modifications-json-usage >}}
-
+ [
+     {
+         "name": "`type`",
+         "value": "`\"mouse_motion_to_scroll\"`",
+         "required": true,
+         "description": "—"
+     },
+     {
+         "name": "`from.modifiers`",
+         "value": "Same as [basic.from.modifiers](../../from/modifiers/)",
+         "required": false,
+         "description": "Enable `mouse_motion_to_scroll` if specified modifiers are pressed"
+     },
+     {
+         "name": "`conditions`",
+         "value": "Same as [basic.conditions](../../conditions/)",
+         "required": false,
+         "description": "Enable `mouse_motion_to_scroll` when specified conditions"
+     },
+     {
+         "name": "`options`",
+         "value": "An object of parameters",
+         "required": false,
+         "description": "—"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ {{% alert title="Caution" color="danger" %}}
+
+ You should set either `from.modifiers` or `conditions`.
+
+ Your mouse cursor movement will be always changed to scroll and your mouse will be unusable without `from.modifi
... (diff truncated)
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/_index.md`

- Size before: 5983 bytes, Size after: 5756 bytes

```diff
- | Name                                                | Required | Description                                                                         |
+ {{< parameter-table >}}
- | --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
- | `key_code`                                          | Optional | Key code which you want to post                                                     |
- | `consumer_key_code`                                 | Optional | Consumer key code (media key code) which you want to post                           |
- | `pointing_button`                                   | Optional | Pointing button name which you want to post                                         |
- | [`shell_command`](shell-command/)                   | Optional | Shell command which you want to execute                                             |
- | [`select_input_source`](select-input-source/)       | Optional | Input source which you want to switch                                               |
- | [`set_variable`](set-variable/)                     | Optional | A varaible name and value which you want to change                                  |
- | [`mouse_key`](mouse-key/)                           | Optional | A mouse key definition                                                              |
- | [`sticky_modifier`](sticky-modifier/)               | Optional | A sticky modifier key definition                                                    |
- | [`software_function`](software_function/)           | Optional | A software function definition                                                      |
- | [`modifiers`](modifiers/)                           | Optional | Modifiers which are post with the event                                             |
- | [`from_event`](from-event/)                         | Optional | Send the key or button specified in `from`                                          |
- | [`lazy`](lazy/)                                     | Optional | Lazy modifier flag                                                                  |
- | [`repeat`](repeat/)                                 | Optional | Key repeat flag                                                                     |
- | [`halt`](halt/)                                     | Optional | A flag for `to_after_key_up`                                                        |
- | [`hold_down_milliseconds`](hold-down-milliseconds/) | Optional | Interval of `key_down` and `key_up` when these events are sent at the same time     |
- | [`conditions`](to-conditions/)                      | Optional | The event is transmitted only when the conditions are satisfied (e.g., variable_if) |
- ## Investigate key names
-
- - You can find `key_code`, `consumer_key_code` and `pointing_button` names by [EventViewer](../../../manual/operation/eventviewer/).
- - You can also co
... (diff truncated)
```

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/mouse-key/index.md`

- Size before: 5061 bytes, Size after: 5137 bytes

````diff
- | Name               | Required | Description                                                        |
+ {{< parameter-table >}}
- | ------------------ | -------- | ------------------------------------------------------------------ |
- | `x`                | Optional | Move left (x < 0) or right (x > 0)                                 |
- | `y`                | Optional | Move up (y < 0) or down (y > 0)                                    |
- | `vertical_wheel`   | Optional | Scroll up (vertical_wheel < 0) or down (vertical_wheel > 0)        |
- | `horizontal_wheel` | Optional | Scroll left (horizontal_wheel > 0) or right (horizontal_wheel < 0) |
- | `speed_multiplier` | Optional | Multiply mouse keys speed while this key is hold down              |
+ ```json
+ [
+     {
+         "name": "`x`",
+         "required": false,
+         "description": "Move left (x < 0) or right (x > 0)"
+     },
+     {
+         "name": "`y`",
+         "required": false,
+         "description": "Move up (y < 0) or down (y > 0)"
+     },
+     {
+         "name": "`vertical_wheel`",
+         "required": false,
+         "description": "Scroll up (vertical_wheel < 0) or down (vertical_wheel > 0)"
+     },
+     {
+         "name": "`horizontal_wheel`",
+         "required": false,
+         "description": "Scroll left (horizontal_wheel > 0) or right (horizontal_wheel < 0)"
+     },
+     {
+         "name": "`speed_multiplier`",
+         "required": false,
+         "description": "Multiply mouse keys speed while this key is hold down"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/select-input-source/index.md`

- Size before: 2702 bytes, Size after: 2683 bytes

````diff
- | Name              | Required | Description                                                                           |
+ {{< parameter-table >}}
- | ----------------- | -------- | ------------------------------------------------------------------------------------- |
- | `language`        | Optional | The language regex such as `"^en$"`, `"^fr$"`                                         |
- | `input_source_id` | Optional | The input source id regex such as `"^com\\.apple\\.keylayout\\.US$"`                  |
- | `input_mode_id`   | Optional | The input mode id regex such as `"^com\\.apple\\.inputmethod\\.Japanese\\.Hiragana$"` |
- ## Investigate the input source identifiers
-
- You can find the current input source identifiers by EventViewer > Variables tab.
-
+ [
+     {
+         "name": "`language`",
+         "required": false,
+         "description": "The language regex such as `\"^en$\"`, `\"^fr$\"`"
+     },
+     {
+         "name": "`input_source_id`",
+         "required": false,
+         "description": "The input source id regex such as `\"^com\\\\.apple\\\\.keylayout\\\\.US$\"`"
+     },
+     {
+         "name": "`input_mode_id`",
+         "required": false,
+         "description": "The input mode id regex such as `\"^com\\\\.apple\\\\.inputmethod\\\\.Japanese\\\\.Hiragana$\"`"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
+ ## Investigate the input source identifiers
+
+ You can find the current input source identifiers by EventViewer > Variables tab.
+
+ ```json
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/set-notification-message/index.md`

- Size before: 2137 bytes, Size after: 2444 bytes

````diff
-                 "text": "message text"
+                 "text": "message text",
+                 "duration_milliseconds": 3000
- | Name   | Required     | Description                                            |
+ {{< parameter-table >}}
- | ------ | ------------ | ------------------------------------------------------ |
- | `id`   | **Required** | Specify an unique string for your notification message |
- | `text` | **Required** | Message body                                           |
+ ```json
+ [
+     {
+         "name": "`id`",
+         "required": true,
+         "description": "A unique identifier for the notification message."
+     },
+     {
+         "name": "`text`",
+         "required": true,
+         "description": "The notification message to display."
+     },
+     {
+         "name": "`duration_milliseconds`",
+         "required": false,
+         "description": "If specified, the notification message is dismissed after the specified number of milliseconds.",
+         "available_since": "Karabiner-Elements 16.1.18"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/set-variable/index.md`

- Size before: 6442 bytes, Size after: 6909 bytes

```diff
- | Name                | Required             | Description                     | Available since            |
+ {{< parameter-table >}}
- | ------------------- | -------------------- | ------------------------------- | -------------------------- |
- | `name`              | **Required**         | Target variable name.           | Karabiner-Elements 11.0.0  |
- | `value`             | Required \| Optional | Target variable value.          | Karabiner-Elements 11.0.0  |
- | `expression`        | Required \| Optional | Target expression.              | Karabiner-Elements 15.5.19 |
- | `key_up_value`      | Optional             | A variable value when key is up | Karabiner-Elements 14.12.6 |
- | `key_up_expression` | Optional             | An expression when key is up    | Karabiner-Elements 15.5.19 |
- | `type`              | Optional             | "set" or "unset"                | Karabiner-Elements 14.99.2 |
- Note: If `key_up_value` or `type` is specified, the `value` can be omitted.
-
- ## Available types of `value`
-
- | Type    | Example value      | Available since            |
- | ------- | ------------------ | -------------------------- |
- | integer | 0,1,2,...          | Karabiner-Elements 11.0.0  |
- | boolean | true, false        | Karabiner-Elements 14.4.20 |
- | string  | "layer1", "layer2" | Karabiner-Elements 14.4.20 |
-
- ## Expression specification
-
- {{% alert color="info" %}}
- `expression` and `key_up_expression` are available since Karabiner-Elements 15.5.19.
- {{% /alert %}}
-
- `expression` and `key_up_expression` allow you to write arithmetic expressions,
- and you can use variables set by other `set_variable` manipulations and the following system-provided variables.
- If an undefined variable appears in the expression, its value is treated as 0.
-
- - system.now.milliseconds
- - system.scroll_direction_is_natural
- - system.use_fkeys_as_standard_function_keys
-
- {{% alert color="primary" %}}
-
- The arithmetic syntax used in `expression` and `key_up_expression` follows [exprtk](https://www.partow.net/programming/exprtk/index.html).
-
- {{% /alert %}}
-
- ### Expression examples
-
- #### Toggle a value
-
- {{< karabiner-elements-complex-modifications-json-usage >}}
-
+ [
+     {
+         "name": "`name`",
+         "required": true,
+         "description": "Target variable name.",
+         "available_since": "Karabiner-Elements 11.0.0"
+     },
+     {
+         "name": "`value`",
+         "required": "Required | Optional",
+         "description": "Target variable value.",
+         "available_since": "Karabiner-Elements 11.0.0"
+     },
+     {
+         "name": "`expression`",
+         "required": "Required | Optional",
+         "description": "Target expression.",
+         "available_since": "Karabiner-Elements 15.5.19"
+     },
+     {
+         "name": "`key_up_value`",
+         "required": false,
+         "description": "A variable value when key is up",
+         "available_since": "Karabin
... (diff truncated)
```

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/cg_event_double_click/index.md`

- Size before: 3161 bytes, Size after: 2993 bytes

````diff
- | Name     | Required     | Description                                                                                                           |
+ {{< parameter-table >}}
- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
- | `button` | **Required** | An integer of CGMouseButton.<br><br>0: Left Click<br>1: Right Click<br>2: Middle Click<br>3,4,5,...,31: Other Buttons |
+ ```json
+ [
+     {
+         "name": "`button`",
+         "required": true,
+         "description": "An integer of CGMouseButton.<br><br>0: Left Click<br>1: Right Click<br>2: Middle Click<br>3,4,5,...,31: Other Buttons"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
- You have to allow `karabiner_console_user_server` in Privacy & Security System Settings.
+ You have to allow `Karabiner-Console-User-Server` in Privacy & Security System Settings.
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/iokit_power_management_sleep_system/index.md`

- Size before: 1531 bytes, Size after: 1450 bytes

````diff
- | Name                 | Required | Description                                                          |
+ {{< parameter-table >}}
- | -------------------- | -------- | -------------------------------------------------------------------- |
- | `delay_milliseconds` | Optional | Waiting time before the system goes to sleep (500 ms if unspecified) |
+ ```json
+ [
+     {
+         "name": "`delay_milliseconds`",
+         "required": false,
+         "description": "Waiting time before the system goes to sleep (500 ms if unspecified)"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/open_application/index.md`

- Size before: 6442 bytes, Size after: 6473 bytes

````diff
- | Priority | Name                                  | Required | Description                                      | Available since |
+ {{< parameter-table >}}
- | -------- | ------------------------------------- | -------- | ------------------------------------------------ | --------------- |
- | 1        | `bundle_identifier`                   | Optional | The bundle identifier of the application         | v15.0.19        |
- | 2        | `file_path`                           | Optional | The file path of the application                 | v15.0.19        |
- | 3        | `frontmost_application_history_index` | Optional | The index of the frontmost application's history | v15.3.6         |
+ ```json
+ [
+     {
+         "priority": 1,
+         "name": "`bundle_identifier`",
+         "required": false,
+         "description": "The bundle identifier of the application",
+         "available_since": "v15.0.19"
+     },
+     {
+         "priority": 2,
+         "name": "`file_path`",
+         "required": false,
+         "description": "The file path of the application",
+         "available_since": "v15.0.19"
+     },
+     {
+         "priority": 3,
+         "name": "`frontmost_application_history_index`",
+         "required": false,
+         "description": "The index of the frontmost application's history",
+         "available_since": "v15.3.6"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/set_mouse_cursor_position/index.md`

- Size before: 1897 bytes, Size after: 1948 bytes

````diff
- | Name     | Required     | Description                                     |
+ {{< parameter-table >}}
- | -------- | ------------ | ----------------------------------------------- |
- | `x`      | **Required** | The new mouse cursor position                   |
- | `y`      | **Required** | The new mouse cursor position                   |
- | `screen` | Optional     | The screen index of the new mouse cursor origin |
+ ```json
+ [
+     {
+         "name": "`x`",
+         "required": true,
+         "description": "The new mouse cursor position"
+     },
+     {
+         "name": "`y`",
+         "required": true,
+         "description": "The new mouse cursor position"
+     },
+     {
+         "name": "`screen`",
+         "required": false,
+         "description": "The screen index of the new mouse cursor origin"
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/complex-modifications-manipulator-definition/to/sticky-modifier/index.md`

- Size before: 1958 bytes, Size after: 1700 bytes

````diff
- | Name              | Required | Description                                                                                                                                                        |
+ {{< parameter-table >}}
- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
- | `{modifier_name}` | Optional | - `on` always activates a sticky modifier.<br />- `off` is vice versa.<br />- `toggle` toggles a sticky modifier. <br /><br />`toggle` is suitable for most cases. |
+ ```json
+ [
+     {
+         "name": "`{modifier_name}`",
+         "required": false,
+         "description": "• `on` always activates a sticky modifier.<br />• `off` is vice versa.<br />• `toggle` toggles a sticky modifier.<br /><br />`toggle` is suitable for most cases."
+     }
+ ]
+ ```
+
+ {{< /parameter-table >}}
+
````

### `docs/karabiner_docs/root-data-structure/index.md`

- Size before: 6137 bytes, Size after: 6803 bytes

```diff
+                 "description_notes": [
+                     "Usage notes and other information",
+                     "Displayed in smaller text",
+                     "The description_notes field is supported in Karabiner-Elements 16.1.23 and later"
+                 ],
+                 "description_notes": [
+                     ...
+                 ],
+             "description_notes": [
+                 "Usage notes and other information",
+                 "Displayed in smaller text",
+                 "The description_notes field is supported in Karabiner-Elements 16.1.23 and later"
+             ],
+             "description_notes": [
+                 ...
+             ],
```

## ⚪ Unchanged Files

<details>
<summary>Click to view all unchanged files</summary>

- `docs/karabiner_docs/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/conditions/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/from/any/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/from/integer-value/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/from/simultaneous/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/other-types/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to-after-key-up/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to-delayed-action/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to-if-alone/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to-if-held-down/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to-if-other-key-pressed/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/from-event/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/halt/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/hold-down-milliseconds/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/lazy/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/modifiers/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/repeat/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/send-user-command/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/shell-command/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/software_function/_index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-definition/to/to-conditions/index.md`
- `docs/karabiner_docs/complex-modifications-manipulator-evaluation-priority/index.md`
- `docs/karabiner_docs/expert-complex-modifications-examples/_index.md`
- `docs/karabiner_docs/expert-complex-modifications-examples/letter-key-holding-modifier/index.md`
- `docs/karabiner_docs/expert-complex-modifications-examples/letter-key-release-order-modifier/index.md`
- `docs/karabiner_docs/expert-complex-modifications-examples/swap-function-keys-on-external-keyboards/index.md`
- `docs/karabiner_docs/extra/_index.md`
- `docs/karabiner_docs/extra/multitouch-extension/index.md`
- `docs/karabiner_docs/extra/virtual-modifier/index.md`
- `docs/karabiner_docs/location/images/log@2x.png`
- `docs/karabiner_docs/location/index.md`
- `docs/karabiner_docs/typical-complex-modifications-examples/index.md`

</details>
