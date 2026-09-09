#!/usr/bin/env -S uv run --python /Users/jason/Scripts/.venv/shared_venv/bin/python
"""
Karabiner user-command receiver for extensible endpoint dispatch.

Listens on a Unix datagram socket and routes payloads to different handlers
(endpoints) based on the 'endpoint' field. Currently supports:

1. layer_indicator (default):
   {"action": "show", "layer": "space", "marker": "id"}
   {"action": "hide", "marker": "id"}

2. hammerspoon:
   {"endpoint": "hammerspoon", "function": "showNotification", "args": {"title": "..."}}

Each endpoint has its own dispatch logic and safety constraints.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any

DEFAULT_SOCKET_PATH = "/tmp/karabiner-layer-indicator.sock"
DEFAULT_LOG_PATH = Path.home() / ".local/state/karabiner/layer-indicator-user-command-server.log"
ENDPOINT_FILE_PATH = Path(__file__).with_name("layer-indicator-user-command-endpoint.txt")


def read_default_socket_path() -> str:
    try:
        endpoint = ENDPOINT_FILE_PATH.read_text(encoding="utf-8").strip()
        return endpoint or DEFAULT_SOCKET_PATH
    except OSError:
        return DEFAULT_SOCKET_PATH


def configure_logging(log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path),
            logging.StreamHandler(sys.stdout),
        ],
    )


def build_url(payload: dict[str, Any]) -> str:
    action = str(payload.get("action", "show"))
    if action == "hide":
        return "hammerspoon://layer_indicator?action=hide"

    layer = str(payload.get("layer", "space"))
    return f"hammerspoon://layer_indicator?action=show&layer={layer}"


def dispatch_layer_indicator(payload: dict[str, Any], dry_run: bool) -> float:
    """Dispatch to layer indicator Hammerspoon endpoint."""
    url = build_url(payload)
    start = time.perf_counter()
    if dry_run:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        logging.info("dry_run_dispatch url=%s elapsed_ms=%.2f", url, elapsed_ms)
        return elapsed_ms

    completed = subprocess.run(
        ["/usr/bin/open", "-g", url],
        check=False,
        capture_output=True,
        text=True,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    if completed.returncode != 0:
        logging.error("open failed rc=%s stderr=%s", completed.returncode, completed.stderr.strip())
    return elapsed_ms


def dispatch_hammerspoon(payload: dict[str, Any], dry_run: bool) -> float:
    """Dispatch to arbitrary Hammerspoon functions via URL scheme.

    Allowed functions (allowlist for safety):
      - showNotification: {title, subtitle, informativeText}
      - focusApp: {bundleId}
      - copyToClipboard: {text}

    Payload format:
      {"endpoint": "hammerspoon", "function": "functionName", "args": {...}}
    """
    function = str(payload.get("function", ""))
    args = payload.get("args", {})

    # Allowlist of safe functions
    allowed_functions = {
        "showNotification": "showNotification",
        "focusApp": "focusApp",
        "copyToClipboard": "copyToClipboard",
    }

    if function not in allowed_functions:
        logging.error("hammerspoon: function not allowed function=%s", function)
        return 0.0

    # Build URL with serialized args
    args_encoded = urllib.parse.urlencode({"args": json.dumps(args)})
    url = f"hammerspoon://userCommand/{function}?{args_encoded}"

    start = time.perf_counter()
    if dry_run:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        logging.info("dry_run_dispatch endpoint=hammerspoon function=%s elapsed_ms=%.2f", function, elapsed_ms)
        return elapsed_ms

    completed = subprocess.run(
        ["/usr/bin/open", "-g", url],
        check=False,
        capture_output=True,
        text=True,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    if completed.returncode != 0:
        logging.error("hammerspoon dispatch failed rc=%s stderr=%s", completed.returncode, completed.stderr.strip())
    return elapsed_ms


def dispatch(payload: dict[str, Any], dry_run: bool) -> float:
    """Route payload to appropriate endpoint handler."""
    endpoint = str(payload.get("endpoint", "layer_indicator"))

    if endpoint == "layer_indicator":
        return dispatch_layer_indicator(payload, dry_run)
    elif endpoint == "hammerspoon":
        return dispatch_hammerspoon(payload, dry_run)
    else:
        logging.error("unknown endpoint=%s", endpoint)
        return 0.0


def main() -> int:
    parser = argparse.ArgumentParser(description="Karabiner send_user_command receiver for layer indicator")
    parser.add_argument("--socket-path", default=read_default_socket_path())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log-path", default=str(DEFAULT_LOG_PATH))
    args = parser.parse_args()

    configure_logging(Path(args.log_path))

    socket_path = Path(args.socket_path)
    socket_path.parent.mkdir(parents=True, exist_ok=True)
    if socket_path.exists():
        socket_path.unlink()

    sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        sock.bind(str(socket_path))
    except OSError as exc:
        logging.error("bind failed socket=%s error=%s", socket_path, exc)
        return 2
    os.chmod(socket_path, 0o666)

    logging.info("listening socket=%s dry_run=%s", socket_path, args.dry_run)

    keep_running = True

    def _stop(_sig: int, _frame: Any) -> None:
        nonlocal keep_running
        keep_running = False

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    try:
        while keep_running:
            try:
                data = sock.recv(8192)
            except OSError as exc:
                logging.error("recv error: %s", exc)
                continue

            raw = data.decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError as exc:
                logging.error("invalid json payload=%r error=%s", raw, exc)
                continue

            if not isinstance(payload, dict):
                logging.error("unexpected payload type=%s payload=%r", type(payload).__name__, payload)
                continue

            logging.info("received payload=%s", payload)
            elapsed_ms = dispatch(payload, args.dry_run)
            action = str(payload.get("action", "show"))
            marker = str(payload.get("marker", ""))
            logging.info("dispatched action=%s marker=%s elapsed_ms=%.2f", action, marker, elapsed_ms)
    finally:
        sock.close()
        if socket_path.exists():
            socket_path.unlink()
        logging.info("server stopped")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
