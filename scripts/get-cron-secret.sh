#!/bin/bash

# 🔥 BLAZE WALLET - Get CRON_SECRET from Vercel
# This script helps you get the CRON_SECRET for EasyCron configuration

echo "🔍 Fetching CRON_SECRET from Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it with: npm i -g vercel"
    exit 1
fi

# Check if project is linked
if [ ! -f ".vercel/project.json" ]; then
    echo "⚠️  Project not linked to Vercel. Linking now..."
    vercel link
fi

# Try to get CRON_SECRET from production environment
echo "📥 Pulling environment variables from Vercel..."
vercel env pull .env.vercel.temp --environment=production --yes 2>/dev/null

if [ -f ".env.vercel.temp" ]; then
    CRON_SECRET=$(grep "^CRON_SECRET=" .env.vercel.temp | cut -d '=' -f2- | tr -d '"' | tr -d "'" | sed 's/\\n$//' | xargs)
    
    if [ -z "$CRON_SECRET" ]; then
        echo "❌ CRON_SECRET not found in Vercel environment variables"
        echo ""
        echo "💡 Generate a new one with:"
        echo "   openssl rand -hex 32"
        echo ""
        echo "Then add it to Vercel:"
        echo "   vercel env add CRON_SECRET production"
        rm -f .env.vercel.temp
        exit 1
    else
        echo "✅ CRON_SECRET found!"
        echo ""
        echo "📋 Use this in your EasyCron URL:"
        echo ""
        echo "https://my.blazewallet.io/api/cron/execute-scheduled-txs?CRON_SECRET=$CRON_SECRET"
        echo ""
        echo "⚠️  Keep this secret secure! Don't share it publicly."
        rm -f .env.vercel.temp
        exit 0
    fi
else
    echo "❌ Failed to pull environment variables"
    echo ""
    echo "💡 Manual steps:"
    echo "1. Go to: https://vercel.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to: Settings → Environment Variables"
    echo "4. Find CRON_SECRET and copy the value"
    exit 1
fi

