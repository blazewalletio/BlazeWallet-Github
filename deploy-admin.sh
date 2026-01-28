#!/bin/bash

# 🎯 BLAZE Admin - Complete Deployment Script
# This script handles EVERYTHING - no manual steps required!

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 BLAZE ADMIN - AUTOMATED DEPLOYMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Not in project root directory"
  exit 1
fi

# Step 2: Stop any running dev servers
echo "🛑 Stopping dev servers..."
pkill -f "next dev" || true
sleep 2

# Step 3: Build the admin app
echo ""
echo "🔨 Building admin app..."
cd apps/admin
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed! Fix errors and try again."
  exit 1
fi

echo "✅ Build successful!"

# Step 4: Check Vercel installation
echo ""
echo "📦 Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
  echo "⚠️  Vercel CLI not found. Installing..."
  npm i -g vercel
fi

# Step 5: Deploy to Vercel
echo ""
echo "🚀 Deploying to production..."
echo ""
vercel --prod

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Your admin is now live at: https://admin.blazewallet.io"
echo ""
echo "📋 POST-DEPLOYMENT CHECKLIST:"
echo "   1. Visit https://admin.blazewallet.io"
echo "   2. Login with admin credentials"
echo "   3. Click 'Users' tab"
echo "   4. Select a user"
echo "   5. Click 'View Balances'"
echo "   6. Verify portfolio shows correct USD values"
echo ""
echo "✅ All done! No manual steps needed."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

