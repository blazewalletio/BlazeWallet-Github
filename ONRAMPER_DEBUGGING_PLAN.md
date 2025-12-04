# Onramper Integration Debugging Plan

## Problem
`Cannot read properties of undefined (reading 'toString')` error from Onramper API when calling `/checkout/intent`

## Current Request
```json
{
  "sourceCurrency": "eur",
  "destinationCurrency": "sol",
  "sourceAmount": 100,
  "destinationWalletAddress": "Hz4Yqp126MUTT6Go7Q8x9B4mcPsiMLHpXTXn513yDcMX"
}
```

Headers:
```
Authorization: pk_prod_01KBJCSS9G727A14XA544DSS7D
Content-Type: application/json
Accept: application/json
```

## Possible Issues

### 1. Wrong Endpoint?
- Documentation mentions `/checkout/intent` but maybe that's for widget?
- API integration might use different endpoint like `/transactions`

### 2. Missing Required Fields?
- Maybe needs `quoteId` from previous `/quotes` call?
- Maybe needs `country` parameter?
- Maybe needs `paymentMethod` in body (we pass it but don't include)?

### 3. Wrong Field Format?
- `sourceAmount` as number vs string?
- `destinationCurrency` should be uppercase? (SOL vs sol)
- Wallet address format issue?

### 4. Authentication Issue?
- Direct API key vs different format?
- API key missing required permissions?

## Next Steps

### Option A: Use Widget Approach (Recommended for Speed)
Instead of custom UI, use Onramper's widget URL approach:
1. Get widget URL with parameters
2. Open in iframe or new window
3. Listen for webhook updates

### Option B: Fix API Integration (More Work)
1. Contact Onramper support for exact `/checkout/intent` requirements
2. Test with their sandbox/staging environment first
3. Verify all required fields and formats

### Option C: Alternative API Flow
1. First call `/quotes` to get a quote
2. Use `quoteId` from quote response in `/checkout/intent`
3. This might be the missing link!

## Recommendation
Try Option C first - get quote, then use quote data in transaction creation.
If that fails, switch to Option A (widget) for immediate solution.

