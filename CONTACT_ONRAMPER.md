# 📧 Contact Onramper Support - URL Signing Issue

## Probleem
Alle URL signing methoden falen met "Signature validation failed" error.

## Wat We Hebben Geprobeerd
1. ✅ HMAC SHA256 signing met API key als secret
2. ✅ Signing met alle parameters
3. ✅ Signing zonder apiKey parameter
4. ✅ Signing met gesorteerde parameters
5. ✅ Signing met URL path + query
6. ✅ Verschillende parameter volgordes

**Resultaat:** Alle methoden falen ❌

## Onze API Key
```
pk_prod_01KBJCSS9G727A14XA544DSS7D
```

## Vragen voor Onramper Support

1. **Is er een aparte secret key nodig voor URL signing?**
   - Of moeten we de API key gebruiken?
   - Waar vinden we de secret key in het dashboard?

2. **Wat is de exacte signing methode?**
   - Welke parameters moeten worden gesigned?
   - In welke volgorde?
   - Moet apiKey in de signature string zitten?

3. **Voorbeeld code?**
   - Kunnen jullie een werkend voorbeeld geven?
   - Node.js/JavaScript voorbeeld zou perfect zijn

4. **Documentatie link?**
   - Is er specifieke documentatie voor URL signing?
   - https://docs.onramper.com/docs/signing-widget-url bestaat dit?

## Contact Informatie
- **Email:** support@onramper.com
- **Dashboard:** https://dashboard.onramper.com/
- **Documentatie:** https://docs.onramper.com/

## Test URLs Die We Hebben Geprobeerd

### Method 1 (Sign all params):
```
https://buy.onramper.com?apiKey=pk_prod_01KBJCSS9G727A14XA544DSS7D&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=ETH%3A0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&signature=039f7a196960f2b74b27ad4c19966fbc0bef4f9293e227e5d80b0f65eb4ba3cc
```

### Method 2 (Sign without apiKey):
```
https://buy.onramper.com?onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=ETH%3A0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&apiKey=pk_prod_01KBJCSS9G727A14XA544DSS7D&signature=01851c1daf46358a1c0e0469cb1af070c24bcdb45ad939a7ad6d16cd997cda9c
```

Alle geven "Signature validation failed" error.

