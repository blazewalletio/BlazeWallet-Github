# USDT Filtering Probleem - 5 Perfecte Voorstellen

## Probleem Analyse

**Situatie:** Op Ethereum chain worden ETH en USDT getoond in de dropdown, maar USDT geeft geen quotes terwijl ETH wel werkt.

**Root Cause:**
1. Onramper `/supported/assets` endpoint geeft crypto's terug die **algemeen** beschikbaar zijn, niet per specifieke chain
2. De huidige filtering logica matcht alleen:
   - Crypto's met network suffix (bijv. `usdt_ethereum`)
   - Native token zonder suffix (bijv. `eth` voor Ethereum)
3. Als Onramper `usdt` teruggeeft (zonder suffix), wordt deze NIET toegevoegd omdat het niet de native token is
4. Maar als Onramper `usdt_ethereum` teruggeeft, wordt deze WEL toegevoegd, ook al zijn er geen quotes

**Het echte probleem:** `/supported/assets` zegt dat USDT beschikbaar is, maar in werkelijkheid zijn er geen providers die USDT op Ethereum aanbieden voor quotes.

---

## Voorstel 1: Quote Validation - Valideer elke crypto met een snelle quote check ⭐ RECOMMENDED

### Concept
Valideer elke crypto die we van `/supported/assets` krijgen door een snelle quote check te doen. Alleen crypto's met daadwerkelijke quotes worden getoond.

### Implementatie

```typescript
static async getAvailableCryptosForChain(
  chainId: number,
  fiatCurrency: string = 'EUR',
  country?: string,
  apiKey?: string
): Promise<string[]> {
  try {
    if (!apiKey) {
      return this.getSupportedAssets(chainId);
    }

    const networkCode = this.getNetworkCode(chainId);
    const cleanApiKey = this.cleanApiKey(apiKey);
    
    // Step 1: Get potential crypto's from /supported/assets
    const url = `https://api.onramper.com/supported/assets?source=${fiatCurrency}&type=buy${country ? `&country=${country}` : ''}`;
    
    let response = await fetch(url, {
      headers: { 'Authorization': cleanApiKey, 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return this.getSupportedAssets(chainId);
    }

    const data = await response.json();
    const assets = data?.message?.assets || [];
    
    // Step 2: Extract potential crypto's for this network
    const potentialCryptos: string[] = [];
    const nativeToken = this.getDefaultCrypto(chainId);
    
    for (const asset of assets) {
      const cryptos = asset.crypto || [];
      for (const crypto of cryptos) {
        const parts = crypto.split('_');
        const cryptoSymbol = parts[0].toUpperCase();
        const cryptoNetwork = parts.length > 1 ? parts[1] : null;
        
        if (cryptoNetwork === networkCode) {
          if (!potentialCryptos.includes(cryptoSymbol)) {
            potentialCryptos.push(cryptoSymbol);
          }
        } else if (!cryptoNetwork && cryptoSymbol === nativeToken) {
          if (!potentialCryptos.includes(cryptoSymbol)) {
            potentialCryptos.push(cryptoSymbol);
          }
        }
      }
    }

    // Always include native token
    if (!potentialCryptos.includes(nativeToken)) {
      potentialCryptos.unshift(nativeToken);
    }

    // Step 3: Validate each crypto with a quick quote check
    const availableCryptos: string[] = [];
    
    // Validate in parallel (with rate limiting)
    const validationPromises = potentialCryptos.map(async (crypto) => {
      try {
        const quoteUrl = `https://api.onramper.com/quotes?apiKey=${cleanApiKey}&fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`;
        const quoteResponse = await fetch(quoteUrl, {
          headers: { 'Authorization': cleanApiKey },
        });

        if (!quoteResponse.ok) return null;

        const quoteData = await quoteResponse.json();
        const quotes = quoteData.quotes || [];
        
        // Check if we have at least one valid quote
        const hasValidQuote = quotes.some((q: any) => 
          q.payout && parseFloat(q.payout.toString()) > 0 && 
          q.rate && parseFloat(q.rate.toString()) > 0
        );

        return hasValidQuote ? crypto : null;
      } catch (error) {
        return null;
      }
    });

    const validated = await Promise.all(validationPromises);
    const validCryptos = validated.filter(Boolean) as string[];

    // Always include native token (most likely to work)
    if (!validCryptos.includes(nativeToken)) {
      validCryptos.unshift(nativeToken);
    }

    return validCryptos.length > 0 ? validCryptos : [nativeToken];
  } catch (error) {
    return this.getSupportedAssets(chainId);
  }
}
```

### Voordelen
- ✅ 100% accuraat - test daadwerkelijk quotes
- ✅ Werkt altijd, zelfs als Onramper data inconsistent is
- ✅ Toont alleen crypto's die echt werken

### Nadelen
- ⚠️ Trager (meerdere API calls)
- ⚠️ Rate limiting risico (maar met kleine delays te voorkomen)
- ⚠️ Meer API calls = hogere kosten

### Optimalisatie
- Valideer alleen top 5-10 crypto's (niet alle)
- Cache resultaten 1 uur
- Valideer native token eerst (meest waarschijnlijk)

---

## Voorstel 2: Hybrid Approach - Valideer alleen non-native tokens

### Concept
Native token (ETH) wordt altijd getoond (meest waarschijnlijk te werken). Alleen non-native tokens (USDT, USDC, etc.) worden gevalideerd met quote checks.

### Implementatie

```typescript
// Similar to Voorstel 1, but:
// - Always include native token without validation
// - Only validate non-native tokens (USDT, USDC, etc.)
// - Much faster (fewer API calls)
```

### Voordelen
- ✅ Sneller dan Voorstel 1 (minder validaties)
- ✅ Native token altijd beschikbaar
- ✅ Valideert alleen waar nodig

### Nadelen
- ⚠️ Nog steeds enkele API calls nodig
- ⚠️ Native token wordt niet gevalideerd (maar meestal OK)

---

## Voorstel 3: Client-side Quote Check - Valideer in frontend bij selectie

### Concept
Toon alle crypto's van `/supported/assets`, maar valideer pas wanneer gebruiker een crypto selecteert. Als er geen quotes zijn, toon error en verberg die crypto.

### Implementatie

```typescript
// In BuyModal3.tsx:
const [invalidCryptos, setInvalidCryptos] = useState<Set<string>>(new Set());

