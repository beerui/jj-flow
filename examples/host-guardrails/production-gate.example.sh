#!/bin/sh
# Example only — not installed by jj-flow.
# Host PreToolUse / equivalent: block production deploy without RELEASE_APPROVAL.
cmd=${1:-}
if printf '%s' "$cmd" | grep -q 'deploy' && printf '%s' "$cmd" | grep -q 'production'; then
  if [ -z "$RELEASE_APPROVAL" ]; then
    echo "Production deploys need RELEASE_APPROVAL." >&2
    exit 2
  fi
fi
exit 0
