#!/bin/bash

# 🔍 CHECK OPENAI USAGE SCRIPT
# This script checks your OpenAI API usage to diagnose 429 rate limit errors

echo "🔍 Checking OpenAI API Usage..."
echo "================================"
echo ""

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "❌ OPENAI_API_KEY not found in environment"
  echo ""
  echo "Please set it first:"
  echo "  export OPENAI_API_KEY='sk-proj-xxx'"
  echo ""
  exit 1
fi

echo "✅ API Key found: ${OPENAI_API_KEY:0:20}..."
echo ""

# Get today's date
TODAY=$(date +%Y-%m-%d)
echo "📅 Checking usage for: $TODAY"
echo ""

# Check rate limits (this will show if you're currently rate limited)
echo "🔑 Testing API connectivity..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY")

if [ "$RESPONSE" = "200" ]; then
  echo "✅ API Key is valid and working"
elif [ "$RESPONSE" = "401" ]; then
  echo "❌ API Key is INVALID (401 Unauthorized)"
  echo "   Please check your key at: https://platform.openai.com/api-keys"
  exit 1
elif [ "$RESPONSE" = "429" ]; then
  echo "❌ RATE LIMIT ACTIVE (429 Too Many Requests)"
  echo "   Your account is currently rate limited!"
  echo ""
  echo "   This could be because:"
  echo "   - You've exceeded daily limit (50 Whisper requests/day on Free tier)"
  echo "   - You've exceeded per-minute limit (3 Whisper requests/min on Free tier)"
  echo "   - Your account needs to be upgraded"
  echo ""
  echo "   Solutions:"
  echo "   1. Wait 24 hours for daily limit reset"
  echo "   2. Upgrade to Tier 1 ($5 minimum spend)"
  echo "   3. Use a different API key"
else
  echo "⚠️  Unexpected response code: $RESPONSE"
fi

echo ""
echo "================================"
echo "📊 NEXT STEPS:"
echo "================================"
echo ""
echo "1. Check your usage dashboard:"
echo "   https://platform.openai.com/usage"
echo ""
echo "2. Check your account limits:"
echo "   https://platform.openai.com/account/limits"
echo ""
echo "3. If on Free tier, limits are:"
echo "   - Whisper: 3 requests/min, 50 requests/day"
echo "   - GPT-4o-mini: 500 requests/day"
echo ""
echo "4. To upgrade to Tier 1 ($5):"
echo "   https://platform.openai.com/account/billing/overview"
echo ""

# Check if WHISPER_API_KEY is different
if [ -n "$WHISPER_API_KEY" ]; then
  echo "================================"
  echo "🔍 SEPARATE WHISPER KEY DETECTED"
  echo "================================"
  echo ""
  echo "✅ WHISPER_API_KEY found: ${WHISPER_API_KEY:0:20}..."
  
  if [ "$WHISPER_API_KEY" = "$OPENAI_API_KEY" ]; then
    echo "⚠️  WARNING: Both keys are THE SAME!"
    echo "   This means rate limits are still shared!"
  else
    echo "✅ Keys are DIFFERENT (rate limits separated)"
  fi
  
  echo ""
  echo "Testing WHISPER_API_KEY connectivity..."
  WHISPER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    https://api.openai.com/v1/models \
    -H "Authorization: Bearer $WHISPER_API_KEY")
  
  if [ "$WHISPER_RESPONSE" = "200" ]; then
    echo "✅ WHISPER_API_KEY is valid"
  elif [ "$WHISPER_RESPONSE" = "401" ]; then
    echo "❌ WHISPER_API_KEY is INVALID"
  elif [ "$WHISPER_RESPONSE" = "429" ]; then
    echo "❌ WHISPER_API_KEY is RATE LIMITED"
  fi
fi

echo ""
echo "Done! 🎉"

