#!/bin/bash
# VERCEL PRODUCTION DEPLOYMENT SCRIPT
# Run this script to deploy directly to Production

echo "🚀 DEPLOYING TO PRODUCTION..."
echo ""
echo "This will:"
echo "1. Build the project"
echo "2. Deploy to Vercel Production (bypassing Preview)"
echo "3. Make your changes live immediately"
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
if ! git diff-index --quiet HEAD --; then
    echo "❌ ERROR: Uncommitted changes detected!"
    echo "   Commit your changes first: git add -A && git commit -m '...'"
    exit 1
fi

# Deploy to production
echo "✅ On main branch"
echo "✅ No uncommitted changes"
echo ""
echo "Deploying to Production..."
vercel --prod --yes

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "🌐 Check: https://vercel.com/blaze-wallets-projects/blaze-wallet"

