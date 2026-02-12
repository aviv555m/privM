#!/usr/bin/env bash
set -euo pipefail

# Resolve recurring PR conflict files by choosing the incoming/main side.
# Works whether run from the monorepo root (messenger/) or its parent repo.

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not inside a git repository." >&2
  exit 1
fi

if [[ -d "messenger/apps/web" ]]; then
  BASE="messenger"
elif [[ -d "apps/web" ]]; then
  BASE="."
else
  echo "Could not locate messenger workspace root (apps/web). Run from repo root." >&2
  exit 1
fi

FILES=(
  "$BASE/package.json"
  "$BASE/apps/mobile/src/screens/ChatRoomScreen.tsx"
  "$BASE/apps/web/app/globals.css"
  "$BASE/apps/web/app/page.tsx"
)

for file in "${FILES[@]}"; do
  if git ls-files -u -- "$file" | grep -q .; then
    git checkout --theirs -- "$file"
    git add "$file"
    echo "Resolved with incoming/main version: $file"
  else
    echo "No conflict found for: $file"
  fi
done

echo
echo "Done. Run: git status"
echo "If all conflicts are resolved, commit the merge:"
echo "  git commit -m \"fix: resolve known merge conflicts\""
