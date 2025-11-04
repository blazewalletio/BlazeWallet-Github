#!/bin/bash

# Quick script to get latest Vercel deployment and show logs

echo "🔍 Fetching latest Vercel deployment..."

# Get latest deployment URL
LATEST_URL=$(vercel ls 2>/dev/null | grep "https://" | head -1 | awk '{print $2}')

if [ -z "$LATEST_URL" ]; then
  echo "❌ Could not find deployment URL"
  echo ""
  echo "Please manually check logs at:"
  echo "https://vercel.com → Functions → /api/ai-assistant/transcribe"
  exit 1
fi

echo "✅ Latest deployment: $LATEST_URL"
echo ""
echo "📋 Fetching logs for last 5 minutes..."
echo "========================================"
echo ""

# Fetch logs for that deployment
vercel logs "$LATEST_URL" --since 5m 2>&1 | grep -A 20 "Whisper" || echo "No Whisper logs found yet. Try making a voice request now."

echo ""
echo "========================================"
echo ""
echo "If no logs appear, do a voice test NOW and run this script again!"

