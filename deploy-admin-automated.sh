#!/bin/bash
set -e

echo "🚀 BLAZE Admin - Automated Vercel Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to project root
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12"

echo "📦 Step 1: Installing root dependencies..."
npm install

echo ""
echo "📦 Step 2: Installing admin dependencies..."
cd apps/admin
npm install

echo ""
echo "🔨 Step 3: Building admin..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "🚀 Step 4: Deploying to Vercel..."
echo ""

# Deploy from admin directory but with monorepo awareness
vercel --prod --yes

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment initiated!"
echo ""
echo "Check status: https://vercel.com/blaze-wallets-projects/admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

