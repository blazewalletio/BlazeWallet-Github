#!/bin/bash
# VERCEL PRODUCTION DEPLOYMENT SCRIPT
# This script commits, pushes AND deploys to bypass Vercel's auto-preview

echo "🚀 DEPLOYING TO PRODUCTION..."
echo ""
echo "This will:"
echo "1. Commit all changes"
echo "2. Push to GitHub"
echo "3. Deploy directly to Production (NO preview!)"
echo ""

# Check if on main branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "❌ ERROR: Not on main branch!"
    echo "   Current branch: $BRANCH"
    echo "   Switch to main first: git checkout main"
    exit 1
fi

# Check for uncommitted changes
if git diff-index --quiet HEAD --; then
    echo "❌ ERROR: No changes to deploy!"
    echo "   Make some changes first, then run this script."
    exit 1
fi

# Commit changes
echo "✅ On main branch"
echo "📝 Changes detected"
echo ""
read -p "Enter commit message: " commit_message

if [ -z "$commit_message" ]; then
    echo "❌ ERROR: Commit message cannot be empty!"
    exit 1
fi

echo ""
echo "Committing changes..."
git add -A
git commit -m "$commit_message"

echo ""
echo "Pushing to GitHub..."
git push origin main

echo ""
echo "Deploying to Production (this overrides the Preview)..."
vercel --prod --yes

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "🌐 Check: https://vercel.com/blaze-wallets-projects/blaze-wallet"
echo ""
echo "Note: GitHub triggered a Preview, but our Production deployment"
echo "      will be the active one. The Preview can be ignored."

