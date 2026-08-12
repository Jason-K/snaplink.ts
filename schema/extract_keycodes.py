#!/usr/bin/env python3
"""Refresh karabiner-keycodes.json from a Karabiner-Elements source checkout.

The names come from the parser's own lookup tables in
src/share/types/momentary_switch_event_details/, which are broader than the UI
resource file src/apps/SettingsWindow/Resources/simple_modifications.json
(that one omits key_code "eject", consumer_key_code "power" and "voice_command",
and apple_vendor_keyboard_key_code "expose_all").

    git clone --depth 1 https://github.com/pqrs-org/Karabiner-Elements
    python3 extract_keycodes.py ./Karabiner-Elements
    python3 gen_schema.py
"""

from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "karabiner-keycodes.json"
DETAILS = Path("src/share/types/momentary_switch_event_details")

TABLES: dict[str, str] = {
    "key_code.hpp": "key_code",
    "consumer_key_code.hpp": "consumer_key_code",
    "apple_vendor_keyboard_key_code.hpp": "apple_vendor_keyboard_key_code",
    "apple_vendor_top_case_key_code.hpp": "apple_vendor_top_case_key_code",
    "generic_desktop.hpp": "generic_desktop",
    "pointing_button.hpp": "pointing_button",
}

NAME_RE = re.compile(r'\{"([A-Za-z0-9_]+)",')

logger = logging.getLogger("extract_keycodes")


def extract(checkout: Path) -> dict[str, list[str]]:
    details = checkout / DETAILS
    if not details.is_dir():
        raise FileNotFoundError(f"not a Karabiner-Elements checkout: {details} missing")

    result: dict[str, list[str]] = {}
    for filename, key in TABLES.items():
        path = details / filename
        if not path.is_file():
            raise FileNotFoundError(f"missing table: {path}")
        names = sorted(set(NAME_RE.findall(path.read_text(encoding="utf-8"))))
        if not names:
            raise ValueError(f"no names parsed from {path}")
        result[key] = names
        logger.info("%s: %d names", key, len(names))
    return result


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        datefmt="%Y-%m-%dT%H:%M:%S%z")
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    checkout = Path(argv[1]).expanduser().resolve()
    try:
        tables = extract(checkout)
    except (FileNotFoundError, ValueError) as exc:
        logger.error("%s", exc)
        return 2

    if OUT.exists():
        previous: dict[str, list[str]] = json.loads(OUT.read_text(encoding="utf-8"))
        for key, names in tables.items():
            added = sorted(set(names) - set(previous.get(key, [])))
            removed = sorted(set(previous.get(key, [])) - set(names))
            if added:
                logger.info("%s added: %s", key, ", ".join(added))
            if removed:
                logger.warning("%s removed: %s", key, ", ".join(removed))

    OUT.write_text(json.dumps(tables, indent=1) + "\n", encoding="utf-8")
    logger.info("wrote %s", OUT)
    logger.info("now run: python3 gen_schema.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
