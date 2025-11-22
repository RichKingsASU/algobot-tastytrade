#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/richkingsasu/algobot-tastytrade"
REMOTE="origin"
BRANCH="$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD)"

echo "=== DAILY GIT SYNC START ==="
cd "${PROJECT_DIR}"

echo "Current branch: ${BRANCH}"
echo "Fetching from remote..."
git fetch "${REMOTE}"

echo "Checking local ahead of remote..."
LOCAL_AHEAD=$(git rev-list --count ${REMOTE}/${BRANCH}..HEAD)
if [ "${LOCAL_AHEAD}" -gt 0 ]; then
  echo "You have ${LOCAL_AHEAD} un-pushed commits."
  echo "Please push or stash your changes before syncing."
  exit 1
fi

echo "Checking local behind remote..."
LOCAL_BEHIND=$(git rev-list --count HEAD..${REMOTE}/${BRANCH})
if [ "${LOCAL_BEHIND}" -gt 0 ]; then
  echo "You are behind remote by ${LOCAL_BEHIND} commits."
  echo "Pulling latest changes..."
  git pull --ff-only "${REMOTE}" "${BRANCH}"
else
  echo "No behind commits; local is up to date with remote."
fi

echo "Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
  echo "You have uncommitted changes:"
  git status --porcelain
  echo "Please commit or stash them before starting work."
  exit 1
else
  echo "Working tree is clean."
fi

echo "=== DAILY GIT SYNC COMPLETE ==="
