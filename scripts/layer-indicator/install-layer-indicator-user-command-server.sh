#!/usr/bin/env bash
set -euo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

# Installs and bootstraps the Karabiner layer-indicator user-command server
# as a per-user LaunchAgent.

LABEL="uk.knoxhaus.karabiner-layer-indicator-user-command-server"
ROTATE_LABEL="uk.knoxhaus.karabiner-layer-indicator-user-command-server-log-rotate"
MAX_LOG_SIZE_BYTES="${MAX_LOG_SIZE_BYTES:-1048576}"
MAX_LOG_BACKUPS="${MAX_LOG_BACKUPS:-5}"
ROTATE_INTERVAL_SECONDS="${ROTATE_INTERVAL_SECONDS:-900}"
SMOKE_MAX_LATENCY_MS="${SMOKE_MAX_LATENCY_MS:-500}"
ENABLE_AUTO_ROTATE_ON_INSTALL="${ENABLE_AUTO_ROTATE_ON_INSTALL:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
START_SCRIPT="${SCRIPT_DIR}/start-layer-indicator-user-command-server.sh"
ENDPOINT_FILE="${SCRIPT_DIR}/layer-indicator-user-command-endpoint.txt"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/karabiner"

LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
PLIST_TARGET="${LAUNCH_AGENTS_DIR}/${LABEL}.plist"
ROTATE_PLIST_TARGET="${LAUNCH_AGENTS_DIR}/${ROTATE_LABEL}.plist"
SERVICE_ID="gui/$(id -u)/${LABEL}"
ROTATE_SERVICE_ID="gui/$(id -u)/${ROTATE_LABEL}"

LOG_FILES=(
  "${LOG_DIR}/layer-indicator-user-command-server.log"
  "${LOG_DIR}/layer-indicator-user-command-server.launchd.out.log"
  "${LOG_DIR}/layer-indicator-user-command-server.launchd.err.log"
)

read_socket_path() {
  if [[ -f "${ENDPOINT_FILE}" ]]; then
    tr -d '\n' < "${ENDPOINT_FILE}"
    return
  fi

  printf '%s' '/tmp/karabiner-layer-indicator.sock'
}

SOCKET_PATH="$(read_socket_path)"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 1
  fi
}

ensure_paths() {
  if [[ ! -f "${START_SCRIPT}" ]]; then
    echo "Start script not found: ${START_SCRIPT}" >&2
    exit 1
  fi

  mkdir -p "${LAUNCH_AGENTS_DIR}"
  mkdir -p "${LOG_DIR}"
}

write_plist() {
  cat >"${PLIST_TARGET}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${START_SCRIPT}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>WorkingDirectory</key>
  <string>${PROJECT_DIR}</string>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/layer-indicator-user-command-server.launchd.out.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/layer-indicator-user-command-server.launchd.err.log</string>
</dict>
</plist>
PLIST
}

write_rotate_plist() {
  cat >"${ROTATE_PLIST_TARGET}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${ROTATE_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${BASH_SOURCE[0]}</string>
    <string>rotate-logs</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>StartInterval</key>
  <integer>${ROTATE_INTERVAL_SECONDS}</integer>

  <key>StandardOutPath</key>
  <string>${LOG_DIR}/layer-indicator-user-command-rotate.launchd.out.log</string>

  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/layer-indicator-user-command-rotate.launchd.err.log</string>
</dict>
</plist>
PLIST
}

bootout_if_loaded() {
  launchctl bootout "${SERVICE_ID}" >/dev/null 2>&1 || true
}

bootout_rotate_if_loaded() {
  launchctl bootout "${ROTATE_SERVICE_ID}" >/dev/null 2>&1 || true
}

bootstrap() {
  bootout_if_loaded
  launchctl bootstrap "gui/$(id -u)" "${PLIST_TARGET}"
  launchctl kickstart -k "${SERVICE_ID}"
}

bootstrap_rotate() {
  bootout_rotate_if_loaded
  launchctl bootstrap "gui/$(id -u)" "${ROTATE_PLIST_TARGET}"
  launchctl kickstart -k "${ROTATE_SERVICE_ID}"
}

