#!/usr/bin/env bash
set -euo pipefail

checkout="${1:?Expected SDK checkout}"
before="${2-}"
after="${3:-HEAD}"

# Unknown history must refresh rather than silently leave the website stale.
if [[ ! "$before" =~ ^[0-9a-f]{40}$ && ! "$before" =~ ^[0-9a-f]{64}$ ]] ||
   ! git -C "$checkout" cat-file -e "$before^{commit}" 2>/dev/null; then
  echo 'changed=true'
  exit 0
fi

# Resolve the target before diffing so malformed revisions fail, never look unchanged.
after="$(git -C "$checkout" rev-parse --verify --end-of-options "$after^{commit}")"
if git -C "$checkout" diff --quiet --no-renames "$before" "$after" -- docs/developer; then
  echo 'changed=false'
else
  result=$?
  if [[ "$result" != 1 ]]; then
    exit "$result"
  fi
  echo 'changed=true'
fi
