#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/layer_indicator_user_command_server.py"
ENDPOINT_FILE="${SCRIPT_DIR}/layer-indicator-user-command-endpoint.txt"
CONFIG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/karabiner"
LOG_PATH="${LOG_DIR}/layer-indicator-user-command-server.log"

if [[ ! -f "$SERVER_SCRIPT" ]]; then
  echo "Server script not found: $SERVER_SCRIPT" >&2
  exit 1
fi

UV_BIN="${HOME}/.local/bin/uv"
if [[ ! -x "$UV_BIN" ]]; then
  if command -v uv >/dev/null 2>&1; then
    UV_BIN="$(command -v uv)"
  else
    echo "uv not found. Install uv or ensure ${HOME}/.local/bin/uv exists." >&2
    exit 1
  fi
fi

PYTHON_BIN="${HOME}/Scripts/.venv/shared_venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python interpreter not found: $PYTHON_BIN" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

SOCKET_PATH="/tmp/karabiner-layer-indicator.sock"
if [[ -f "$ENDPOINT_FILE" ]]; then
  SOCKET_PATH="$(tr -d '\n' < "$ENDPOINT_FILE")"
fi

UV_ARGS=(
  run
  --python "$PYTHON_BIN"
  "$SERVER_SCRIPT"
  --socket-path "$SOCKET_PATH"
  --log-path "$LOG_PATH"
)

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  UV_ARGS+=(--dry-run)
fi

exec "$UV_BIN" "${UV_ARGS[@]}"