print_status() {
  local loaded="false"
  if launchctl print "${SERVICE_ID}" >/dev/null 2>&1; then
    loaded="true"
  fi

  local socket_present="false"
  if [[ -S "${SOCKET_PATH}" ]]; then
    socket_present="true"
  fi

  local rotate_loaded="false"
  if launchctl print "${ROTATE_SERVICE_ID}" >/dev/null 2>&1; then
    rotate_loaded="true"
  fi

  echo "Service: ${SERVICE_ID}"
  echo "launchctl: $([[ "${loaded}" == "true" ]] && echo loaded || echo not loaded)"
  echo "endpoint: ${SOCKET_PATH}"
  echo "socket: $([[ "${socket_present}" == "true" ]] && echo "present (${SOCKET_PATH})" || echo "missing (${SOCKET_PATH})")"
  echo "auto_rotate: $([[ "${rotate_loaded}" == "true" ]] && echo "enabled (${ROTATE_INTERVAL_SECONDS}s)" || echo disabled)"

  if [[ -f "${LOG_DIR}/layer-indicator-user-command-server.log" ]]; then
    local last_log_ts
    last_log_ts="$(tail -n 1 "${LOG_DIR}/layer-indicator-user-command-server.log" | awk '{print $1" "$2}')"
    echo "last_log_timestamp: ${last_log_ts}"
    echo "recent server log:"
    tail -n 5 "${LOG_DIR}/layer-indicator-user-command-server.log" || true
  fi
}

print_status_json() {
  local loaded="false"
  if launchctl print "${SERVICE_ID}" >/dev/null 2>&1; then
    loaded="true"
  fi

  local socket_present="false"
  if [[ -S "${SOCKET_PATH}" ]]; then
    socket_present="true"
  fi

  local rotate_loaded="false"
  if launchctl print "${ROTATE_SERVICE_ID}" >/dev/null 2>&1; then
    rotate_loaded="true"
  fi

  local last_log_timestamp=""
  if [[ -f "${LOG_DIR}/layer-indicator-user-command-server.log" ]]; then
    last_log_timestamp="$(tail -n 1 "${LOG_DIR}/layer-indicator-user-command-server.log" | awk '{print $1" "$2}')"
  fi

  cat <<JSON
{
  "label": "${LABEL}",
  "service_id": "${SERVICE_ID}",
  "loaded": ${loaded},
  "socket_path": "${SOCKET_PATH}",
  "socket_present": ${socket_present},
  "auto_rotate_service_id": "${ROTATE_SERVICE_ID}",
  "auto_rotate_loaded": ${rotate_loaded},
  "auto_rotate_interval_seconds": ${ROTATE_INTERVAL_SECONDS},
  "last_log_timestamp": "${last_log_timestamp}",
  "plist_target": "${PLIST_TARGET}",
  "rotate_plist_target": "${ROTATE_PLIST_TARGET}",
  "start_script": "${START_SCRIPT}",
  "endpoint_file": "${ENDPOINT_FILE}",
  "log_path": "${LOG_DIR}/layer-indicator-user-command-server.log"
}
JSON
}

install_and_start() {
  require_command launchctl
  ensure_paths
  write_plist
  bootstrap

  if [[ "${ENABLE_AUTO_ROTATE_ON_INSTALL}" == "1" ]]; then
    write_rotate_plist
    bootstrap_rotate
  fi

  # Give launchd a moment to start and bind the socket.
  sleep 0.4

  echo "Installed LaunchAgent at: ${PLIST_TARGET}"
  print_status
}

uninstall() {
  require_command launchctl
  bootout_if_loaded
  bootout_rotate_if_loaded
  rm -f "${PLIST_TARGET}"
  rm -f "${ROTATE_PLIST_TARGET}"
  echo "Removed LaunchAgent plist: ${PLIST_TARGET}"
  echo "Removed LaunchAgent plist: ${ROTATE_PLIST_TARGET}"
  print_status
}

