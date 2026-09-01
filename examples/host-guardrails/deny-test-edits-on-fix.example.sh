#!/bin/sh
# Example only — not installed by jj-flow.
# When JJ_FIX_MODE=1, refuse edits under tests/ so a fix cannot weaken the check.
if [ "$JJ_FIX_MODE" != "1" ]; then
  exit 0
fi
target=${1:-}
case "$target" in
  tests/*|*/tests/*|*.test.*|*.spec.*)
    echo "JJ_FIX_MODE=1: do not edit test files; add a new test instead." >&2
    exit 2
    ;;
esac
exit 0
