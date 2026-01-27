#!/bin/bash

# Quick test script to check if Onramper API key is working
# Run: ./test-api-key.sh

echo "🔍 Testing Onramper API key status..."
echo ""

# Get API key from .env.local
API_KEY=$(grep ONRAMPER_API_KEY .env.local | cut -d'"' -f2)

if [ -z "$API_KEY" ]; then
    echo "❌ No API key found in .env.local"
    exit 1
fi

echo "Key: ${API_KEY:0:15}...${API_KEY: -4}"
echo ""

# Test the API
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: $API_KEY" -H "Accept: application/json" \
    'https://api.onramper.com/quotes/eur/sol?amount=100')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ SUCCESS! API key werkt weer!"
    echo ""
    echo "Response preview:"
    echo "$BODY" | jq -r '.[] | "  - \(.ramp): payout=\(.payout // "N/A") SOL, paymentMethod=\(.paymentMethod // "none")"' 2>/dev/null || echo "$BODY"
    echo ""
    echo "🎉 Je kunt nu de dev server herstarten en de buy functionaliteit testen!"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "❌ API key werkt NOG NIET (403 Forbidden)"
    echo "⏳ Wacht tot Onramper je abonnement heractiveerd heeft"
    echo ""
    echo "Tip: Run dit script regelmatig om te checken:"
    echo "  ./test-api-key.sh"
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ API key is niet geautoriseerd (401 Unauthorized)"
    echo "Mogelijk is de key verkeerd of moet hij opnieuw gegenereerd worden"
else
    echo "⚠️  Unexpected status code: $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""