self_test() {
  require_command launchctl

  if ! launchctl print "${SERVICE_ID}" >/dev/null 2>&1; then
    echo "Service is not loaded: ${SERVICE_ID}" >&2
    exit 1
  fi

  if [[ ! -S "${SOCKET_PATH}" ]]; then
    echo "Socket missing: ${SOCKET_PATH}" >&2
    exit 1
  fi

  local marker="self_test_$(date +%s)"

  /usr/bin/python3 - "${SOCKET_PATH}" "${marker}" <<'PY'
import json
import socket
import sys

sock_path = sys.argv[1]
marker = sys.argv[2]

payload = {
    "action": "hide",
    "source": "installer_self_test",
    "marker": marker,
}

sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
sock.sendto(json.dumps(payload).encode("utf-8"), sock_path)
sock.close()
PY

  sleep 0.4

  local log_path="${LOG_DIR}/layer-indicator-user-command-server.log"
  if [[ ! -f "${log_path}" ]]; then
    echo "Self-test sent but server log not found at ${log_path}" >&2
    exit 1
  fi

  if tail -n 50 "${log_path}" | grep -Fq "${marker}"; then
    echo "self-test: pass (marker=${marker})"
    return
  fi

  echo "self-test: failed (marker not found in recent logs)" >&2
  exit 1
}

observability_bundle() {
  require_command launchctl
  echo "=== Layer Indicator Observability Bundle ==="
  echo
  echo "=== [1/4] Status JSON ==="
  print_status_json
  echo
  echo "=== [2/4] Self-Test ==="
  self_test
  echo
  echo "=== [3/4] Smoke-Check ==="
  smoke_check
  echo
  echo "=== [4/4] Log Rotation Summary ==="
  ensure_paths
  for file in "${LOG_FILES[@]}"; do
    local size=$(stat -f%z "$file" 2>/dev/null || echo 0)
    local size_mb=$(echo "scale=2; $size / 1048576" | bc)
    echo "  $file: ${size} bytes (${size_mb} MB)"
  done
  echo
  echo "✓ Observability bundle complete"
}

check_health() {
  require_command launchctl
  echo "=== status --json ==="
  print_status_json
  echo
  echo "=== self-test ==="
  self_test
}

smoke_check() {
  require_command launchctl

  if ! launchctl print "${SERVICE_ID}" >/dev/null 2>&1; then
    echo "Service is not loaded: ${SERVICE_ID}" >&2
    exit 1
  fi

  if [[ ! -S "${SOCKET_PATH}" ]]; then
    echo "Socket missing: ${SOCKET_PATH}" >&2
    exit 1
  fi

  local marker_base="smoke_$(date +%s)"
  local marker_show="${marker_base}_show"
  local marker_hide="${marker_base}_hide"

  /usr/bin/python3 - "${SOCKET_PATH}" "${marker_show}" "${marker_hide}" <<'PY'
import json
import socket
import sys

sock_path = sys.argv[1]
marker_show = sys.argv[2]
marker_hide = sys.argv[3]

sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
sock.sendto(json.dumps({
    "action": "show",
    "layer": "space",
    "source": "installer_smoke_test",
    "marker": marker_show,
}).encode("utf-8"), sock_path)
sock.sendto(json.dumps({
    "action": "hide",
    "source": "installer_smoke_test",
    "marker": marker_hide,
}).encode("utf-8"), sock_path)
sock.close()
PY

  sleep 0.6

  local log_path="${LOG_DIR}/layer-indicator-user-command-server.log"
  if [[ ! -f "${log_path}" ]]; then
    echo "smoke-check: log missing at ${log_path}" >&2
    exit 1
  fi

  /usr/bin/python3 - "${log_path}" "${marker_show}" "${marker_hide}" "${SMOKE_MAX_LATENCY_MS}" <<'PY'
import pathlib
import re
import sys

log_path = pathlib.Path(sys.argv[1])
marker_show = sys.argv[2]
marker_hide = sys.argv[3]
max_latency_ms = float(sys.argv[4])

lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
window = lines[-500:]

pat = re.compile(r"dispatched action=(show|hide) marker=([^ ]+) elapsed_ms=([0-9.]+)")
hits = {}
for line in window:
    m = pat.search(line)
    if not m:
        continue
    action, marker, elapsed = m.group(1), m.group(2), float(m.group(3))
    if marker in (marker_show, marker_hide):
        hits[marker] = (action, elapsed)

missing = [m for m in (marker_show, marker_hide) if m not in hits]
if missing:
    print(f"smoke-check: missing dispatch log for markers={missing}", file=sys.stderr)
    raise SystemExit(1)

show_elapsed = hits[marker_show][1]
hide_elapsed = hits[marker_hide][1]
worst = max(show_elapsed, hide_elapsed)

if worst > max_latency_ms:
    print(
        f"smoke-check: fail show_ms={show_elapsed:.2f} hide_ms={hide_elapsed:.2f} max_allowed_ms={max_latency_ms:.2f}",
        file=sys.stderr,
    )
    raise SystemExit(1)

print(
    f"smoke-check: pass show_ms={show_elapsed:.2f} hide_ms={hide_elapsed:.2f} max_allowed_ms={max_latency_ms:.2f}"
)
PY
}

