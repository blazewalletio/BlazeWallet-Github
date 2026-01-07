# Snelheidsoptimalisaties voor Quote Validation - 3 Perfecte Voorstellen

## Doel
Voorstel 1 (Quote Validation) implementeren met maximale snelheid zodat gebruikers zo min mogelijk moeten wachten.

## Huidige situatie
- Quote validation voor elke crypto = meerdere sequentiële API calls
- Elke call duurt ~500-1000ms
- 5 crypto's valideren = 2.5-5 seconden wachttijd ❌

---

## Voorstel 1: Aggressive Caching + Progressive Loading ⭐ RECOMMENDED

### Concept
**3-laags caching strategie + Progressive UI updates**

1. **Client-side cache (localStorage)** - 1 uur TTL
2. **Server-side cache (in-memory)** - 5 minuten TTL  
3. **Progressive loading** - Toon native token direct, laad andere crypto's in achtergrond

### Implementatie

#### 1. Client-side caching (localStorage)
```typescript
// In BuyModal3.tsx
const CACHE_KEY_PREFIX = 'onramper_available_cryptos';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const getCachedCryptos = (chainId: number, fiatCurrency: string, country?: string): string[] | null => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}_${chainId}_${fiatCurrency}_${country || 'any'}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < CACHE_TTL) {
      logger.log(`✅ Using cached available cryptos (age: ${Math.round(age / 1000)}s)`);
      return data;
    }
    
    localStorage.removeItem(cacheKey);
    return null;
  } catch {
    return null;
  }
};

const setCachedCryptos = (chainId: number, fiatCurrency: string, country: string | undefined, cryptos: string[]) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}_${chainId}_${fiatCurrency}_${country || 'any'}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      data: cryptos,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore localStorage errors
  }
};
```

#### 2. Server-side caching (in-memory)
```typescript
// In lib/onramper-service.ts
const cryptoCache = new Map<string, { data: string[]; timestamp: number }>();
const SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

static async getAvailableCryptosForChain(
  chainId: number,
  fiatCurrency: string = 'EUR',
  country?: string,
  apiKey?: string
): Promise<string[]> {
  // Check server cache first
  const cacheKey = `${chainId}_${fiatCurrency}_${country || 'any'}`;
  const cached = cryptoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
    logger.log(`✅ Using server-cached available cryptos`);
    return cached.data;
  }

  // ... rest of validation logic ...
  
  // Store in cache
  cryptoCache.set(cacheKey, { data: availableCryptos, timestamp: Date.now() });
  return availableCryptos;
}
```

#### 3. Progressive loading in UI
```typescript
// In BuyModal3.tsx useEffect
useEffect(() => {
  if (isOpen && currentChain) {
    const chain = CHAINS[currentChain];
    if (!chain) return;

    // Step 1: Check cache (instant)
    const cached = getCachedCryptos(chain.id, fiatCurrency, userCountry);
    if (cached) {
      setAvailableCryptosSet(new Set(cached));
      logger.log(`✅ Loaded from cache: ${cached.join(', ')}`);
      return; // Done! No API call needed
    }

    // Step 2: Show native token immediately (no wait)
    const nativeToken = OnramperService.getDefaultCrypto(chain.id);
    setAvailableCryptosSet(new Set([nativeToken]));
    logger.log(`⚡ Showing native token immediately: ${nativeToken}`);

    // Step 3: Fetch and validate in background
    const fetchAvailableCryptos = async () => {
      try {
        const response = await fetch(
          `/api/onramper/available-cryptos?chainId=${chain.id}&fiatCurrency=${fiatCurrency}${userCountry ? `&country=${userCountry}` : ''}`
        );
        
        const data = await response.json();
        
        if (data.success && data.availableCryptos) {
          setAvailableCryptosSet(new Set(data.availableCryptos));
          setCachedCryptos(chain.id, fiatCurrency, userCountry, data.availableCryptos);
          logger.log(`✅ Updated available cryptos: ${data.availableCryptos.join(', ')}`);
        }
      } catch (error) {
        logger.error('Failed to fetch available cryptos:', error);
      }
    };

    fetchAvailableCryptos();
  }
}, [isOpen, currentChain, fiatCurrency, userCountry]);
```

### Snelheid
- **Met cache**: 0ms (instant) ⚡
- **Zonder cache**: Native token direct zichtbaar, andere crypto's binnen 1-2 seconden
- **Cache hit rate**: ~90%+ (gebruikers wisselen niet vaak van chain/fiat)

