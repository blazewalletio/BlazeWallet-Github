# 🔍 DEBUG PROPOSAL - Token Price Chart (LIVE, 7D, 30D, ALLES)

**Probleem**: LIVE, 7D, 30D en ALLES grafieken werken niet, maar 1D en 1J werken perfect.

**Doel**: Perfecte debug logging toevoegen om exact te zien wat er mis gaat.

---

## 📋 DEBUG PLAN

### **STAP 1: Enhanced Logging in TokenPriceChart Component**

**Toevoegen aan `components/TokenPriceChart.tsx`**:

1. **Timeframe Selection Logging**
   - Log wanneer gebruiker een timeframe selecteert
   - Log de geselecteerde timeframe
   - Log de berekende `days` waarde
   - Log of het LIVE mode is

2. **API Call Logging**
   - Log VOOR elke API call: URL, parameters, timeframe
   - Log NA elke API call: response status, data length, eerste/laatste data point
   - Log errors met volledige details

3. **Data Processing Logging**
   - Log hoeveel data points binnenkomen
   - Log na filtering hoeveel valid points overblijven
   - Log min/max price berekening
   - Log data formatting (timestamp conversion)

4. **Cache Logging**
   - Log cache hits/misses
   - Log cache keys
   - Log cache refresh status

5. **State Updates Logging**
   - Log wanneer `setPriceHistory` wordt aangeroepen
   - Log hoeveel data points worden gezet
   - Log wanneer `setIsLoading` wordt aangeroepen
   - Log min/max value updates

6. **Error Logging**
   - Log alle errors met stack traces
   - Log error context (timeframe, symbol, etc.)

---

### **STAP 2: Enhanced Logging in API Route**

**Toevoegen aan `app/api/price-history/route.ts`**:

1. **Request Logging**
   - Log alle query parameters
   - Log symbol, days, contractAddress, chain
   - Log interval berekening

2. **CoinGecko ID Resolution Logging**
   - Log elke stap van ID resolution
   - Log contract lookup resultaten
   - Log symbol-to-ID mapping resultaten
   - Log search API resultaten

3. **API Call Logging**
   - Log exacte CoinGecko URL
   - Log interval parameter (of null)
   - Log API key status
   - Log response status code
   - Log response headers (rate limit info)

4. **Data Processing Logging**
   - Log raw data length van CoinGecko
   - Log na filtering hoeveel points overblijven
   - Log eerste en laatste timestamp
   - Log eerste en laatste price
   - Log data sorting resultaten

5. **Error Logging**
   - Log alle errors met volledige details
   - Log HTTP status codes
   - Log rate limit errors
   - Log parsing errors

---

### **STAP 3: Visual Debug Panel (Optional)**

**Toevoegen aan `components/TokenPriceChart.tsx`**:

Een debug panel dat toont (alleen in development):
- Huidige timeframe
- Data points count
- API call status
- Cache status
- Error messages
- Last update time

---

### **STAP 4: Network Request Tracking**

**Toevoegen aan `components/TokenPriceChart.tsx`**:

- Log alle fetch calls met timestamps
- Log response times
- Log response sizes
- Log network errors

---

## 🎯 IMPLEMENTATIE DETAILS

### **Logging Format**

```typescript
logger.log(`[TokenPriceChart:${selectedTimeframe}] Action: Description`, {
  timeframe: selectedTimeframe,
  days: days,
  symbol: tokenSymbol,
  dataPoints: priceHistory.length,
  minPrice: minValue,
  maxPrice: maxValue,
  // ... andere relevante data
});
```

### **Error Logging Format**

```typescript
logger.error(`[TokenPriceChart:${selectedTimeframe}] Error: Description`, {
  timeframe: selectedTimeframe,
  symbol: tokenSymbol,
  error: error.message,
  stack: error.stack,
  // ... context
});
```

---

## 📊 VERWACHTE DEBUG OUTPUT

**Voor elke timeframe selectie zou je moeten zien**:

```
[TokenPriceChart:LIVE] Timeframe selected: LIVE
[TokenPriceChart:LIVE] Calculated days: 1
[TokenPriceChart:LIVE] Checking cache...
[TokenPriceChart:LIVE] Cache miss, fetching from API
[TokenPriceChart:LIVE] API call: /api/price-history?symbol=ETH&days=1&chain=ethereum
[Price History API] Request: { symbol: 'ETH', days: 1, chain: 'ethereum' }
[Price History API] CoinGecko ID: ethereum
[Price History API] URL: https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=1
[Price History API] Response: 200 OK, 288 data points
[TokenPriceChart:LIVE] Received 288 data points
[TokenPriceChart:LIVE] After filtering: 288 valid points
[TokenPriceChart:LIVE] Min price: $2916.74, Max price: $2950.39
[TokenPriceChart:LIVE] Setting price history: 288 points
[TokenPriceChart:LIVE] Chart rendered successfully
```

**Als er een error is**:

```
[TokenPriceChart:7D] Timeframe selected: 7D
[TokenPriceChart:7D] Calculated days: 7
[TokenPriceChart:7D] API call failed: Error message
[TokenPriceChart:7D] Error details: { status: 429, message: 'Rate limited' }
```

---

## ✅ VOORDELEN

1. **Perfecte zichtbaarheid**: Je ziet exact wat er gebeurt bij elke stap
2. **Error tracking**: Alle errors worden gelogd met volledige context
3. **Performance tracking**: Je ziet response times en data sizes
4. **Cache debugging**: Je ziet wanneer cache wordt gebruikt vs API calls
5. **Data validation**: Je ziet hoeveel data points worden gefilterd

---

## 🚀 IMPLEMENTATIE

**Files te wijzigen**:
1. `components/TokenPriceChart.tsx` - Add comprehensive logging
2. `app/api/price-history/route.ts` - Add detailed API logging

**Tijd**: ~30 minuten

**Risico**: **ZEER LAAG** - Alleen logging toegevoegd, geen functionaliteit verandert

---

**Klaar voor implementatie?** ✅ Ja - Dit geeft perfecte debug visibility zonder functionaliteit te veranderen.

