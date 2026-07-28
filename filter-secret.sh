#!/bin/bash
# Script to remove exposed Discord token from git history

git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch docs/FIX_CODE_GRANT_ERROR.md && \
   git checkout HEAD -- docs/FIX_CODE_GRANT_ERROR.md 2>/dev/null || true' \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
