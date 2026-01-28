#!/bin/bash

# Only build if files outside apps/admin changed
# This prevents main project from rebuilding when only admin changes

if git diff HEAD^ HEAD --quiet -- . ':!apps/admin'; then
  echo "🛑 Only admin files changed - skipping main project build"
  exit 0
else
  echo "✅ Main project files changed - proceeding with build"
  exit 1
fi

