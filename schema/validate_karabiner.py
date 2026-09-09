#!/usr/bin/env python3
"""Validate Karabiner-Elements complex modification JSON against karabiner-rule.schema.json.

Usage:
    ./validate_karabiner.py FILE [FILE ...]
    ./validate_karabiner.py --node output karabiner-output.json   # {"complex_modifications": {...}}
    ./validate_karabiner.py --node karabiner ~/.config/karabiner/karabiner.json
    ./validate_karabiner.py --node rule FILE          # file contains a bare rule object
    ./validate_karabiner.py --node manipulator FILE   # file contains a bare manipulator
    ./validate_karabiner.py --lenient FILE            # relax key-code enums to free strings
    ./validate_karabiner.py ~/.config/karabiner/assets/complex_modifications/*.json

Exit status: 0 all valid, 1 validation errors, 2 usage/IO error.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Iterator

try:
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover
    print("missing dependency: pip3 install jsonschema", file=sys.stderr)
    raise SystemExit(2)

SCHEMA_PATH = Path(__file__).resolve().parent / "karabiner-rule.schema.json"

NODE_REFS: dict[str, str] = {
    "file": "#/$defs/complexModificationsFile",
    "karabiner": "#/$defs/karabinerConfig",
    "output": "#/$defs/complexModificationsBlock",
    "rules": "#/$defs/rules",
    "parameters": "#/$defs/parameters",
    "rule": "#/$defs/rule",
    "manipulator": "#/$defs/manipulator",
    "from": "#/$defs/fromEventDefinition",
    "to": "#/$defs/toEventDefinition",
    "condition": "#/$defs/condition",
}

LOG_FORMAT = "%(asctime)s %(levelname)s %(message)s"
logger = logging.getLogger("validate_karabiner")


def strip_json_comments(text: str) -> str:
    """Remove // and /* */ comments, which Karabiner tolerates but json does not."""
    out: list[str] = []
    i, n = 0, len(text)
    in_string = False
    escaped = False
    while i < n:
        ch = text[i]
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def relax_key_code_enums(node: Any) -> Any:
    """Replace key-code name enums with free strings for forward compatibility."""
    if isinstance(node, dict):
        anyof = node.get("anyOf")
        if (
            isinstance(anyof, list)
            and len(anyof) == 2
            and isinstance(anyof[0], dict)
            and anyof[0].get("type") == "string"
            and isinstance(anyof[0].get("enum"), list)
            and len(anyof[0]["enum"]) > 5
            and isinstance(anyof[1], dict)
            and anyof[1].get("type") == "integer"
        ):
            relaxed = dict(node)
            relaxed["anyOf"] = [{"type": "string"}, {"type": "integer"}]
            return relaxed
        return {k: relax_key_code_enums(v) for k, v in node.items()}
    if isinstance(node, list):
        return [relax_key_code_enums(v) for v in node]
    return node


def load_schema(node: str, lenient: bool) -> dict[str, Any]:
    schema: dict[str, Any] = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    if lenient:
        schema = relax_key_code_enums(schema)
    schema = dict(schema)
    schema["$ref"] = NODE_REFS[node]
    Draft202012Validator.check_schema(schema)
    return schema


def pointer(error: Any) -> str:
    parts = [str(p) for p in error.absolute_path]
    return "/" + "/".join(parts) if parts else "<root>"


def describe(error: Any) -> tuple[Any, str]:
    """Descend into oneOf/anyOf context and return (error, human message)."""
    context = getattr(error, "context", None)
    if not context:
        return error, error.message.split("\n")[0]

    deepest = max(context, key=lambda e: len(list(e.absolute_path)))
    if len(list(deepest.absolute_path)) > len(list(error.absolute_path)):
        return describe(deepest)

    description = error.schema.get("description") if isinstance(error.schema, dict) else None
    value = json.dumps(error.instance, ensure_ascii=False)
    if len(value) > 80:
        value = value[:77] + "..."
    if description:
        return error, f"{value} is not valid here. {description}"
    return error, f"{value} does not match any allowed form"


def validate_path(path: Path, validator: Draft202012Validator) -> Iterator[str]:
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        yield f"{path}: cannot read: {exc}"
        return
    try:
        document = json.loads(strip_json_comments(raw))
    except json.JSONDecodeError as exc:
        yield f"{path}: invalid JSON at line {exc.lineno} column {exc.colno}: {exc.msg}"
        return
    for error in sorted(validator.iter_errors(document), key=lambda e: list(e.absolute_path)):
        specific, message = describe(error)
        if len(message) > 300:
            message = message[:297] + "..."
        yield f"{path}: {pointer(specific)}: {message}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--node", choices=sorted(NODE_REFS), default="file",
                        help="which schema node the file represents (default: file)")
    parser.add_argument("--lenient", action="store_true",
                        help="accept unknown key-code names (forward compatibility with new KE releases)")
    parser.add_argument("--quiet", action="store_true", help="print errors only")
    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING if args.quiet else logging.INFO,
                        format=LOG_FORMAT, datefmt="%Y-%m-%dT%H:%M:%S%z")

    if not SCHEMA_PATH.is_file():
        logger.error("schema not found: %s", SCHEMA_PATH)
        return 2

    try:
        validator = Draft202012Validator(load_schema(args.node, args.lenient))
    except Exception as exc:  # schema itself is broken
        logger.error("schema error: %s", exc)
        return 2

    failures = 0
    for path in args.files:
        errors = list(validate_path(path, validator))
        if errors:
            failures += 1
            for line in errors:
                print(line, file=sys.stderr)
        elif not args.quiet:
            logger.info("ok: %s", path)

    if failures:
        logger.error("%d of %d file(s) failed validation", failures, len(args.files))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
