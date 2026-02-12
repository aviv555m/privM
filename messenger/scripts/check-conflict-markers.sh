#!/usr/bin/env bash
set -euo pipefail

# Fail if unresolved git merge markers exist in source files.
PATTERN='^(<<<<<<<|=======|>>>>>>>)'

if rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' "$PATTERN" .; then
  echo
  echo "❌ Unresolved merge conflict markers found. Resolve and commit before building."
  exit 1
fi

echo "✅ No merge conflict markers found."
