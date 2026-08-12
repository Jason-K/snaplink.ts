#!/usr/bin/env python3
"""Generate karabiner-rule.schema.json from karabiner-keycodes.json.

Run after refreshing key names with extract_keycodes.py, or edit the definitions
below and regenerate:

    python3 gen_schema.py        # or: make schema
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
SRC = HERE / "karabiner-keycodes.json"
OUT = HERE / "karabiner-rule.schema.json"

kc: dict[str, list[str]] = json.loads(SRC.read_text())

FROM_MODIFIERS = [
    "caps_lock", "left_command", "left_control", "left_option", "left_shift",
    "right_command", "right_control", "right_option", "right_shift", "fn",
    "command", "control", "option", "shift",
    "left_alt", "left_gui", "right_alt", "right_gui", "any",
]
TO_MODIFIERS = list(FROM_MODIFIERS)  # "any" parses here but contributes no flag
STICKY_MODIFIERS = [
    "left_control", "left_shift", "left_option", "left_command",
    "right_control", "right_shift", "right_option", "right_command", "fn",
]


def named(kind: str, doc: str) -> dict[str, Any]:
    """Enum of parser-recognized names, or a raw HID usage integer."""
    return {
        "description": f"Must be {doc}.",
        "anyOf": [
            {"type": "string", "enum": sorted(kc[kind])},
            {"type": "integer", "description": "Raw usage number (do not quote)."},
        ],
    }


def to_list(doc: str) -> dict[str, Any]:
    """The parser accepts either a single to-event object or an array of them."""
    return {
        "description": doc,
        "anyOf": [
            {"type": "array", "items": {"$ref": "#/$defs/toEventDefinition"}},
            {"$ref": "#/$defs/toEventDefinition"},
        ],
    }


def modifier_list(values: list[str], doc: str) -> dict[str, Any]:
    return {
        "description": doc,
        "anyOf": [
            {"type": "array", "items": {"type": "string", "enum": values}},
            {"type": "string", "enum": values},
        ],
    }


EVENT_KEYS = [
    "key_code", "consumer_key_code", "apple_vendor_keyboard_key_code",
    "apple_vendor_top_case_key_code", "generic_desktop", "pointing_button",
]

TO_EXCLUSIVE = EVENT_KEYS + [
    "any", "from_event", "shell_command", "send_user_command",
    "select_input_source", "set_variable", "set_notification_message",
    "mouse_key", "sticky_modifier", "software_function",
]

event_props: dict[str, Any] = {
    "key_code": named("key_code", "a key_code name (see EventViewer, or karabiner-keycodes.json) or a raw usage integer"),
    "consumer_key_code": named("consumer_key_code", "a consumer_key_code (media key) name or a raw usage integer"),
    "apple_vendor_keyboard_key_code": named(
        "apple_vendor_keyboard_key_code",
        "an apple_vendor_keyboard_key_code name (mission_control, launchpad, ...) or a raw usage integer",
    ),
    "apple_vendor_top_case_key_code": named(
        "apple_vendor_top_case_key_code",
        "an apple_vendor_top_case_key_code name (brightness_*, illumination_*, ...) or a raw usage integer",
    ),
    "generic_desktop": named("generic_desktop", "a generic_desktop usage name (system_sleep, dpad_*, ...) or a raw usage integer"),
    "pointing_button": named("pointing_button", "a pointing_button name (button1 = left click) or a raw usage integer"),
}

input_source_specifier = {
    "type": "object",
    "description": "Regex specifiers; multiple keys within one object are ANDed.",
    "properties": {
        "language": {"type": "string", "description": 'Language regex, e.g. "^en$".'},
        "input_source_id": {"type": "string", "description": "Input source id regex."},
        "input_mode_id": {"type": "string", "description": "Input mode id regex."},
    },
    "additionalProperties": False,
    "minProperties": 1,
}

schema: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://local/karabiner-rule.schema.json",
    "title": "Karabiner-Elements complex modification rule",
    "description": (
        "Schema for a Karabiner-Elements complex_modifications asset file "
        "(~/.config/karabiner/assets/complex_modifications/*.json), a single rule, "
        "or a single manipulator. Derived from pqrs-org/pqrs.org docs and "
        "pqrs-org/Karabiner-Elements source (parser key sets, parameter defaults, "
        "and the simple_modifications.json key-code tables)."
    ),
    "$ref": "#/$defs/complexModificationsFile",
    "$defs": {},
}

d = schema["$defs"]

# ---------------------------------------------------------------- containers

d["complexModificationsFile"] = {
    "type": "object",
    "description": (
        "A custom *.json file placed in ~/.config/karabiner/assets/complex_modifications/. "
        "Unknown keys are permitted here and at rule level (Karabiner ignores them, and "
        "generators add their own metadata); strictness applies inside `manipulators`."
    ),
    "properties": {
        "title": {"type": "string", "description": "Shown as the group heading in Settings."},
        "rules": {"type": "array", "items": {"$ref": "#/$defs/rule"}},
        "maintainers": {"type": "array", "items": {"type": "string"}},
        "author": {"type": "string"},
        "homepage": {"type": "string"},
        "maintainer": {
            "anyOf": [{"type": "string"}, {"type": "array", "items": {"type": "string"}}],
            "description": "Non-standard singular form seen in the wild.",
        },
        "version": {"type": ["string", "number"]},
        "repo": {"type": "string"},
        "url": {"type": "string"},
        "website": {"type": "string"},
        "gallery_url": {"type": "string"},
        "json_url": {"type": "string"},
        "import_url": {"type": "string"},
    },
    "required": ["title", "rules"],
    "additionalProperties": True,
}

d["complexModifications"] = {
    "type": "object",
    "description": "The complex_modifications block of a profile, or of a generator's build output.",
    "properties": {
        "parameters": {"$ref": "#/$defs/parameters"},
        "rules": {"type": "array", "items": {"$ref": "#/$defs/rule"}},
    },
    "required": ["rules"],
    "additionalProperties": True,
}

d["complexModificationsBlock"] = {
    "type": "object",
    "description": "Build-output shape: {\"complex_modifications\": {\"rules\": [...]}}.",
    "properties": {"complex_modifications": {"$ref": "#/$defs/complexModifications"}},
    "required": ["complex_modifications"],
    "additionalProperties": True,
}

d["rules"] = {
    "type": "array",
    "description": "A bare array of rules.",
    "items": {"$ref": "#/$defs/rule"},
}

d["karabinerConfig"] = {
    "type": "object",
    "description": (
        "~/.config/karabiner/karabiner.json. Permissive outside complex_modifications: "
        "devices, virtual_hid_keyboard, fn_function_keys and simple_modifications are "
        "passed through unvalidated because they are not covered by the rule documentation."
    ),
    "properties": {
        "global": {"type": "object"},
        "profiles": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "selected": {"type": "boolean"},
                    "complex_modifications": {"$ref": "#/$defs/complexModifications"},
                    "parameters": {"type": "object"},
                    "virtual_hid_keyboard": {"type": "object"},
                    "simple_modifications": {"type": "array"},
                    "fn_function_keys": {"type": "array"},
                    "devices": {"type": "array"},
                },
                "required": ["name"],
                "additionalProperties": True,
            },
        },
    },
    "required": ["profiles"],
    "additionalProperties": True,
}

d["rule"] = {
    "type": "object",
    "properties": {
        "description": {"type": "string", "description": "Shown in Settings; keep it unique and human-readable."},
        "manipulators": {"type": "array", "items": {"$ref": "#/$defs/manipulator"}},
        "available_since": {"type": "string"},
        "enabled": {"type": "boolean", "description": "Ignored by the parser; used by some third-party generators."},
    },
    "required": ["manipulators"],
    "additionalProperties": True,
}

d["manipulator"] = {
    "description": "Evaluated top to bottom; the FIRST matching manipulator wins and the rest are skipped.",
    "type": "object",
    "required": ["type"],
    "properties": {"type": {"enum": ["basic", "mouse_basic", "mouse_motion_to_scroll"]}},
    "allOf": [
        {
            "if": {"properties": {"type": {"const": t}}, "required": ["type"]},
            "then": {"$ref": f"#/$defs/{ref}"},
        }
        for t, ref in [
            ("basic", "manipulatorBasic"),
            ("mouse_basic", "manipulatorMouseBasic"),
            ("mouse_motion_to_scroll", "manipulatorMouseMotionToScroll"),
        ]
    ],
}

d["manipulatorBasic"] = {
    "type": "object",
    "properties": {
        "type": {"const": "basic"},
        "from": {"$ref": "#/$defs/fromEventDefinition"},
        "to": to_list("Events sent while `from` is pressed."),
        "to_if_alone": to_list(
            "Posted when `from` is pressed and released alone. key_down and key_up are sent together, so key repeat is impossible here."
        ),
        "to_if_held_down": to_list("Posted after basic.to_if_held_down_threshold_milliseconds."),
        "to_if_other_key_pressed": {
            "type": "array",
            "items": {"$ref": "#/$defs/toIfOtherKeyPressedEntry"},
            "description": "Rewrites the held `from` key itself when one of other_keys is pressed.",
        },
        "to_after_key_up": to_list("Posted when `from` is released."),
        "to_delayed_action": {"$ref": "#/$defs/toDelayedAction"},
        "conditions": {"type": "array", "items": {"$ref": "#/$defs/condition"}},
        "parameters": {"$ref": "#/$defs/parameters"},
        "description": {"type": "string", "description": "Human-readable comment for this manipulator."},
    },
    "required": ["type", "from"],
    "additionalProperties": False,
}

d["manipulatorMouseBasic"] = {
    "type": "object",
    "description": "Invert, swap, or discard mouse movement. Requires the mouse to be enabled in the Devices tab.",
    "properties": {
        "type": {"const": "mouse_basic"},
        "flip": {
            "type": "array",
            "items": {"enum": ["x", "y", "vertical_wheel", "horizontal_wheel"]},
        },
        "swap": {"type": "array", "items": {"enum": ["xy", "wheels"]}},
        "discard": {
            "type": "array",
            "items": {"enum": ["x", "y", "vertical_wheel", "horizontal_wheel"]},
            "description": "DANGER: always pair discard with a device_if condition or the cursor can become unmovable.",
        },
        "conditions": {"type": "array", "items": {"$ref": "#/$defs/condition"}},
        "description": {"type": "string"},
    },
    "required": ["type"],
    "additionalProperties": False,
}

d["manipulatorMouseMotionToScroll"] = {
    "type": "object",
    "description": "Converts pointer motion into scrolling. Specify from.modifiers or conditions, or the mouse becomes unusable.",
    "properties": {
        "type": {"const": "mouse_motion_to_scroll"},
        "from": {
            "type": "object",
            "properties": {"modifiers": {"$ref": "#/$defs/fromModifiers"}},
            "additionalProperties": False,
        },
        "conditions": {"type": "array", "items": {"$ref": "#/$defs/condition"}},
        "options": {
            "type": "object",
            "properties": {
                "momentum_scroll_enabled": {"type": "boolean", "default": True},
                "speed_multiplier": {"type": "number", "default": 1.0},
            },
            "additionalProperties": False,
        },
        "description": {"type": "string"},
    },
    "required": ["type"],
    "anyOf": [{"required": ["from"]}, {"required": ["conditions"]}],
    "additionalProperties": False,
}

# ---------------------------------------------------------------------- from

d["fromModifiers"] = {
    "type": "object",
    "description": (
        "mandatory modifiers are consumed (removed from `to`); optional modifiers are passed through. "
        'Without "optional": ["any"], the manipulator will not fire when extra modifiers are held.'
    ),
    "properties": {
        "mandatory": modifier_list(FROM_MODIFIERS, "Modifiers that must be held; removed from the output events."),
        "optional": modifier_list(FROM_MODIFIERS, "Modifiers allowed to be held; kept in the output events."),
    },
    "additionalProperties": False,
}

d["simultaneousOptions"] = {
    "type": "object",
    "properties": {
        "detect_key_down_uninterruptedly": {
            "type": "boolean",
            "default": False,
            "description": "If true, an unrelated key_down between the target keys does not cancel the match.",
        },
        "key_down_order": {"enum": ["insensitive", "strict", "strict_inverse"], "default": "insensitive"},
        "key_up_order": {
            "enum": ["insensitive", "strict", "strict_inverse"],
            "default": "insensitive",
            "description": "Ignored once basic.simultaneous_threshold_milliseconds elapses; raise that parameter when using this.",
        },
        "key_up_when": {"enum": ["any", "all"], "description": "When the `to` key_up is posted."},
        "to_after_key_up": to_list(
            "Posted once every `from` event is released; typical place to clear mode variables."
        ),
        "description": {"type": "string"},
    },
    "additionalProperties": False,
}

from_props = dict(event_props)
from_props.update(
    {
        "any": {
            "enum": [
                "key_code", "consumer_key_code", "apple_vendor_keyboard_key_code",
                "apple_vendor_top_case_key_code", "pointing_button",
            ],
            "description": 'Match every event of this type. DANGER: "pointing_button" can cost you the left click.',
        },
        "modifiers": {"$ref": "#/$defs/fromModifiers"},
        "integer_value": {
            "type": "integer",
            "description": "Match only events carrying this integer value (multi-button footpedals etc.).",
        },
        "simultaneous": {
            "type": "array",
            "minItems": 2,
            "items": {
                "type": "object",
                "properties": {**event_props, "any": {
                    "enum": [
                        "key_code", "consumer_key_code", "apple_vendor_keyboard_key_code",
                        "apple_vendor_top_case_key_code", "pointing_button",
                    ]
                }, "description": {"type": "string"}},
                "additionalProperties": False,
                "oneOf": [{"required": [k]} for k in EVENT_KEYS + ["any"]],
            },
            "description": "Keys pressed together within basic.simultaneous_threshold_milliseconds (default 50 ms).",
        },
        "simultaneous_options": {"$ref": "#/$defs/simultaneousOptions"},
        "description": {"type": "string"},
    }
)

d["fromEventDefinition"] = {
    "type": "object",
    "properties": from_props,
    "additionalProperties": False,
    "oneOf": [{"required": [k]} for k in EVENT_KEYS + ["any", "simultaneous"]],
    "description": "Exactly one of key_code / consumer_key_code / apple_vendor_* / generic_desktop / pointing_button / any / simultaneous.",
}

# ------------------------------------------------------------------------ to

d["setVariable"] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "value": {
            "type": ["integer", "boolean", "string"],
            "description": "Types are not coerced: 1 != true, true != \"true\". Unset variables read as 0.",
        },
        "expression": {"type": "string", "description": "exprtk arithmetic expression (KE 15.5.19+)."},
        "key_up_value": {"type": ["integer", "boolean", "string"], "description": "Value applied on key_up (KE 14.12.6+)."},
        "key_up_expression": {"type": "string", "description": "Expression evaluated on key_up (KE 15.5.19+)."},
        "type": {"enum": ["set", "unset"], "default": "set", "description": "KE 14.99.2+."},
    },
    "required": ["name"],
    "additionalProperties": False,
    "anyOf": [
        {"required": ["value"]},
        {"required": ["expression"]},
        {"required": ["key_up_value"]},
        {"required": ["key_up_expression"]},
        {"properties": {"type": {"const": "unset"}}, "required": ["type"]},
    ],
}

d["mouseKey"] = {
    "type": "object",
    "description": "Speeds and directions follow System Settings > Mouse.",
    "properties": {
        "x": {"type": "number", "description": "Negative = left, positive = right."},
        "y": {"type": "number", "description": "Negative = up, positive = down."},
        "vertical_wheel": {"type": "number", "description": "Negative = scroll up, positive = scroll down."},
        "horizontal_wheel": {"type": "number", "description": "Positive = scroll left, negative = scroll right."},
        "speed_multiplier": {"type": "number", "description": "Multiplies mouse-key speed while this key is held."},
    },
    "additionalProperties": False,
    "minProperties": 1,
}

d["softwareFunction"] = {
    "type": "object",
    "description": "KE 13.5.1+. Exactly one function per `to` entry.",
    "properties": {
        "cg_event_double_click": {
            "type": "object",
            "properties": {
                "button": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 31,
                    "description": "CGMouseButton: 0 left, 1 right, 2 middle.",
                }
            },
            "required": ["button"],
            "additionalProperties": False,
            "description": "Laggy (software-generated) and needs Accessibility permission for karabiner_console_user_server; two pointing_button events are usually better.",
        },
        "iokit_power_management_sleep_system": {
            "type": "object",
            "properties": {"delay_milliseconds": {"type": "integer", "minimum": 0, "default": 500}},
            "additionalProperties": False,
            "description": "KE 13.7.1+.",
        },
        "open_application": {
            "type": "object",
            "properties": {
                "bundle_identifier": {"type": "string", "description": "Priority 1 (KE 15.0.19+)."},
                "file_path": {"type": "string", "description": "Priority 2 (KE 15.0.19+)."},
                "frontmost_application_history_index": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Priority 3 (KE 15.3.6+). Only apps launched after KE started and still running are candidates.",
                },
                "frontmost_application_history_exclusion_bundle_identifiers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Regexes; KE 15.7.3+.",
                },
                "frontmost_application_history_exclusion_file_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Regexes; KE 15.7.3+.",
                },
            },
            "additionalProperties": False,
            "anyOf": [
                {"required": ["bundle_identifier"]},
                {"required": ["file_path"]},
                {"required": ["frontmost_application_history_index"]},
            ],
            "description": "When several of bundle_identifier / file_path / history_index are given, only the highest-priority one is used.",
        },
        "set_mouse_cursor_position": {
            "type": "object",
            "properties": {
                "x": {"type": ["integer", "string"], "description": 'Points (100) or percent ("50%").'},
                "y": {"type": ["integer", "string"], "description": 'Points (100) or percent ("50%").'},
                "screen": {"type": "integer", "minimum": 0, "description": "Screen index for the origin."},
                "relative_to": {
                    "enum": ["screen", "focused_window"],
                    "default": "screen",
                    "description": "Source-only (not yet in the published docs).",
                },
                "fallback_to": {
                    "enum": ["none", "screen"],
                    "default": "none",
                    "description": "Source-only; used when relative_to target is unavailable.",
                },
            },
            "required": ["x", "y"],
            "additionalProperties": False,
        },
    },
    "additionalProperties": False,
    "minProperties": 1,
    "maxProperties": 1,
}

to_props = dict(event_props)
to_props.update(
    {
        "any": {
            "enum": [
                "key_code", "consumer_key_code", "apple_vendor_keyboard_key_code",
                "apple_vendor_top_case_key_code", "pointing_button",
            ],
        },
        "from_event": {
            "type": "boolean",
            "description": "Re-send the `from` event verbatim. With from.any this builds pass-through mode: once an event is modified it is exempt from later rules.",
        },
        "shell_command": {
            "type": "string",
            "description": "Runs with a minimal environment ($HOME, $UID, $USER, ...). Export LC_ALL etc. inside the command when needed.",
        },
        "send_user_command": {
            "type": "object",
            "properties": {
                "payload": {"description": "JSON-serialized and sent to the receiver."},
                "endpoint": {
                    "type": "string",
                    "description": "UNIX datagram socket path. Default: /Library/Application Support/org.pqrs/tmp/user/{UID}/user_command_receiver.sock",
                },
            },
            "required": ["payload"],
            "additionalProperties": False,
        },
        "select_input_source": {
            "description": "CJKV input sources with input_mode_id may fail to switch (macOS issue); send the OS shortcut instead.",
            "anyOf": [
                input_source_specifier,
                {"type": "array", "items": input_source_specifier},
            ],
        },
        "set_variable": {"$ref": "#/$defs/setVariable"},
        "set_notification_message": {
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Unique id; reuse it to update or clear the message."},
                "text": {"type": "string", "description": 'Empty string removes the message. Always clear what you set.'},
                "duration_milliseconds": {"type": "integer", "minimum": 0, "description": "KE 16.1.18+."},
            },
            "required": ["id", "text"],
            "additionalProperties": False,
        },
        "mouse_key": {"$ref": "#/$defs/mouseKey"},
        "sticky_modifier": {
            "type": "object",
            "description": "Exactly one modifier per entry; repeat the entry for multiple sticky modifiers.",
            "properties": {m: {"enum": ["on", "off", "toggle"]} for m in STICKY_MODIFIERS},
            "additionalProperties": False,
            "minProperties": 1,
            "maxProperties": 1,
        },
        "software_function": {"$ref": "#/$defs/softwareFunction"},
        "modifiers": modifier_list(TO_MODIFIERS, "Modifiers posted with the event. Here command/control/option/shift are aliases of the LEFT variants (in `from` they mean either side). \"any\" parses but adds no flag."),
        "lazy": {
            "type": "boolean",
            "default": False,
            "description": "Modifier is not sent until another key is pressed with it.",
        },
        "repeat": {
            "type": "boolean",
            "default": True,
            "description": "false suppresses key repeat and sends key_down+key_up at press time.",
        },
        "halt": {
            "type": "boolean",
            "default": False,
            "description": "In to_if_alone / to_if_held_down: cancel to_after_key_up and to_delayed_action.",
        },
        "hold_down_milliseconds": {
            "type": "integer",
            "minimum": 0,
            "default": 0,
            "description": "Gap between key_down and key_up when both are sent at once (caps_lock needs ~200).",
        },
        "held_down_milliseconds": {
            "type": "integer",
            "minimum": 0,
            "description": "Undocumented alias of hold_down_milliseconds accepted by the parser.",
        },
        "conditions": {
            "type": "array",
            "items": {"$ref": "#/$defs/condition"},
            "description": "KE 15.3.7+. Evaluated once, before the first event of the `to` array is processed.",
        },
        "description": {"type": "string"},
    }
)

d["toEventDefinition"] = {
    "type": "object",
    "properties": to_props,
    "additionalProperties": False,
    "oneOf": [{"required": [k]} for k in TO_EXCLUSIVE],
    "description": "Exactly one event key per entry (key_code, shell_command, set_variable, software_function, ...).",
}

d["toIfOtherKeyPressedEntry"] = {
    "type": "object",
    "properties": {
        "other_keys": {
            "type": "array",
            "minItems": 1,
            "items": {"$ref": "#/$defs/fromEventDefinition"},
        },
        "to": {
            "type": "array",
            "items": {"$ref": "#/$defs/toEventDefinition"},
            "description": "Must be an array here; the single-object shorthand is not accepted by this parser.",
        },
    },
    "required": ["other_keys", "to"],
    "additionalProperties": False,
}

d["toDelayedAction"] = {
    "type": "object",
    "description": "Fires basic.to_delayed_action_delay_milliseconds (default 500) after `from` is pressed.",
    "properties": {
        "to_if_invoked": to_list("Sent when no other key was pressed before the delay elapsed."),
        "to_if_canceled": to_list("Sent when another key was pressed first."),
    },
    "additionalProperties": False,
    "minProperties": 1,
}

# ---------------------------------------------------------------- parameters

d["parameters"] = {
    "type": "object",
    "description": "Valid at profile complex_modifications level and per-manipulator. Out-of-range values are clamped with a log warning, not rejected.",
    "properties": {
        "basic.simultaneous_threshold_milliseconds": {
            "type": "integer", "minimum": 0, "maximum": 1000, "default": 50,
            "description": "Window for from.simultaneous. Clamped to 0..1000.",
        },
        "basic.to_if_alone_timeout_milliseconds": {
            "type": "integer", "minimum": 0, "default": 1000,
            "description": "Holding longer than this cancels to_if_alone.",
        },
        "basic.to_if_held_down_threshold_milliseconds": {
            "type": "integer", "minimum": 0, "default": 500,
        },
        "basic.to_delayed_action_delay_milliseconds": {
            "type": "integer", "minimum": 0, "default": 500,
        },
        "mouse_motion_to_scroll.speed": {
            "type": "integer", "minimum": 1, "maximum": 10000, "default": 100,
            "description": "Percent; the runtime divides by 100. Profile-level parameter.",
        },
    },
    "additionalProperties": False,
}

# ---------------------------------------------------------------- conditions

CONDITION_DISPATCH = [
    (("frontmost_application_if", "frontmost_application_unless"), "conditionFrontmostApplication"),
    (("device_if", "device_unless", "device_exists_if", "device_exists_unless"), "conditionDevice"),
    (("keyboard_type_if", "keyboard_type_unless"), "conditionKeyboardType"),
    (("input_source_if", "input_source_unless"), "conditionInputSource"),
    (("variable_if", "variable_unless"), "conditionVariable"),
    (("expression_if", "expression_unless"), "conditionExpression"),
    (("event_changed_if", "event_changed_unless"), "conditionEventChanged"),
]

d["condition"] = {
    "type": "object",
    "required": ["type"],
    "properties": {
        "type": {"enum": [t for types, _ in CONDITION_DISPATCH for t in types]},
    },
    "allOf": [
        {
            "if": {"properties": {"type": {"enum": list(types)}}, "required": ["type"]},
            "then": {"$ref": f"#/$defs/{ref}"},
        }
        for types, ref in CONDITION_DISPATCH
    ],
}

d["conditionFrontmostApplication"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["frontmost_application_if", "frontmost_application_unless"]},
        "bundle_identifiers": {
            "type": "array",
            "items": {"type": "string"},
            "description": 'Regexes, ORed. Escape dots: "^com\\\\.apple\\\\.Terminal$".',
        },
        "file_paths": {"type": "array", "items": {"type": "string"}, "description": "Regexes, ORed."},
        "description": {"type": "string"},
    },
    "required": ["type"],
    "anyOf": [{"required": ["bundle_identifiers"]}, {"required": ["file_paths"]}],
    "additionalProperties": False,
}

d["conditionDevice"] = {
    "type": "object",
    "properties": {
        "type": {
            "enum": ["device_if", "device_unless", "device_exists_if", "device_exists_unless"],
            "description": "device_exists_* (KE 14.8.4+) test connection, not event origin.",
        },
        "identifiers": {
            "type": "array",
            "minItems": 1,
            "description": "Entries are ORed; keys inside one entry are ANDed.",
            "items": {
                "type": "object",
                "properties": {
                    "vendor_id": {"type": "integer", "description": "Decimal, from EventViewer > Devices."},
                    "product_id": {"type": "integer"},
                    "location_id": {"type": "integer", "description": "Changes when the USB port changes."},
                    "device_address": {"type": "string", "description": "Bluetooth MAC (KE 14.12.2+); changes with hardware replacement."},
                    "is_keyboard": {"type": "boolean"},
                    "is_pointing_device": {"type": "boolean"},
                    "is_game_pad": {"type": "boolean", "description": "KE 14.12.4+."},
                    "is_consumer": {"type": "boolean", "description": "KE 15.3.18+."},
                    "is_touch_bar": {"type": "boolean"},
                    "is_built_in_keyboard": {"type": "boolean", "description": "KE 14.8.2+."},
                    "is_virtual_device": {"type": "boolean", "description": "Accepted by the device_identifiers parser."},
                    "description": {"type": "string"},
                },
                "additionalProperties": False,
                "minProperties": 1,
            },
        },
        "description": {"type": "string"},
    },
    "required": ["type", "identifiers"],
    "additionalProperties": False,
}

d["conditionKeyboardType"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["keyboard_type_if", "keyboard_type_unless"]},
        "keyboard_types": {
            "type": "array",
            "minItems": 1,
            "items": {"enum": ["ansi", "iso", "jis"]},
            "description": "ORed. Refers to the VIRTUAL keyboard type, not the physical device.",
        },
        "description": {"type": "string"},
    },
    "required": ["type", "keyboard_types"],
    "additionalProperties": False,
}

d["conditionInputSource"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["input_source_if", "input_source_unless"]},
        "input_sources": {
            "type": "array",
            "minItems": 1,
            "items": input_source_specifier,
            "description": "Entries are ORed; keys inside one entry are ANDed.",
        },
        "description": {"type": "string"},
    },
    "required": ["type", "input_sources"],
    "additionalProperties": False,
}

d["conditionVariable"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["variable_if", "variable_unless"]},
        "name": {"type": "string"},
        "value": {
            "type": ["integer", "boolean", "string"],
            "description": "Strict type match: 1 != true, true != \"true\". Unset variables evaluate as 0.",
        },
        "description": {"type": "string"},
    },
    "required": ["type", "name", "value"],
    "additionalProperties": False,
}

d["conditionExpression"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["expression_if", "expression_unless"]},
        "expression": {
            "type": "string",
            "description": "exprtk syntax. Undefined variables are 0. system.* and accessibility.* variables are available.",
        },
        "description": {"type": "string"},
    },
    "required": ["type", "expression"],
    "additionalProperties": False,
}

d["conditionEventChanged"] = {
    "type": "object",
    "properties": {
        "type": {"enum": ["event_changed_if", "event_changed_unless"]},
        "value": {"type": "boolean"},
        "description": {"type": "string"},
    },
    "required": ["type", "value"],
    "additionalProperties": False,
}

OUT.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
