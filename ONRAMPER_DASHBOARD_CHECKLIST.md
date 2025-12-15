# 🔍 Onramper Dashboard Checklist - Secret Key Zoeken

## Wat We Zien
- ✅ Production API Key: `pk_prod_01KBJCSS9G727A14XA544DSS7D`
- ✅ Test API Key: `pk_test_01KB8TGF1BVYEE2DWE36P9CJ8H`
- ❌ Geen Secret Key zichtbaar op deze pagina

## Waar Te Zoeken

### 1. **Settings → API Keys**
1. Klik op "Settings" in de navigatie
2. Ga naar "API Keys" sectie
3. Klik op je Production API Key
4. Check of er een "Secret Key", "Signing Key", of "Private Key" staat
5. Soms staat deze alleen bij het aanmaken van de key

### 2. **Settings → Security**
1. Ga naar Settings
2. Check "Security" of "Authentication" sectie
3. Kijk voor "URL Signing Key" of "Widget Signing Key"

### 3. **Webhook Settings**
1. Ga naar de "Set Webhook URLs" sectie (oranje bullet)
2. Check of daar een secret key staat voor webhook signing
3. Misschien is dezelfde key voor URL signing?

### 4. **API Documentation in Dashboard**
1. Zoek naar "Documentation" of "Integration Guide" in dashboard
2. Check of daar voorbeelden staan met secret keys

## Als Geen Secret Key Te Vinden Is

### Optie A: Contact Onramper Support
**Email:** support@onramper.com

**Vraag:**
```
Hi,

We're trying to implement URL signing for widget URLs but getting "Signature validation failed" errors.

Our Production API Key: pk_prod_01KBJCSS9G727A14XA544DSS7D

We've tried multiple signing methods (HMAC SHA256 with API key as secret) but all fail.

Questions:
1. Do we need a separate secret key for URL signing? If yes, where do we find it?
2. What is the exact signing method/algorithm?
3. Can you provide working example code (Node.js)?

Thank you!
```

### Optie B: Test Met Test API Key
Misschien werkt URL signing anders voor test vs production:
- Probeer de test API key: `pk_test_01KB8TGF1BVYEE2DWE36P9CJ8H`
- Test of signing werkt met test key

### Optie C: Check Of URL Signing Echt Nodig Is
Misschien is URL signing optioneel of alleen voor bepaalde accounts:
- Check of widget werkt ZONDER signature parameter
- Test: `https://buy.onramper.com?apiKey=pk_prod_01KBJCSS9G727A14XA544DSS7D&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- (Zonder signature parameter)

## Quick Test: Zonder Signature

Test deze URL in browser (ZONDER signature):
```
https://buy.onramper.com?apiKey=pk_prod_01KBJCSS9G727A14XA544DSS7D&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=ETH:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

Als deze WEL werkt → URL signing is misschien niet nodig voor jouw account!
Als deze NIET werkt → We moeten secret key vinden of contact opnemen met support.

