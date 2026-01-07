# 🔍 3 Perfecte Voorstellen: Chain-Specifieke Crypto Beschikbaarheid

## Probleem
Gebruikers zien crypto's in de dropdown (bijv. USDT op Solana) die later niet beschikbaar blijken te zijn, wat leidt tot slechte UX.

## Test Resultaten
- **Solana**: Alleen SOL beschikbaar (USDT/USDC geven geen valide quotes)
- **Ethereum**: Alleen ETH en BTC beschikbaar
- **Andere chains**: Moeten nog getest worden

---

## ✅ VOORSTEL 1: Real-Time Quote Verificatie (Meest Accuraat)

### Concept
Bij het openen van de "Crypto" stap, testen we voor elke crypto in de lijst of er daadwerkelijk quotes beschikbaar zijn door een test-quote op te halen.

### Implementatie
1. **Nieuwe functie**: `checkCryptoAvailability(chainId, crypto)`
   - Roept `/api/onramper/quotes` aan met een test amount (100 EUR)
   - Controleert of er valide quotes zijn (met `payout` > 0)
   - Retourneert `true` als beschikbaar, `false` anders

2. **Bij crypto stap**:
   - Toon loading state: "Checking available cryptocurrencies..."
   - Test alle crypto's parallel (Promise.all)
   - Filter alleen crypto's met valide quotes
   - Update dropdown

3. **Caching**:
   - Cache resultaten per chain in localStorage (5 minuten)
   - Voorkomt onnodige API calls bij herhaalde bezoeken

### Code Structuur
```typescript
// In BuyModal3.tsx
const [checkingCryptoAvailability, setCheckingCryptoAvailability] = useState(false);
const [availableCryptosForChain, setAvailableCryptosForChain] = useState<string[]>([]);

const checkCryptoAvailability = async (crypto: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `/api/onramper/quotes?fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}`
    );
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data.quotes) && data.quotes.some((q: any) => q.payout > 0);
  } catch {
    return false;
  }
};

// Bij crypto stap
useEffect(() => {
  if (flowStep === 'crypto' && currentChain) {
    setCheckingCryptoAvailability(true);
    const chain = CHAINS[currentChain];
    const cryptosToTest = cryptoCurrencies.length > 0 
      ? cryptoCurrencies 
      : OnramperService.getSupportedAssets(chain.id);
    
    Promise.all(
      cryptosToTest.map(async (crypto) => ({
        crypto,
        available: await checkCryptoAvailability(crypto)
      }))
    ).then(results => {
      const available = results
        .filter(r => r.available)
        .map(r => r.crypto);
      setAvailableCryptosForChain(available);
      setCheckingCryptoAvailability(false);
    });
  }
}, [flowStep, currentChain, cryptoCurrencies]);
```

### Voordelen
- ✅ 100% accuraat - alleen crypto's met echte quotes worden getoond
- ✅ Real-time data - altijd up-to-date
- ✅ Geen hardcoded lijsten nodig

### Nadelen
- ⚠️ Kan traag zijn (2-5 seconden) als er veel crypto's zijn
- ⚠️ Extra API calls (maar gecached)

### Geschatte Performance
- 5 crypto's: ~2-3 seconden
- 10 crypto's: ~4-5 seconden
- Met caching: <1 seconde (na eerste keer)

---

## ✅ VOORSTEL 2: Hybrid Approach - Hardcoded + Real-Time Verificatie (Beste Balans)

### Concept
Combineer hardcoded lijst (voor snelheid) met real-time verificatie (voor accuraatheid). Test alleen crypto's die in de hardcoded lijst staan.

### Implementatie
1. **Update `getSupportedAssets()`**:
   - Gebruik de hardcoded lijst als basis
   - Maar test deze crypto's bij het openen van de crypto stap

2. **Bij crypto stap**:
   - Toon eerst crypto's uit hardcoded lijst (instant)
   - Test in achtergrond welke echt beschikbaar zijn
   - Update dropdown dynamisch (verwijder onbeschikbare)

3. **Caching**:
   - Cache verificatie resultaten per chain
   - Hardcoded lijst als fallback

