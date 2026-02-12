#!/usr/bin/env bash
set -euo pipefail

# Resolve the recurring PR conflict files by choosing incoming/main side
# while merging main into feature branch.

FILES=(
  "messenger/apps/mobile/src/screens/ChatRoomScreen.tsx"
  "messenger/apps/web/app/globals.css"
  "messenger/apps/web/app/page.tsx"
)

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not inside a git repository." >&2
  exit 1
fi

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
