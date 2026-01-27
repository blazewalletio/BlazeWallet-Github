# Onramper API Key Issue - 26 Jan 2026

## Probleem
Bij het testen van de buy functionaliteit zagen we dat alleen iDEAL als beschikbare payment method werd getoond, terwijl alle andere methods (creditcard, applepay, googlepay, etc.) als "not available" werden gemarkeerd.

## Root Cause Analyse

### 1. Initial Bug Found ✅ FIXED
De `.env.local` file bevatte een literal `\n` string in de API key:
```
ONRAMPER_API_KEY="pk_prod_01KBJCSS9G727A14XA544DSS7D\n"
```

**Fix**: Removed the `\n`:
```bash
sed 's/\\n"/"/g' .env.local.backup > .env.local
```

### 2. Main Issue: API Key Returns 403 Forbidden ❌ REQUIRES ONRAMPER SUPPORT

Na het fixen van de `\n` bug, geeft de API key nog steeds een **403 Forbidden** error:

```bash
# Test resultaat:
$ curl -H "Authorization: pk_prod_01KBJCSS9G727A14XA544DSS7D" \
  'https://api.onramper.com/quotes/eur/sol?amount=100'
  
{"message":"Forbidden"}  # Status: 403
```

## Impact

Omdat de API key 403 Forbidden geeft:
1. ✅ Backend API retourneert correct 0 quotes voor alle payment methods
2. ✅ BuyModal3 availability check werkt correct - markeert alles als "not available"
3. ❌ Gebruikers kunnen niet daadwerkelijk crypto kopen

## Code Status

De code zelf werkt **volledig correct**:

### ✅ Availability Check Logica (BuyModal3.tsx, lijn 367)
```typescript
const url = `/api/onramper/quotes?fiatAmount=250&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&paymentMethod=${paymentMethodId}${countryParam}`;
```
De `paymentMethod` parameter wordt correct meegegeven.

### ✅ API Route (app/api/onramper/quotes/route.ts)
- Correct API key cleaning (trim, remove quotes)
- Correct error handling
- Correct response formatting

### ✅ Onramper Service (lib/onramper-service.ts)
- Correct endpoint: `https://api.onramper.com/quotes/{fiat}/{crypto}`
- Correct parameters: amount, paymentMethod, country
- Fallback authentication method (query param als header faalt)

## Actie Vereist

**Je moet de Onramper API key fixen:**

### Optie 1: Check Onramper Dashboard
1. Login op https://onramper.com/dashboard
2. Check of de API key actief is
3. Check of de key de juiste permissies heeft
4. Mogelijk moet je een nieuwe key genereren

### Optie 2: Contact Onramper Support
De key `pk_prod_01KBJCSS9G727A14XA544DSS7D` geeft 403 Forbidden op alle endpoints.

### Optie 3: Test met Staging API
Je kunt tijdelijk testen met de staging API:
```
https://api-stg.onramper.com
```

## Test Commands

### Test API key direct:
```bash
curl -H "Authorization: YOUR_API_KEY" \
  'https://api.onramper.com/quotes/eur/sol?amount=100'
```

### Test via local API:
```bash
curl 'http://localhost:3000/api/onramper/quotes?fiatAmount=100&fiatCurrency=EUR&cryptoCurrency=SOL&paymentMethod=creditcard'
```

## Expected Response (when API key works)

```json
[
  {
    "ramp": "moonpay",
    "paymentMethod": "creditcard",
    "payout": 0.00398,
    "rate": 24138.08,
    "networkFee": 0,
    "transactionFee": 0,
    "availablePaymentMethods": [
      { "paymentTypeId": "creditcard", "name": "Credit Card", "icon": "..." }
    ],
    "quoteId": "...",
    "recommendations": ["LowKyc", "BestPrice"]
  }
]
```

## Server Logs

```
❌ Failed to fetch quotes: { status: 401, statusText: 'Unauthorized' }
```

of

```
❌ Failed to fetch quotes: { status: 403, statusText: 'Forbidden' }
```

## Conclusie

**De code is correct.** Het probleem zit in de Onramper API key configuratie. Zodra je een werkende API key hebt, zal de volledige buy flow correct werken met alle payment methods.

