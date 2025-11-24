#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/richkingsasu/algobot-tastytrade"
REMOTE="origin"
cd "${PROJECT_DIR}"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🔧 Syncing branch: ${BRANCH}"

echo "Fetching remote ${REMOTE}..."
git fetch "${REMOTE}"

AHEAD=$(git rev-list --count HEAD..${REMOTE}/${BRANCH})
BEHIND=$(git rev-list --count ${REMOTE}/${BRANCH}..HEAD)

echo "Result — ahead by ${BEHIND}, behind by ${AHEAD}"

if [[ "${BEHIND}" -gt 0 ]]; then
  echo "⚠️  You have ${BEHIND} local commits not pushed to remote."
  echo "Please push your local commits before continuing."
  exit 1
fi

if [[ "${AHEAD}" -gt 0 ]]; then
  echo "⬇️  Local branch is behind remote by ${AHEAD} commits. Attempting fast‐forward pull..."
  git pull --ff-only "${REMOTE}" "${BRANCH}"
  echo "✅ Successfully pulled latest changes."
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  There are uncommitted changes in the working tree:"
  git status --porcelain
  echo "Please commit or stash them before continuing."
  exit 1
fi

echo "🚀 Local repository is fully synced with remote."
