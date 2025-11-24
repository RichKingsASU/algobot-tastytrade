#!/usr/bin/env bash
set -euo pipefail

# CONFIGURATION
PROJECT_DIR="/home/richkingsasu/algobot-tastytrade"
GIT_BRANCH="$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD)"
GITHUB_REMOTE="origin"
EXPECTED_GCLOUD_PROJECT="algobot-tastytrade"     # Project ID
EXPECTED_GCLOUD_PROJECT_NUMBER="429420333404"    # Project Number (for logging)
export GCLOUD_PROJECT_ID="${GCLOUD_PROJECT_ID:-$EXPECTED_GCLOUD_PROJECT}"

echo "=== DAILY SYNC CHECK START ==="
echo "Project dir: $PROJECT_DIR"

# Step 1 – Local folder & git status
cd "$PROJECT_DIR"
echo "--- Local folder check ---"
pwd
ls -1

echo "--- Git status ---"
if git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Inside a git repo — OK"
else
  echo "ERROR: Not a git repo! Exiting."
  exit 1
fi

echo "On branch: $GIT_BRANCH"
echo "Remote origin URL:"
git remote -v

echo "Fetching from remote..."
git fetch "$GITHUB_REMOTE"

echo "Commits local ahead of remote:"
git log --oneline "$GITHUB_REMOTE/$GIT_BRANCH..HEAD" || echo "(none)"

echo "Unstaged/uncommitted changes:"
if [ -n "$(git status --porcelain)" ]; then
  echo "WARNING: Unstaged/uncommitted changes found:"
  git status --porcelain
  echo "Please commit or stash them. Exiting."
  exit 1
else
  echo "Clean working tree."
fi

echo "--- Pull latest from remote ---"
git pull --ff-only "$GITHUB_REMOTE" "$GIT_BRANCH"

# Step 2 – Google Cloud SDK check
echo "--- Google Cloud SDK check ---"
if gcloud auth list &>/dev/null; then
  echo "gcloud auth list OK"
else
  echo "ERROR: gcloud not authenticated. Exiting."
  exit 1
fi

CURRENT_GCLOUD=$(gcloud config get-value project)
echo "Current gcloud project: $CURRENT_GCLOUD"

if [ "$CURRENT_GCLOUD" != "$EXPECTED_GCLOUD_PROJECT" ]; then
  echo "WARNING: Current project ($CURRENT_GCLOUD) != expected ($EXPECTED_GCLOUD_PROJECT)"
  echo "Switching to expected project..."
  gcloud config set project "$EXPECTED_GCLOUD_PROJECT"
  CURRENT_GCLOUD=$(gcloud config get-value project)
  echo "Now current project: $CURRENT_GCLOUD"
fi

echo "Using Google Cloud Project ID: $CURRENT_GCLOUD (Number: $EXPECTED_GCLOUD_PROJECT_NUMBER)"

# Step 3 – Final confirmation
echo "All checks passed — you’re synced and ready to work."
echo "=== DAILY SYNC CHECK COMPLETE ==="
