# 💡 3 Fantastische Voorstellen: Realistische Quotes voor Crypto's zonder payout/rate

## 🎯 Probleem
USDT (en andere crypto's) hebben providers, maar geven geen `payout`/`rate` in de quotes response. We moeten:
1. Crypto's met providers tonen (zoals nu)
2. Realistische quote berekenen/weergeven als payout/rate ontbreekt
3. Toch door kunnen gaan met checkout

---

## ✅ VOORSTEL 1: Market Rate + Provider Fee Estimation (Meest Accuraat)

### Concept
Gebruik market rate van CoinGecko/Binance + geschatte provider fees om een realistische quote te berekenen.

### Implementatie

#### Stap 1: Get Market Rate
```typescript
// In BuyModal3.tsx of nieuwe service
async function calculateEstimatedQuote(
  fiatAmount: number,
  fiatCurrency: string,
  cryptoCurrency: string,
  providerQuote: ProviderQuote // Quote zonder payout/rate maar met provider info
): Promise<Quote> {
  // 1. Get current market rate
  const marketRate = await priceService.getPrice(cryptoCurrency);
  
  // 2. Calculate base crypto amount
  const baseCryptoAmount = fiatAmount / marketRate;
  
  // 3. Estimate fees based on provider
  const feePercentage = getProviderFeeEstimate(providerQuote.ramp);
  const totalFee = fiatAmount * feePercentage;
  
  // 4. Calculate final crypto amount (after fees)
  const finalCryptoAmount = baseCryptoAmount * (1 - feePercentage);
  
  // 5. Calculate exchange rate
  const exchangeRate = fiatAmount / finalCryptoAmount;
  
  return {
    cryptoAmount: finalCryptoAmount.toFixed(8),
    exchangeRate: exchangeRate.toFixed(2),
    fee: totalFee.toFixed(2),
    totalAmount: fiatAmount.toFixed(2),
    baseCurrency: fiatCurrency,
    quoteCurrency: cryptoCurrency,
  };
}

function getProviderFeeEstimate(ramp: string): number {
  // Provider-specific fee estimates (based on typical fees)
  const feeMap: Record<string, number> = {
    'moonpay': 0.045, // ~4.5%
    'banxa': 0.04,    // ~4%
    'transak': 0.035, // ~3.5%
    'ramp': 0.04,     // ~4%
    'onramp.money': 0.035, // ~3.5%
  };
  
  return feeMap[ramp.toLowerCase()] || 0.04; // Default 4%
}
```

#### Stap 2: Use in BuyModal3
```typescript
// In fetchQuote function
if (quotesToUse.length > 0 && validQuotes.length === 0) {
  // No quotes with payout/rate, but we have providers
  console.log(`⚠️ No quotes with payout/rate, calculating estimated quotes...`);
  
  const estimatedQuotes = await Promise.all(
    quotesToUse.map(async (q: ProviderQuote) => {
      const estimatedQuote = await calculateEstimatedQuote(
        parseFloat(fiatAmount),
        fiatCurrency,
        cryptoCurrency,
        q
      );
      
      return {
        ...q,
        estimatedQuote, // Add estimated quote
        isEstimated: true, // Flag as estimated
      };
    })
  );
  
  // Use estimated quotes
  quotesToUse = estimatedQuotes;
  setProviderQuotes(estimatedQuotes);
  
  // Select first provider
  const firstProvider = estimatedQuotes[0];
  setSelectedProvider(firstProvider.ramp);
  setQuote(estimatedQuotes[0].estimatedQuote);
}
```

#### Stap 3: Display Warning
```typescript
// In UI
{quote && quote.isEstimated && (
  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
    <p className="text-sm text-yellow-800">
      ⚠️ Estimated quote based on market rate. Final amount may vary.
    </p>
  </div>
)}
```

### Voordelen
- ✅ Meest accuraat (gebruikt echte market rates)
- ✅ Provider-specifieke fee estimates
- ✅ Transparant (gebruiker ziet dat het geschat is)
- ✅ Werkt voor alle crypto's

### Nadelen
- ⚠️ Extra API call voor market rate (maar gecached)
- ⚠️ Fees zijn geschat (kunnen afwijken)

---

## ✅ VOORSTEL 2: Onramper Widget Direct Integration (Meest Betrouwbaar)

### Concept
Als er geen quotes met payout/rate zijn, open direct de Onramper widget die zelf de quote berekent en checkout afhandelt.

### Implementatie

#### Stap 1: Detect Missing Quotes
```typescript
// In fetchQuote
if (quotesToUse.length > 0 && validQuotes.length === 0) {
  // We have providers but no quotes with payout/rate
  // This means we should use Onramper widget directly
  console.log(`⚠️ No quotes with payout/rate, using Onramper widget for ${cryptoCurrency}`);
  
  // Store provider info for widget
  setProviderQuotes(quotesToUse.map(q => ({
    ...q,
    useWidget: true, // Flag to use widget
  })));
  
  // Generate widget URL
  const widgetUrl = await OnramperService.generateWidgetUrl({
    walletAddress: getCurrentAddress(),
    defaultCryptoCurrency: cryptoCurrency,
    defaultFiatCurrency: fiatCurrency,
    defaultAmount: parseFloat(fiatAmount),
    onlyCryptos: cryptoCurrency,
    onlyFiats: fiatCurrency,
    // Pre-select provider if possible
    ...(quotesToUse[0]?.ramp && { defaultProvider: quotesToUse[0].ramp }),
  });
  
  setWidgetUrl(widgetUrl);
  setShowWidget(true);
  setFlowStep('widget'); // Skip quotes step, go to widget
  return;
}
```

#### Stap 2: Widget Flow
```typescript
// In BuyModal3 render
{showWidget && widgetUrl && (
  <div className="w-full h-[600px]">
    <iframe
      src={widgetUrl}
      className="w-full h-full border-0 rounded-xl"
      allow="camera; payment"
    />
  </div>
)}
```

#### Stap 3: Handle Widget Callback
```typescript
// Listen for widget messages
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== 'https://buy.onramper.com') return;
    
    if (event.data.type === 'onramper:transaction-complete') {
      // Transaction completed in widget
      setFlowStep('success');
      setShowWidget(false);
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

### Voordelen
- ✅ Meest betrouwbaar (Onramper berekent zelf)
- ✅ Geen geschatte quotes nodig
- ✅ Volledige checkout flow in widget
- ✅ Provider selectie in widget

### Nadelen
- ⚠️ Minder controle over UI/UX
- ⚠️ Gebruiker moet widget gebruiken (niet onze custom UI)

---

## ✅ VOORSTEL 3: Hybrid Approach - Estimated Quote + Widget Fallback (Beste Balans)

### Concept
Combineer beide: toon geschatte quote in onze UI, maar gebruik widget als fallback voor checkout.

### Implementatie

#### Stap 1: Calculate Estimated Quote (zoals Voorstel 1)
```typescript
// Calculate estimated quote for display
const estimatedQuote = await calculateEstimatedQuote(...);
setQuote(estimatedQuote);
setProviderQuotes(quotesWithEstimated);
```

#### Stap 2: Display Estimated Quote with Warning
```typescript
// In quotes step UI
{quote && quote.isEstimated && (
  <div className="sticky top-4 z-10 glass-card p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
    <div className="flex items-start gap-3 mb-4">
      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
      <div>
        <h3 className="font-semibold text-yellow-900">Estimated Quote</h3>
        <p className="text-sm text-yellow-700">
          This is an estimated quote based on current market rates. 
          The final amount will be calculated by the provider during checkout.
        </p>
      </div>
    </div>
    
    {/* Show estimated quote */}
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">You pay:</span>
        <span className="font-semibold">{fiatAmount} {fiatCurrency}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">You receive (est.):</span>
        <span className="font-semibold text-4xl">{quote.cryptoAmount} {cryptoCurrency}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-500">
        <span>Estimated rate:</span>
        <span>1 {cryptoCurrency} = {quote.exchangeRate} {fiatCurrency}</span>
      </div>
    </div>
  </div>
)}
```

#### Stap 3: Use Widget for Checkout
```typescript
// In handleContinue
if (quote?.isEstimated) {
  // For estimated quotes, use Onramper widget for actual checkout
  const widgetUrl = await OnramperService.generateWidgetUrl({
    walletAddress: getCurrentAddress(),
    defaultCryptoCurrency: cryptoCurrency,
    defaultFiatCurrency: fiatCurrency,
    defaultAmount: parseFloat(fiatAmount),
    onlyCryptos: cryptoCurrency,
    onlyFiats: fiatCurrency,
    defaultProvider: selectedProvider || providerQuotes[0]?.ramp,
  });
  
  setWidgetUrl(widgetUrl);
  setShowWidget(true);
  setFlowStep('widget');
  return;
}

// For quotes with payout/rate, use normal checkout flow
// ... existing checkout logic
```

#### Stap 4: Smart Provider Selection
```typescript
// Select best provider even without payout/rate
const selectProviderForEstimated = (quotes: ProviderQuote[]) => {
  // Prefer providers without errors
  const withoutErrors = quotes.filter(q => !q.errors || q.errors.length === 0);
  if (withoutErrors.length > 0) {
    return withoutErrors[0];
  }
  
  // Fallback to first provider
  return quotes[0];
};
```

### Voordelen
- ✅ Beste balans (onze UI + widget fallback)
- ✅ Gebruiker ziet geschatte quote (transparant)
- ✅ Widget zorgt voor accurate checkout
- ✅ Flexibel (kan beide flows gebruiken)

### Nadelen
- ⚠️ Iets complexer (twee flows)
- ⚠️ Gebruiker ziet geschatte quote maar krijgt andere in widget

---

## 📊 Vergelijking Tabel

| Feature | Voorstel 1 | Voorstel 2 | Voorstel 3 |
|---------|-----------|-----------|-----------|
| **Accuraatheid** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **UI Controle** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Implementatie** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **User Experience** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibiliteit** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 AANBEVELING: VOORSTEL 3 (Hybrid Approach)

**Waarom?**
- Beste balans tussen controle en betrouwbaarheid
- Gebruiker ziet geschatte quote (transparant)
- Widget zorgt voor accurate checkout
- Flexibel voor toekomstige verbeteringen

**Implementatie Tijd**: ~3-4 uur
**Complexiteit**: Medium

---

## 🔧 Implementatie Details voor Voorstel 3

### 1. Create Quote Calculation Service
```typescript
// lib/estimated-quote-service.ts
export class EstimatedQuoteService {
  static async calculate(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    provider: string
  ): Promise<Quote & { isEstimated: true }> {
    // Get market rate
    const marketRate = await priceService.getPrice(cryptoCurrency);
    
    // Calculate fees
    const feePercentage = this.getProviderFee(provider);
    const totalFee = fiatAmount * feePercentage;
    const cryptoAmount = (fiatAmount - totalFee) / marketRate;
    const exchangeRate = fiatAmount / cryptoAmount;
    
    return {
      cryptoAmount: cryptoAmount.toFixed(8),
      exchangeRate: exchangeRate.toFixed(2),
      fee: totalFee.toFixed(2),
      totalAmount: fiatAmount.toFixed(2),
      baseCurrency: fiatCurrency,
      quoteCurrency: cryptoCurrency,
      isEstimated: true,
    };
  }
  
  private static getProviderFee(provider: string): number {
    // Provider fee estimates
    const fees: Record<string, number> = {
      'moonpay': 0.045,
      'banxa': 0.04,
      'transak': 0.035,
      'ramp': 0.04,
    };
    return fees[provider.toLowerCase()] || 0.04;
  }
}
```

### 2. Update BuyModal3.tsx
- Detect quotes without payout/rate
- Calculate estimated quotes
- Display with warning
- Use widget for checkout

### 3. Update UI
- Show estimated quote badge
- Display warning message
- Enable "Continue" button for estimated quotes

---

## ✅ Conclusie

Voorstel 3 biedt de beste balans: gebruiker ziet geschatte quote in onze mooie UI, maar checkout gebeurt via Onramper widget voor accuraatheid. Dit geeft de beste user experience met maximale flexibiliteit.

