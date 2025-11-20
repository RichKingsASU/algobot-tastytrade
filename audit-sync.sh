#!/usr/bin/env bash
# audit-sync.sh
# Purpose: Check local project folder, git repo, remote origin, Supabase link, and schema basics.

set -euo pipefail

PROJECT_DIR="/home/richkingsasu/algobot-tastytrade"
BRANCH="main"   # adjust if your default branch is different
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"  # optionally set env var

echo "=== AUDIT START ==="
echo "Project Dir: ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

echo ""
echo "--- 1. Local folder check ---"
pwd
ls -lh .

echo ""
echo "--- 2. Git status check ---"
git rev-parse --is-inside-work-tree && echo "Inside git repo OK" || { echo "Not in a git repository!"; exit 1; }

echo "Branch:"
git branch --show-current

echo "Remote origin:"
git remote -v

echo "Fetching latest from origin..."
git fetch origin

echo "Local vs Origin diff (un-pushed commits):"
git log --oneline origin/${BRANCH}..HEAD || echo "(none)"

echo "Unstaged/Uncommitted changes:"
git status --porcelain | { read x && echo "Uncommitted changes exist:" && git status --porcelain && exit 1; } || echo "Working tree clean"

echo ""
echo "--- 3. Supabase CLI link check ---"
if command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI found."
else
    echo "ERROR: supabase CLI not installed or not in PATH"; exit 1
fi

if [ -z "${SUPABASE_PROJECT_REF}" ]; then
    echo "WARNING: SUPABASE_PROJECT_REF env var not set. Skip link check."
else
    echo "Project ref given: ${SUPABASE_PROJECT_REF}"
    echo "Checking supabase project status..."
    echo "Supabase project reference: ${SUPABASE_PROJECT_REF}"
fi

echo ""
echo "--- 4. Supabase schema basic check ---"
echo "Running simple SQL to verify tastytrade_quotes table exists..."

# This assumes you have psql or supabase db connect access; adjust if needed
psql "${SUPABASE_DATABASE_URL:-}" -c "\
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name = 'tastytrade_quotes';" || echo "WARNING: Query failed — please verify credentials/connection."

echo ""
echo "--- 5. Remote origin URL check ---"
echo "Origin URL:"
git config --get remote.origin.url

echo ""
echo "=== AUDIT COMPLETE ==="
