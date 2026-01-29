#!/bin/bash

# Exit code 0: Proceed with deployment
# Exit code 1: Skip deployment

echo "🔍 Checking if admin files changed..."

# Check if any files in apps/admin changed
if git diff HEAD^ HEAD --quiet apps/admin/; then
  echo "❌ No admin changes detected, skipping build"
  exit 1
else
  echo "✅ Admin changes detected, proceeding with build"
  exit 0
fi

