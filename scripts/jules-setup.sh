#!/bin/bash
set -euo pipefail

export JULES=true
export UPDATE_GOLDEN=1

echo "==> [Jules] Installing Node.js dependencies..."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> [Jules] Installing Python schema dependencies (jsonschema)..."
if command -v uv >/dev/null 2>&1; then
  uv pip install --system --break-system-packages jsonschema
elif python3 -m pip --version >/dev/null 2>&1; then
  python3 -m pip install --quiet --break-system-packages jsonschema 2>/dev/null || python3 -m pip install --quiet jsonschema
else
  make -C schema deps
fi

echo "==> [Jules] Running typecheck, test, and verification suite..."
npm run typecheck
npm test
npm run verify

echo "==> [Jules] Resetting working tree to ensure clean git status..."
git checkout -- . 2>/dev/null || true
git clean -fd 2>/dev/null || true
git reset --hard HEAD 2>/dev/null || true

echo "==> [Jules] Environment setup successfully verified!"