### Voordelen
- ✅ Instant met cache (meeste gevallen)
- ✅ Progressive loading (native token direct zichtbaar)
- ✅ Goede UX (geen lege dropdown)
- ✅ Minder API calls (cache voorkomt onnodige calls)

---

## Voorstel 2: Parallel Validation met Timeout + Smart Prioritization

### Concept
**Valideer alle crypto's parallel met korte timeout + prioriteer belangrijkste crypto's**

1. Valideer native token eerst (meest waarschijnlijk)
2. Valideer andere crypto's parallel met 2 seconden timeout
3. Toon resultaten zodra ze binnenkomen (progressive)

### Implementatie

```typescript
static async getAvailableCryptosForChain(
  chainId: number,
  fiatCurrency: string = 'EUR',
  country?: string,
  apiKey?: string
): Promise<string[]> {
  // ... get potential cryptos from /supported/assets ...

  const availableCryptos: string[] = [];
  const nativeToken = this.getDefaultCrypto(chainId);

  // Step 1: Validate native token FIRST (highest priority, most likely to work)
  const validateNativeToken = async () => {
    try {
      const quoteUrl = `https://api.onramper.com/quotes?apiKey=${cleanApiKey}&fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${nativeToken}&network=${networkCode}`;
      const response = await fetch(quoteUrl, {
        headers: { 'Authorization': cleanApiKey },
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        const hasValidQuote = (data.quotes || []).some((q: any) => 
          q.payout && parseFloat(q.payout.toString()) > 0
        );
        return hasValidQuote ? nativeToken : null;
      }
    } catch (error) {
      // Timeout or error - assume it works (most likely)
      return nativeToken;
    }
    return null;
  };

  // Step 2: Validate other crypto's in parallel (with timeout)
  const validateOtherCryptos = async (crypto: string) => {
    try {
      const quoteUrl = `https://api.onramper.com/quotes?apiKey=${cleanApiKey}&fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`;
      const response = await fetch(quoteUrl, {
        headers: { 'Authorization': cleanApiKey },
        signal: AbortSignal.timeout(1500), // 1.5 second timeout (shorter for non-native)
      });

      if (response.ok) {
        const data = await response.json();
        const hasValidQuote = (data.quotes || []).some((q: any) => 
          q.payout && parseFloat(q.payout.toString()) > 0
        );
        return hasValidQuote ? crypto : null;
      }
    } catch (error) {
      // Timeout or error - skip this crypto
      return null;
    }
    return null;
  };

  // Validate native token first (blocking - most important)
  const nativeResult = await validateNativeToken();
  if (nativeResult) {
    availableCryptos.push(nativeToken);
  }

  // Validate other crypto's in parallel (non-blocking)
  const otherCryptos = potentialCryptos.filter(c => c !== nativeToken).slice(0, 5); // Max 5
  const otherResults = await Promise.allSettled(
    otherCryptos.map(crypto => validateOtherCryptos(crypto))
  );

  for (const result of otherResults) {
    if (result.status === 'fulfilled' && result.value) {
      availableCryptos.push(result.value);
    }
  }

  // Always include native token as fallback
  if (!availableCryptos.includes(nativeToken)) {
    availableCryptos.unshift(nativeToken);
  }

  return availableCryptos;
}
```

### Snelheid
- **Native token**: ~500-1000ms (blocking, maar meest waarschijnlijk)
- **Andere crypto's**: ~1-2 seconden parallel (non-blocking)
- **Totaal**: ~1-2 seconden (native token direct, andere crypto's parallel)

### Voordelen
- ✅ Snel (parallel validatie)
- ✅ Native token prioriteit (meest belangrijk)
- ✅ Timeout voorkomt lange wachttijden
- ✅ Progressive (native token eerst)

### Nadelen
- ⚠️ Nog steeds 1-2 seconden zonder cache
- ⚠️ Timeout kan valide crypto's missen

---

## Voorstel 3: Pre-fetch bij Modal Open + Optimistic UI

### Concept
**Fetch beschikbare crypto's al bij modal openen (niet pas bij crypto step) + Optimistic UI**

1. Start fetch bij modal openen (in achtergrond)
2. Toon optimistic list (native token + common crypto's)
3. Update wanneer validatie klaar is

### Implementatie

```typescript
// In BuyModal3.tsx

