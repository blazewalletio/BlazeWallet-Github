#!/bin/bash

# 🔥 BLAZE WALLET - Test EasyCron Integration
# This script tests if EasyCron is working correctly

echo "🧪 Testing EasyCron Integration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get CRON_SECRET
if [ -f ".env.vercel.temp" ]; then
    CRON_SECRET=$(grep "^CRON_SECRET=" .env.vercel.temp | cut -d '=' -f2- | tr -d '"' | tr -d "'" | sed 's/\\n$//' | xargs)
else
    echo -e "${YELLOW}⚠️  CRON_SECRET not found. Run: ./scripts/get-cron-secret.sh${NC}"
    echo ""
    read -p "Enter CRON_SECRET manually (or press Enter to skip): " CRON_SECRET
fi

if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}❌ CRON_SECRET is required${NC}"
    exit 1
fi

echo "1️⃣ Testing Health Check Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "https://my.blazewallet.io/api/cron/health")
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed (HTTP $HEALTH_CODE)${NC}"
    echo "$HEALTH_BODY" | jq '.' 2>/dev/null || echo "$HEALTH_BODY"
else
    echo -e "${RED}❌ Health check failed (HTTP $HEALTH_CODE)${NC}"
    echo "$HEALTH_BODY"
fi

echo ""
echo "2️⃣ Testing Cron Execution Endpoint..."
CRON_RESPONSE=$(curl -s -w "\n%{http_code}" "https://my.blazewallet.io/api/cron/execute-scheduled-txs?CRON_SECRET=$CRON_SECRET")
CRON_BODY=$(echo "$CRON_RESPONSE" | head -n -1)
CRON_CODE=$(echo "$CRON_RESPONSE" | tail -n 1)

if [ "$CRON_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Cron endpoint accessible (HTTP $CRON_CODE)${NC}"
    echo "$CRON_BODY" | jq '.' 2>/dev/null || echo "$CRON_BODY"
    
    # Check if response indicates success
    if echo "$CRON_BODY" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Cron execution successful${NC}"
    fi
else
    echo -e "${RED}❌ Cron endpoint failed (HTTP $CRON_CODE)${NC}"
    echo "$CRON_BODY"
    
    if [ "$CRON_CODE" = "401" ]; then
        echo -e "${YELLOW}⚠️  Authentication failed. Check CRON_SECRET.${NC}"
    fi
fi

echo ""
echo "3️⃣ Checking EasyCron Status..."
echo -e "${YELLOW}💡 Go to https://www.easycron.com/cron-jobs to check:${NC}"
echo "   - Cron job is Enabled"
echo "   - Last execution was successful"
echo "   - Execution history shows recent runs"

echo ""
echo "✅ Test complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify EasyCron cron job is enabled"
echo "   2. Wait 5 minutes for automatic execution"
echo "   3. Check EasyCron execution history"
echo "   4. Check Vercel logs for execution logs"


