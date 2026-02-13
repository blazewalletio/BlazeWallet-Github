#!/bin/bash

# Quick script to get Vercel logs for /api/onramper/quotes with iDeal | Wero

echo "🔍 Fetching Vercel logs for /api/onramper/quotes (iDeal | Wero)..."
echo ""

# Get logs for last 10 minutes, filter for onramper/quotes
vercel logs --since 10m 2>&1 | grep -A 5 -B 5 "onramper/quotes" | grep -A 10 -B 10 "ideal\|BANXA\|banxa\|PRIMARY CHECK\|FALLBACK CHECK\|AFTER FILTERING" || echo "No iDeal | Wero logs found. Try making a request in the app first."

echo ""
echo "========================================"
echo ""
echo "💡 Tip: Open the Buy modal, select ETH, select iDeal | Wero, then run this script again!"

