#!/bin/bash

# Exit code 0: Proceed with deployment
# Exit code 1: Skip deployment

echo "🔍 Checking if wallet files changed..."

# Check if any files OUTSIDE apps/admin changed
if git diff HEAD^ HEAD --quiet -- . ':(exclude)apps/admin'; then
  echo "❌ No wallet changes detected, skipping build"
  exit 1
else
  echo "✅ Wallet changes detected, proceeding with build"
  exit 0
fi
