# 🔑 Onramper Secret Key Nodig!

## ✅ Oplossing Gevonden!

Volgens de [Onramper documentatie](https://docs.onramper.com/docs/signatures/widget-sign-a-url):

> **"We will provide a separate secret key specifically for signing the `signContent`. Please contact our customer support for assistance in obtaining this key."**

## Het Probleem

We gebruiken momenteel de **API key** als secret voor signing, maar Onramper vereist een **apart secret key**!

## Oplossing

### STAP 1: Verkrijg Secret Key

**Optie A: Via Dashboard**
1. Ga naar: https://dashboard.onramper.com/
2. Ga naar **Settings** → **API Keys** (of **Security**)
3. Check of er een **"Secret Key"** of **"Signing Key"** staat
4. Als niet zichtbaar → Contact support

**Optie B: Via Support** (MEEST WAARSCHIJNLIJK)
- **Email:** support@onramper.com
- **Onderwerp:** Request Secret Key for URL Signing
- **Bericht:**
  ```
  Hi Onramper Support,
  
  We need the secret key for URL signing as per documentation:
  https://docs.onramper.com/docs/signatures/widget-sign-a-url
  
  Our Production API Key: pk_prod_01KBJCSS9G727A14XA544DSS7D
  
  Could you please provide the secret key for signing widget URLs?
  
  Thank you!
  ```

### STAP 2: Voeg Secret Key Toe aan Vercel

```bash
vercel env add ONRAMPER_SECRET_KEY production
# Paste de secret key wanneer gevraagd

vercel env add ONRAMPER_SECRET_KEY preview
# Paste de secret key wanneer gevraagd

vercel env add ONRAMPER_SECRET_KEY development
# Paste de secret key wanneer gevraagd
```

### STAP 3: Test

Na het toevoegen van de secret key:
1. Redeploy de app (automatisch via Git push)
2. Test de Buy functionaliteit
3. Widget zou nu moeten werken! ✅

## Wat Ik Heb Geïmplementeerd

Volgens de exacte Onramper documentatie:

1. ✅ **Separate Secret Key**: Code gebruikt nu `ONRAMPER_SECRET_KEY` (niet API key)
2. ✅ **Alleen Sensitive Parameters**: Sign alleen `wallets`, `onlyCryptos`, `onlyFiats`, `amount`, `onlyPaymentMethods`
3. ✅ **Alfabetisch Sorteren**: Parameters worden gesorteerd voor signing
4. ✅ **Lowercase Crypto IDs**: Alle crypto IDs zijn lowercase (zoals vereist)
5. ✅ **HMAC-SHA256**: Correct algoritme gebruikt
6. ✅ **Unencoded Values**: Signing gebeurt met unencoded waarden

## Code Changes

- `lib/onramper-service.ts`: Updated met correcte signing implementatie
- Vereist nu `ONRAMPER_SECRET_KEY` environment variable
- Error logging als secret key ontbreekt

## Status

⏳ **WACHT OP SECRET KEY**
- Code is klaar ✅
- Implementatie is correct volgens docs ✅
- Secret key nodig van Onramper ⏳

