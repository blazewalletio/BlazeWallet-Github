# 🚨 Onramper URL Signing - Alle Methoden Gefaald

## Status
❌ **Alle 6 signing methoden falen met "Signature validation failed"**

## Mogelijke Oorzaken

### 1. **Aparte Secret Key Nodig** (MEEST WAARSCHIJNLIJK)
- Onramper gebruikt mogelijk een **secret key** die anders is dan de API key
- Deze secret key staat waarschijnlijk in het Onramper Dashboard
- **Actie:** Check Onramper Dashboard → Settings → API Keys → Secret Key

### 2. **Verschillende Signing Methode**
- Misschien is de signing methode compleet anders
- Misschien moet er een timestamp bij?
- **Actie:** Contact Onramper support voor exacte implementatie

### 3. **API Key Permissions**
- Misschien heeft de API key niet de juiste permissions voor URL signing
- **Actie:** Check API key permissions in dashboard

## Directe Acties

### ✅ STAP 1: Check Onramper Dashboard
1. Ga naar: https://dashboard.onramper.com/
2. Log in met je account
3. Ga naar **Settings** → **API Keys**
4. Check of er een **"Secret Key"** of **"Signing Key"** staat
5. Als ja → Kopieer deze en voeg toe als `ONRAMPER_SECRET_KEY`

### ✅ STAP 2: Contact Onramper Support
**Email:** support@onramper.com

**Onderwerp:** URL Signing Implementation Help - All Methods Failing

**Bericht:**
```
Hi Onramper Support,

We're trying to implement URL signing for widget URLs but all methods are failing with "Signature validation failed".

Our API Key: pk_prod_01KBJCSS9G727A14XA544DSS7D

We've tried:
1. HMAC SHA256 signing with API key as secret
2. Signing all parameters
3. Signing without apiKey parameter
4. Signing with sorted parameters
5. Signing URL path + query
6. Various parameter orderings

All methods fail. Could you please provide:
1. Exact signing method/algorithm
2. Which parameters should be signed?
3. Do we need a separate secret key (not the API key)?
4. Working example code (Node.js/JavaScript preferred)

Thank you!
```

### ✅ STAP 3: Tijdelijke Workaround
Als URL signing echt niet werkt, kunnen we:
- Gebruik maken van Onramper's `/checkout/intent` API (die we eerder probeerden)
- Of contact opnemen met Onramper om URL signing uit te zetten voor development

## Test URLs Die Gefaald Zijn

Alle deze URLs geven "Signature validation failed":

1. Method 1: `https://buy.onramper.com?apiKey=...&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=...&signature=039f7a196960f2b74b27ad4c19966fbc0bef4f9293e227e5d80b0f65eb4ba3cc`
2. Method 2: `https://buy.onramper.com?onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=...&apiKey=...&signature=01851c1daf46358a1c0e0469cb1af070c24bcdb45ad939a7ad6d16cd997cda9c`
3. Method 3: `https://buy.onramper.com?amount=100&apiKey=...&onlyCryptos=ETH&onlyFiats=EUR&wallets=...&signature=824aeb881da833db941bb50e2a82f597ad88d5edcf132bf8ad16e82ebb2de267`
4. Method 5: `https://buy.onramper.com?apiKey=...&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=...&signature=e839c37bb9fc238630e428545b0c2e4bfa30393e672c73922ccfce81ecfa6817`
5. Method 6: `https://buy.onramper.com?amount=100&onlyCryptos=ETH&onlyFiats=EUR&wallets=...&apiKey=...&signature=8b701ed1d306809f9273218b4df2f4bd0cfed044e6b50856720c3b016c18ef8f`

## Next Steps

1. ✅ Check Onramper Dashboard voor Secret Key
2. ✅ Contact Onramper Support
3. ⏳ Wacht op antwoord van Onramper
4. ⏳ Update implementatie met correcte methode
5. ⏳ Test opnieuw

## Documentatie Links
- https://knowledge.onramper.com/url-signing
- https://docs.onramper.com/docs/signing-widget-url (als deze bestaat)
- https://dashboard.onramper.com/

