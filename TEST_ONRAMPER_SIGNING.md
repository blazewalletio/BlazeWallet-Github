# 🧪 Onramper URL Signing Test Plan

## Probleem
Onramper widget URLs geven "Signature validation failed" error. Sinds april 2025 is URL signing verplicht.

## Test Files Created

1. **`test-onramper-url-signing.js`** - Node.js script dat verschillende signing methoden test
2. **`test-onramper-direct.js`** - Generates test URLs voor alle methoden
3. **`test-onramper-urls.html`** - Interactive HTML test tool om URLs in browser te testen

## Test Methoden

### Method 1: Sign all params (current implementation)
- Signs: `apiKey=...&onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=...`
- Signature: HMAC SHA256 van volledige query string
- **Status**: ❓ Not tested

### Method 2: Sign without apiKey
- Signs: `onlyCryptos=ETH&onlyFiats=EUR&amount=100&wallets=...` (zonder apiKey)
- Adds apiKey en signature daarna
- **Status**: ❓ Not tested

### Method 3: Sign sorted params
- Signs: Sorted parameters `amount=100&apiKey=...&onlyCryptos=ETH&...`
- **Status**: ❓ Not tested

### Method 5: Sign URL path + query
- Signs: `/?apiKey=...&onlyCryptos=ETH&...` (met leading slash en ?)
- **Status**: ❓ Not tested

### Method 6: Sign sorted without apiKey, apiKey last
- Signs: Sorted params zonder apiKey
- Adds apiKey en signature aan het einde
- **Status**: ❓ Not tested

## Test Instructions

### Option 1: Use HTML Test Tool
1. Open `test-onramper-urls.html` in browser
2. Click "Test in Popup" voor elke methode
3. Check of widget laadt zonder "Signature validation failed"
4. Mark working method als "✅ Works"

### Option 2: Manual Testing
1. Run: `node test-onramper-direct.js`
2. Copy "Full URL" voor elke methode
3. Paste in browser
4. Check welke werkt

## Mogelijke Oplossingen

Als geen van de methoden werkt, kunnen we:

1. **Check voor separate secret key**
   - Misschien is er een `ONRAMPER_SECRET_KEY` nodig (niet de API key)
   - Check Onramper dashboard voor secret key

2. **Contact Onramper Support**
   - Email: support@onramper.com
   - Vraag om exacte URL signing implementatie
   - Vraag of er een secret key nodig is

3. **Check Onramper Documentation**
   - https://docs.onramper.com/docs/signing-widget-url
   - https://knowledge.onramper.com/url-signing

## Next Steps

1. ✅ Test alle methoden met HTML tool
2. ✅ Identificeer welke methode werkt
3. ✅ Update `lib/onramper-service.ts` met working method
4. ✅ Test lokaal met echte wallet address
5. ✅ Commit en push alleen als 100% zeker werkt

## Notes

- URL signing is verplicht sinds april 2025
- Signature moet HMAC SHA256 zijn
- Mogelijk is secret key anders dan API key
- Parameters moeten mogelijk in specifieke volgorde zijn