const validateCryptoOnSelect = async (crypto: string) => {
  // Quick quote check
  const response = await fetch(
    `/api/onramper/quotes?fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`
  );
  
  const data = await response.json();
  const hasQuotes = data.quotes?.some((q: any) => q.payout > 0);
  
  if (!hasQuotes) {
    setInvalidCryptos(prev => new Set([...prev, crypto]));
    // Show error or remove from dropdown
  }
};
```

### Voordelen
- ✅ Snel (geen pre-validation)
- ✅ Valideert alleen wat gebruiker selecteert
- ✅ Goede UX (direct feedback)

### Nadelen
- ❌ Slechte UX (gebruiker ziet crypto, selecteert, dan error)
- ❌ Crypto blijft zichtbaar tot selectie

---

## Voorstel 4: Cache + Background Validation

### Concept
Gebruik `/supported/assets` voor snelle response, maar valideer quotes in de background. Cache validatie resultaten. Update dropdown wanneer validatie klaar is.

### Implementatie

```typescript
// Step 1: Show crypto's from /supported/assets immediately (fast)
// Step 2: Validate quotes in background
// Step 3: Update dropdown when validation completes
// Step 4: Cache results for 1 hour
```

### Voordelen
- ✅ Snel (direct resultaat)
- ✅ Accuraat (background validatie)
- ✅ Goede UX (progressive enhancement)

### Nadelen
- ⚠️ Complexer (twee-staps proces)
- ⚠️ Crypto's kunnen tijdelijk verschijnen en verdwijnen

---

## Voorstel 5: Smart Filtering - Verbeterde parsing van Onramper response

### Concept
Verbeter de parsing logica om beter te begrijpen welke crypto's echt voor deze chain zijn. Gebruik ook `paymentMethods` en andere hints uit de response.

### Implementatie

```typescript
// Verbeterde filtering:
// 1. Check of crypto network-specifiek is (usdt_ethereum)
// 2. Check of crypto algemeen is maar native token matcht (eth voor ethereum)
// 3. Gebruik paymentMethods als hint (als crypto payment methods heeft, is het waarschijnlijk beschikbaar)
// 4. Fallback: valideer alleen als we twijfelen
```

### Voordelen
- ✅ Snel (geen extra API calls)
- ✅ Eenvoudig (alleen betere parsing)

### Nadelen
- ❌ Minder accuraat (nog steeds afhankelijk van Onramper data)
- ❌ Kan nog steeds fouten maken

---

## Aanbeveling: **Voorstel 1 (Quote Validation)** met Optimalisatie ⭐

**Waarom:**
1. **100% accuraat** - test daadwerkelijk quotes
2. **Perfecte UX** - alleen werkende crypto's
3. **Toekomstbestendig** - werkt altijd, zelfs als Onramper data verandert

**Optimalisaties:**
- Valideer native token eerst (meest waarschijnlijk)
- Valideer max 5-10 crypto's (niet alle)
- Cache resultaten 1 uur (localStorage)
- Parallel validatie met kleine delays (rate limiting)
- Fallback: als validatie faalt, toon alleen native token

**Implementatie strategie:**
1. Valideer native token altijd eerst (snel, meest waarschijnlijk)
2. Valideer top 5 non-native tokens in parallel
3. Cache resultaten per chain+fiat+country combo
4. Gebruik cache voor snelle response bij volgende keer

---

## Alternatief: **Voorstel 2 (Hybrid)** als compromis

Als Voorstel 1 te traag is, gebruik Voorstel 2:
- Native token altijd beschikbaar (geen validatie)
- Non-native tokens valideren (minder API calls)
- Sneller, nog steeds accuraat