file_size_bytes() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf '%s' 0
    return
  fi

  stat -f%z "$file"
}

rotate_one_log() {
  local file="$1"
  local size
  size="$(file_size_bytes "$file")"

  if (( size < MAX_LOG_SIZE_BYTES )); then
    return
  fi

  local i
  for (( i=MAX_LOG_BACKUPS; i>=1; i-- )); do
    local src="${file}.${i}"
    local dst="${file}.$((i + 1))"
    if [[ -f "$src" ]]; then
      if (( i == MAX_LOG_BACKUPS )); then
        rm -f "$src"
      else
        mv "$src" "$dst"
      fi
    fi
  done

  mv "$file" "${file}.1"
  : > "$file"
  echo "rotated: $file"
}

rotate_logs() {
  ensure_paths
  local file
  for file in "${LOG_FILES[@]}"; do
    rotate_one_log "$file"
  done
}

enable_auto_rotate() {
  require_command launchctl
  ensure_paths
  write_rotate_plist
  bootstrap_rotate
  echo "Enabled auto-rotate LaunchAgent: ${ROTATE_PLIST_TARGET}"
}

disable_auto_rotate() {
  require_command launchctl
  bootout_rotate_if_loaded
  rm -f "${ROTATE_PLIST_TARGET}"
  echo "Disabled auto-rotate LaunchAgent: ${ROTATE_PLIST_TARGET}"
}

usage() {
  cat <<USAGE
Usage: $(basename "$0") [install|status [--json]|restart|self-test|smoke-check|check|doctor|rotate-logs|enable-auto-rotate|disable-auto-rotate|observability-bundle|uninstall]

Commands:
  install    Install plist and bootstrap service (default)
  status     Show launchctl + socket status
  status --json
             Emit machine-readable JSON status
  restart    Restart service via launchctl
  self-test  Send a test payload to the socket and verify it appears in logs
  smoke-check
             Send show/hide sample payloads and verify dispatch latency from logs
  check      Run status --json and self-test together
  doctor     Alias of check
  rotate-logs
             Rotate logs if they exceed MAX_LOG_SIZE_BYTES (default 1048576)
  enable-auto-rotate
             Install and start periodic launchd log rotation (StartInterval)
  disable-auto-rotate
             Stop and remove periodic launchd log rotation
  observability-bundle
             Run full observability check: status, self-test, smoke-check, and log summary
  uninstall  Unload service and remove plist
USAGE
}

main() {
  local command="${1:-install}"
  case "${command}" in
    install)
      install_and_start
      ;;
    status)
      require_command launchctl
      if [[ "${2:-}" == "--json" ]]; then
        print_status_json
      else
        print_status
      fi
      ;;
    restart)
      require_command launchctl
      ensure_paths
      write_plist
      bootstrap
      if [[ "${ENABLE_AUTO_ROTATE_ON_INSTALL}" == "1" ]]; then
        write_rotate_plist
        bootstrap_rotate
      fi
      sleep 0.4
      print_status
      ;;
    self-test)
      self_test
      ;;
    smoke-check)
      smoke_check
      ;;
    check)
      check_health
      ;;
    doctor)
      check_health
      ;;
    rotate-logs)
      rotate_logs
      ;;
    enable-auto-rotate)
      enable_auto_rotate
      ;;
    disable-auto-rotate)
      disable_auto_rotate
      ;;
    observability-bundle)
      observability_bundle
      ;;
    uninstall)
      uninstall
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "Unknown command: ${command}" >&2
      usage
      exit 2
      ;;
  esac
}

main "$@"
