#!/usr/bin/env bash
# Cross-platform launcher (macOS / Linux / Git Bash / WSL).
# Delegates to the Node implementation so behavior stays identical.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${NODE_BIN:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "Node.js is required to run collect-port-evidence (NODE_BIN=$NODE_BIN)." >&2
  exit 127
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required on PATH." >&2
  exit 127
fi

exec "$NODE_BIN" "$SCRIPT_DIR/collect-port-evidence.mjs" "$@"