// Fetch available cryptos when modal opens (not when crypto step is reached)
useEffect(() => {
  if (isOpen && currentChain) {
    const chain = CHAINS[currentChain];
    if (!chain) return;

    // Step 1: Check cache (instant)
    const cached = getCachedCryptos(chain.id, fiatCurrency, userCountry);
    if (cached) {
      setAvailableCryptosSet(new Set(cached));
      return;
    }

    // Step 2: Show optimistic list immediately (native + common)
    const nativeToken = OnramperService.getDefaultCrypto(chain.id);
    const optimisticCryptos = [
      nativeToken,
      'USDT',
      'USDC',
    ].filter(c => {
      // Only show if it's in supported assets
      const supported = OnramperService.getSupportedAssets(chain.id);
      return supported.includes(c);
    });
    
    setAvailableCryptosSet(new Set(optimisticCryptos));
    logger.log(`⚡ Showing optimistic cryptos: ${optimisticCryptos.join(', ')}`);

    // Step 3: Fetch and validate in background (start immediately)
    const fetchAvailableCryptos = async () => {
      try {
        const startTime = Date.now();
        
        const response = await fetch(
          `/api/onramper/available-cryptos?chainId=${chain.id}&fiatCurrency=${fiatCurrency}${userCountry ? `&country=${userCountry}` : ''}`
        );
        
        const data = await response.json();
        const fetchTime = Date.now() - startTime;
        
        if (data.success && data.availableCryptos) {
          setAvailableCryptosSet(new Set(data.availableCryptos));
          setCachedCryptos(chain.id, fiatCurrency, userCountry, data.availableCryptos);
          logger.log(`✅ Updated available cryptos (took ${fetchTime}ms): ${data.availableCryptos.join(', ')}`);
        }
      } catch (error) {
        logger.error('Failed to fetch available cryptos:', error);
        // Keep optimistic list on error
      }
    };

    // Start fetch immediately (don't wait for user to reach crypto step)
    fetchAvailableCryptos();
  }
}, [isOpen, currentChain, fiatCurrency, userCountry]);

// Separate effect for when user reaches crypto step (just use already-fetched data)
```

### Snelheid
- **Bij modal openen**: 0ms (optimistic list direct)
- **Bij crypto step**: 0ms (data al gefetched, of bijna klaar)
- **Background fetch**: 1-2 seconden (non-blocking)

### Voordelen
- ✅ Instant bij crypto step (data al gefetched)
- ✅ Optimistic UI (geen lege dropdown)
- ✅ Background fetch (geen wachttijd voor gebruiker)

### Nadelen
- ⚠️ Fetch start bij modal openen (ook als gebruiker niet naar crypto step gaat)
- ⚠️ Optimistic list kan incorrect zijn (wordt gecorrigeerd)

---

## Vergelijking

| Voorstel | Snelheid (met cache) | Snelheid (zonder cache) | UX | Complexiteit |
|----------|---------------------|------------------------|-----|--------------|
| **1. Aggressive Caching** | ⚡ 0ms | ⚡ Native direct, rest 1-2s | ⭐⭐⭐⭐⭐ | Medium |
| **2. Parallel + Timeout** | ⚡ 0ms | ⏱️ 1-2s | ⭐⭐⭐⭐ | Medium |
| **3. Pre-fetch + Optimistic** | ⚡ 0ms | ⚡ 0ms (bij step) | ⭐⭐⭐⭐⭐ | Low |

---

## Aanbeveling: **Voorstel 1 (Aggressive Caching)** ⭐

**Waarom:**
1. **Beste snelheid** - Instant met cache (90%+ van de tijd)
2. **Progressive loading** - Native token direct zichtbaar
3. **Minder API calls** - Cache voorkomt onnodige calls
4. **Goede UX** - Geen lege dropdown, smooth updates

**Combinatie mogelijk:**
- Voorstel 1 (caching) + Voorstel 3 (pre-fetch) = Perfect!
- Cache voor snelheid
- Pre-fetch voor instant bij crypto step
- Progressive loading voor goede UX

---

## Implementatie Plan

### Fase 1: Client-side caching
- localStorage cache met 1 uur TTL
- Check cache eerst, fetch alleen als nodig

### Fase 2: Progressive loading
- Toon native token direct
- Laad andere crypto's in achtergrond
- Update dropdown wanneer klaar

### Fase 3: Pre-fetch (optioneel)
- Start fetch bij modal openen
- Optimistic list tonen
- Update wanneer klaar

### Fase 4: Server-side caching (optioneel)
- In-memory cache op server
- 5 minuten TTL
- Voorkomt duplicate API calls