### Code Structuur
```typescript
// In BuyModal3.tsx
const [availableCryptosForChain, setAvailableCryptosForChain] = useState<string[]>([]);
const [isVerifyingCryptos, setIsVerifyingCryptos] = useState(false);

// Bij crypto stap - toon eerst hardcoded, verifieer daarna
useEffect(() => {
  if (flowStep === 'crypto' && currentChain) {
    const chain = CHAINS[currentChain];
    const hardcodedCryptos = OnramperService.getSupportedAssets(chain.id);
    
    // Toon eerst hardcoded lijst (instant)
    setAvailableCryptosForChain(hardcodedCryptos);
    
    // Verifieer in achtergrond
    setIsVerifyingCryptos(true);
    Promise.all(
      hardcodedCryptos.map(async (crypto) => ({
        crypto,
        available: await checkCryptoAvailability(crypto)
      }))
    ).then(results => {
      const available = results
        .filter(r => r.available)
        .map(r => r.crypto);
      setAvailableCryptosForChain(available);
      setIsVerifyingCryptos(false);
    });
  }
}, [flowStep, currentChain]);
```

### Voordelen
- ✅ Snelle initial load (hardcoded lijst direct zichtbaar)
- ✅ Accuraat (verificatie in achtergrond)
- ✅ Betere UX (geen wachttijd voor eerste render)

### Nadelen
- ⚠️ Hardcoded lijst moet onderhouden worden
- ⚠️ Korte flash van onbeschikbare crypto's mogelijk

### Geschatte Performance
- Initial render: <100ms (hardcoded)
- Verificatie: 2-3 seconden (achtergrond)
- Met caching: <1 seconde (na eerste keer)

---

## ✅ VOORSTEL 3: Server-Side Pre-Filtering (Meest Efficiënt)

### Concept
Filter crypto's op de server-side voordat ze naar de client worden gestuurd. De server test beschikbaarheid per chain.

### Implementatie
1. **Nieuwe API endpoint**: `/api/onramper/available-cryptos?chainId=101`
   - Test alle crypto's voor de gegeven chain
   - Retourneert alleen beschikbare crypto's
   - Gebruikt caching (5 minuten server-side)

2. **Update `/api/onramper/supported-data`**:
   - Accepteert optionele `chainId` parameter
   - Als `chainId` wordt gegeven, filter crypto's op beschikbaarheid
   - Retourneert alleen crypto's met valide quotes

3. **In BuyModal3**:
   - Roep `/api/onramper/supported-data?chainId=${chain.id}` aan
   - Gebruik gefilterde lijst direct

### Code Structuur
```typescript
// In app/api/onramper/supported-data/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainIdParam = searchParams.get('chainId');
  const chainId = chainIdParam ? parseInt(chainIdParam) : null;
  
  // ... existing code to get supported data ...
  
  if (chainId && cryptoCurrencies.length > 0) {
    // Filter crypto's op beschikbaarheid voor deze chain
    const availableCryptos = await Promise.all(
      cryptoCurrencies.map(async (crypto) => {
        const hasQuotes = await testCryptoQuotes(crypto, chainId);
        return hasQuotes ? crypto : null;
      })
    );
    
    cryptoCurrencies = availableCryptos.filter(c => c !== null) as string[];
  }
  
  return NextResponse.json({ ... });
}

// In BuyModal3.tsx
const fetchSupportedData = async () => {
  const chain = CHAINS[currentChain];
  const chainId = chain?.id;
  
  const url = chainId 
    ? `/api/onramper/supported-data?chainId=${chainId}`
    : '/api/onramper/supported-data';
    
  const response = await fetch(url);
  // ... rest of code ...
};
```

### Voordelen
- ✅ Zeer efficiënt (server-side caching)
- ✅ Geen client-side verificatie nodig
- ✅ Snelle response (gecached)
- ✅ Schaalbaar

### Nadelen
- ⚠️ Server-side implementatie vereist
- ⚠️ Cache management nodig

### Geschatte Performance
- Eerste request: 2-3 seconden
- Gecachte requests: <200ms
- Client-side: Instant (geen verificatie nodig)

---

## 🎯 AANBEVELING: VOORSTEL 2 (Hybrid Approach)

**Waarom?**
- Beste balans tussen snelheid en accuraatheid
- Goede UX (instant initial render)
- Eenvoudig te implementeren
- Geen server-side changes nodig

**Implementatie Tijd**: ~2-3 uur
**Performance Impact**: Minimaal (caching voorkomt herhaalde calls)

---

## 📊 Vergelijking Tabel

| Feature | Voorstel 1 | Voorstel 2 | Voorstel 3 |
|---------|-----------|-----------|-----------|
| **Accuraatheid** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Snelheid (initial)** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Snelheid (cached)** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Implementatie** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Onderhoud** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **UX** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🚀 Volgende Stappen

1. Kies een voorstel
2. Implementeer de gekozen oplossing
3. Test grondig op alle chains
4. Deploy en monitor performance

