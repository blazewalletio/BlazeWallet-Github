# Crypto Availability Per Chain - 3 Perfecte Voorstellen

## Probleem
Momenteel worden crypto's getoond in de dropdown op basis van een hardcoded lijst (`getSupportedAssets()`), maar deze crypto's zijn niet altijd daadwerkelijk beschikbaar voor quotes. Dit leidt tot slechte UX waarbij gebruikers crypto's kunnen selecteren die vervolgens geen quotes hebben.

## Doel
- Alleen crypto's tonen die daadwerkelijk beschikbaar zijn voor quotes per chain
- Werken voor alle 18 chains in Blaze Wallet
- Perfecte UX zonder verwarring
- Performance: snel en efficiënt

---

## Voorstel 1: Dynamisch ophalen via Onramper `/supported/assets` endpoint ⭐ RECOMMENDED

### Concept
Gebruik Onramper's `/supported/assets` endpoint om per chain dynamisch op te halen welke crypto's beschikbaar zijn. Dit is de meest accurate en officiële manier.

### Implementatie

#### 1. Nieuwe functie in `OnramperService`:
```typescript
/**
 * Get available cryptocurrencies for a specific chain via Onramper API
 * Uses /supported/assets endpoint which returns crypto's that have actual providers
 */
static async getAvailableCryptosForChain(
  chainId: number,
  fiatCurrency: string = 'EUR',
  country?: string,
  apiKey?: string
): Promise<string[]> {
  try {
    if (!apiKey) {
      // Fallback to hardcoded list if no API key
      return this.getSupportedAssets(chainId);
    }

    const networkCode = this.getNetworkCode(chainId);
    const cleanApiKey = this.cleanApiKey(apiKey);
    
    // Call Onramper /supported/assets endpoint
    // This returns crypto's that actually have providers available
    const url = `https://api.onramper.com/supported/assets?source=${fiatCurrency}&type=buy${country ? `&country=${country}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': cleanApiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`Onramper /supported/assets failed for chain ${chainId}, using fallback`);
      return this.getSupportedAssets(chainId);
    }

    const data = await response.json();
    
    // Parse response structure:
    // { message: { assets: [{ fiat: "eur", crypto: ["eth", "btc", "eth_arbitrum"], ... }] } }
    const assets = data?.message?.assets || [];
    
    // Filter crypto's for this specific network
    const availableCryptos: string[] = [];
    
    for (const asset of assets) {
      const cryptos = asset.crypto || [];
      for (const crypto of cryptos) {
        // Parse crypto format: "eth", "btc", "eth_arbitrum", "sol_solana"
        const [cryptoSymbol, cryptoNetwork] = crypto.split('_');
        
        // Match network or native token
        if (cryptoNetwork === networkCode || 
            (!cryptoNetwork && cryptoSymbol === this.getDefaultCrypto(chainId).toLowerCase())) {
          // Convert to uppercase for consistency
          const symbol = cryptoSymbol.toUpperCase();
          if (!availableCryptos.includes(symbol)) {
            availableCryptos.push(symbol);
          }
        }
      }
    }

    // Always include native token if not already present
    const nativeToken = this.getDefaultCrypto(chainId);
    if (!availableCryptos.includes(nativeToken)) {
      availableCryptos.unshift(nativeToken);
    }

    logger.log(`✅ Available cryptos for chain ${chainId} (${networkCode}):`, availableCryptos);
    
    return availableCryptos.length > 0 ? availableCryptos : this.getSupportedAssets(chainId);
  } catch (error) {
    logger.error(`Error fetching available cryptos for chain ${chainId}:`, error);
    return this.getSupportedAssets(chainId);
  }
}
```

#### 2. Nieuwe API route: `/api/onramper/available-cryptos`
```typescript
// app/api/onramper/available-cryptos/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainId = parseInt(searchParams.get('chainId') || '1');
  const fiatCurrency = searchParams.get('fiatCurrency') || 'EUR';
  const country = searchParams.get('country') || undefined;

  const apiKey = process.env.ONRAMPER_API_KEY?.trim().replace(/^["']|["']$/g, '') || '';
  
  const availableCryptos = await OnramperService.getAvailableCryptosForChain(
    chainId,
    fiatCurrency,
    country,
    apiKey
  );

  return NextResponse.json({
    success: true,
    chainId,
    availableCryptos,
  });
}
```

#### 3. Update `BuyModal3.tsx`:
```typescript
// In useEffect when modal opens or chain changes:
useEffect(() => {
  if (isOpen && currentChain) {
    const fetchAvailableCryptos = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/onramper/available-cryptos?chainId=${CHAINS[currentChain].id}&fiatCurrency=${fiatCurrency}${userCountry ? `&country=${userCountry}` : ''}`
        );
        const data = await response.json();
        
        if (data.success && data.availableCryptos) {
          // Filter cryptoCurrencies to only show available ones
          const filtered = cryptoCurrencies.filter(crypto =>
            data.availableCryptos.some((available: string) =>
              available.toLowerCase() === crypto.toLowerCase()
            )
          );
          setAvailableCryptosSet(new Set(filtered));
        }
      } catch (error) {
        logger.error('Failed to fetch available cryptos:', error);
        // Fallback to supported assets
        const supported = OnramperService.getSupportedAssets(CHAINS[currentChain].id);
        setAvailableCryptosSet(new Set(supported));
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableCryptos();
  }
}, [isOpen, currentChain, fiatCurrency, userCountry, cryptoCurrencies]);
```

### Voordelen
- ✅ Meest accurate (gebruikt officiële Onramper data)
- ✅ Dynamisch (altijd up-to-date)
- ✅ Snel (één API call per chain)
- ✅ Werkt voor alle chains automatisch
- ✅ Geen onnodige quote checks

### Nadelen
- ⚠️ Vereist API key (maar die hebben we al)
- ⚠️ Eén extra API call bij modal openen (maar cached kan worden)

---

## Voorstel 2: Pre-fetch quotes voor alle crypto's (Quote Validation)

### Concept
Test voor alle mogelijke crypto's of er daadwerkelijk quotes beschikbaar zijn door een snelle quote check te doen.

### Implementatie

#### 1. Nieuwe functie in `OnramperService`:
```typescript
/**
 * Validate which cryptocurrencies have actual quotes available
 * Tests each crypto with a small amount to see if providers return quotes
 */
static async validateAvailableCryptos(
  chainId: number,
  fiatCurrency: string = 'EUR',
  fiatAmount: number = 100, // Small test amount
  apiKey?: string
): Promise<string[]> {
  if (!apiKey) {
    return this.getSupportedAssets(chainId);
  }

  const networkCode = this.getNetworkCode(chainId);
  const cleanApiKey = this.cleanApiKey(apiKey);
  
  // Get list of crypto's to test (from supported assets + common ones)
  const cryptosToTest = [
    ...this.getSupportedAssets(chainId),
    'BTC', 'SOL', 'USDT', 'USDC', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE',
    CHAINS[Object.keys(CHAINS).find(k => CHAINS[k].id === chainId) || '']?.nativeCurrency?.symbol || ''
  ].filter(Boolean);

  const availableCryptos: string[] = [];

  // Test each crypto in parallel (with rate limiting)
  const testPromises = cryptosToTest.map(async (crypto) => {
    try {
      const url = `https://api.onramper.com/quotes?apiKey=${cleanApiKey}&fiatAmount=${fiatAmount}&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': cleanApiKey },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const quotes = data.quotes || [];
      
      // Check if we have at least one valid quote
      const hasValidQuote = quotes.some((q: any) => 
        q.payout && parseFloat(q.payout.toString()) > 0
      );

      return hasValidQuote ? crypto : null;
    } catch (error) {
      return null;
    }
  });

  const results = await Promise.all(testPromises);
  return results.filter(Boolean) as string[];
}
```

#### 2. Update `BuyModal3.tsx`:
```typescript
// Similar to Voorstel 1, but calls validateAvailableCryptos instead
```

### Voordelen
- ✅ 100% accurate (test daadwerkelijk quotes)
- ✅ Werkt altijd, zelfs als Onramper API verandert

### Nadelen
- ❌ Traag (veel API calls nodig)
- ❌ Rate limiting issues
- ❌ Slechte UX (gebruiker moet wachten)
- ❌ Onnodig veel API calls

---

## Voorstel 3: Hybrid Approach - Combineer beide methodes

### Concept
Gebruik eerst `/supported/assets` voor snelle filtering, valideer dan alleen de meest waarschijnlijke crypto's met quote checks.

### Implementatie

#### 1. Combineer beide functies:
```typescript
static async getAvailableCryptosForChainHybrid(
  chainId: number,
  fiatCurrency: string = 'EUR',
  country?: string,
  apiKey?: string
): Promise<string[]> {
  // Step 1: Get from /supported/assets (fast)
  const fromAssets = await this.getAvailableCryptosForChain(
    chainId,
    fiatCurrency,
    country,
    apiKey
  );

  // Step 2: Quick validation for top 3 most likely crypto's
  // (native token + 2 most common stablecoins)
  const nativeToken = this.getDefaultCrypto(chainId);
  const toValidate = [
    nativeToken,
    'USDT',
    'USDC',
  ].filter(c => fromAssets.includes(c));

  // Validate only these 3 (fast, minimal API calls)
  const validated = await Promise.all(
    toValidate.map(async (crypto) => {
      const hasQuote = await this.quickQuoteCheck(
        chainId,
        crypto,
        fiatCurrency,
        apiKey
      );
      return hasQuote ? crypto : null;
    })
  );

  const validatedCryptos = validated.filter(Boolean) as string[];
  
  // Return: validated + rest from assets endpoint
  return [
    ...validatedCryptos,
    ...fromAssets.filter(c => !toValidate.includes(c))
  ];
}
```

### Voordelen
- ✅ Snel (meeste data van assets endpoint)
- ✅ Accurate (validatie voor belangrijkste crypto's)
- ✅ Best of both worlds

### Nadelen
- ⚠️ Complexer (twee stappen)
- ⚠️ Nog steeds enkele extra API calls

---

## Aanbeveling: **Voorstel 1** ⭐

**Waarom Voorstel 1:**
1. **Meest accurate**: Gebruikt officiële Onramper data
2. **Snelst**: Slechts één API call per chain
3. **Eenvoudigst**: Minder code, makkelijker te onderhouden
4. **Toekomstbestendig**: Werkt automatisch voor nieuwe chains/crypto's
5. **Geen rate limiting issues**: Minimale API calls

**Implementatie stappen:**
1. Voeg `getAvailableCryptosForChain()` toe aan `OnramperService`
2. Maak nieuwe API route `/api/onramper/available-cryptos`
3. Update `BuyModal3.tsx` om deze route te gebruiken
4. Test lokaal voor alle 18 chains
5. Voeg caching toe voor performance (optioneel)

**Caching strategie (optioneel):**
- Cache resultaten in localStorage met 24u TTL
- Key: `onramper_available_cryptos_${chainId}_${fiatCurrency}`
- Refresh bij chain change of na 24u

---

## Test Plan

Voor implementatie moeten we testen:
1. Alle 18 chains testen met `/supported/assets` endpoint
2. Verifiëren dat returned crypto's daadwerkelijk quotes hebben
3. Edge cases: chains zonder crypto's, testnets, etc.
4. Performance: API response times meten

