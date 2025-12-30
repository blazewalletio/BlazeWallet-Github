# 📊 TOKEN PRICE CHART DEBUG & FIX PROPOSAL

**Datum**: 29 december 2025  
**Status**: Voorstel - Wacht op goedkeuring  
**Focus**: ETH native token op Ethereum chain

---

## 🔍 HUIDIGE SITUATIE ANALYSE

### **Wat werkt:**
- ✅ **1D**: Werkt perfect (geen interval parameter, 5-minute granularity)
- ✅ **1J**: Werkt perfect (365 days, interval=daily)

### **Wat werkt NIET:**
- ❌ **LIVE**: Werkt niet (gebruikt days=1 maar speciale update logica)
- ❌ **7D**: Werkt niet (interval=hourly, mogelijk API key issue)
- ❌ **30D**: Werkt niet (interval=hourly, mogelijk API key issue)
- ❌ **ALLES**: Werkt niet (365 days, maar mogelijk andere issue)

---

## 🔎 HUIDIGE IMPLEMENTATIE FLOW

### **1. Frontend: `TokenPriceChart.tsx`**
```
User selecteert timeframe (LIVE, 1D, 7D, 30D, 1J, ALLES)
  ↓
getDaysForTimeframe() → Converteert naar days (1, 7, 30, 365)
  ↓
loadPriceHistory() → Roept getTokenPriceHistory() aan
  ↓
getTokenPriceHistory() → Roept /api/price-history aan
```

### **2. API Route: `app/api/price-history/route.ts`**
```
Ontvangt: symbol, days, contractAddress, chain
  ↓
Zoekt CoinGecko ID (contract lookup → symbol mapping → search API)
  ↓
Berekent interval:
  - days === 1 → interval = null (5-minute auto)
  - days <= 90 → interval = 'hourly'
  - days > 90 → interval = 'daily'
  ↓
CoinGecko API call:
  - ZONDER API KEY (free tier)
  - URL: /market_chart?vs_currency=usd&days={days}&interval={interval}
  ↓
Parse response → Return prices array
```

### **3. Probleem Analyse**

**Waarschijnlijke oorzaken:**

1. **LIVE mode**:
   - Gebruikt `days=1` maar heeft speciale `updateLivePrice()` logica
   - Mogelijk conflict tussen LIVE update en normale history fetch

2. **7D & 30D (interval=hourly)**:
   - CoinGecko free tier heeft mogelijk beperkingen op `interval=hourly`
   - Betaalde API key nodig voor hourly data
   - Of: interval parameter syntax is incorrect

3. **ALLES (365 days, interval=daily)**:
   - Mogelijk te veel data points
   - Of: CoinGecko API limiet voor free tier

4. **API Key niet gebruikt**:
   - Code gebruikt `useApiKey = false` (free tier)
   - Betaalde key `CG-2zNxDeFXb8KJ2DSnpWMdKi7z` wordt niet gebruikt

---

## 🎯 VOORSTEL: DEBUGGING & FIX STRATEGIE

### **FASE 1: COMPREHENSIVE DEBUG LOGGING** 🔍

**Doel**: Exact zien wat er mis gaat bij elke timeframe

**Implementatie**:
1. **Enhanced logging in API route**:
   - Log exact CoinGecko URL die wordt aangeroepen
   - Log API response status, headers, body (truncated)
   - Log rate limit headers (`x-ratelimit-remaining`)
   - Log error messages volledig

2. **Frontend logging**:
   - Log welke timeframe wordt geselecteerd
   - Log API call URL en parameters
   - Log response data (success/error)
   - Log data processing stappen

3. **Debug panel (tijdelijk)**:
   - Toon API call details in UI
   - Toon response status en data points count
   - Toon errors duidelijk

**Files te wijzigen**:
- `app/api/price-history/route.ts` - Enhanced logging
- `components/TokenPriceChart.tsx` - Enhanced logging + debug panel
- `lib/token-price-history.ts` - Enhanced logging

---

### **FASE 2: COINGECKO API KEY INTEGRATIE** 🔑

**Doel**: Gebruik betaalde API key voor betere rate limits en data

**Implementatie**:
1. **API Key toevoegen aan Vercel**:
   ```bash
   vercel env add COINGECKO_API_KEY production
   # Value: CG-2zNxDeFXb8KJ2DSnpWMdKi7z
   ```

2. **API route updaten**:
   - Gebruik API key in alle CoinGecko calls
   - Format: `?x_cg_demo_api_key={API_KEY}` (voor demo tier)
   - Of: `x-cg-demo-api-key` header (check CoinGecko docs)

3. **Rate limit monitoring**:
   - Log rate limit headers
   - Implement rate limit handling
   - Fallback naar free tier als key faalt

**Files te wijzigen**:
- `app/api/price-history/route.ts` - API key integration
- `.env.example` - Document COINGECKO_API_KEY

---

### **FASE 3: COINGECKO MCP SERVER INTEGRATIE** 🤖

**Doel**: Gebruik CoinGecko MCP server voor betere data access

**Voordelen**:
- Directe integratie met CoinGecko data
- Betere error handling
- Geoptimaliseerde queries
- AI-native approach

**Implementatie**:
1. **MCP Server connectie**:
   - Configureer CoinGecko MCP server
   - Test connectie

2. **MCP Tools gebruiken**:
   - `coin_market_chart_by_id` voor price history
   - `coin_by_id` voor token details
   - `simple_price` voor current price

3. **Hybrid approach**:
   - MCP voor primary data
   - Direct API als fallback
   - Best of both worlds

**Files te wijzigen**:
- `lib/coingecko-mcp-service.ts` - Nieuw bestand voor MCP integration
- `app/api/price-history/route.ts` - Integreer MCP als primary source

---

### **FASE 4: INTERVAL & TIMEFRAME FIXES** ⚙️

**Doel**: Fix interval parameter issues

**Problemen te fixen**:
1. **LIVE mode**:
   - Gebruik `days=1` met `interval=null` (5-minute data)
   - Update alleen laatste data point (niet hele history)
   - Refresh interval: 1 seconde

2. **7D & 30D (hourly)**:
   - Verifieer `interval=hourly` syntax
   - Test met API key (betaalde tier)
   - Fallback naar daily als hourly faalt

3. **ALLES (365 days)**:
   - Gebruik `interval=daily` (correct)
   - Verifieer data points count
   - Check voor rate limits

**Files te wijzigen**:
- `app/api/price-history/route.ts` - Fix interval logic
- `components/TokenPriceChart.tsx` - Fix LIVE mode logic

---

## 📋 IMPLEMENTATIE PLAN

### **STAP 1: Debug Logging** (15 min)
1. Add comprehensive logging in API route
2. Add debug panel in frontend (tijdelijk)
3. Test alle timeframes en log results

### **STAP 2: API Key Integration** (10 min)
1. Add API key to Vercel env vars
2. Update API route to use key
3. Test rate limits

### **STAP 3: MCP Server Setup** (20 min)
1. Configure CoinGecko MCP server
2. Test connectie
3. Create MCP service wrapper

### **STAP 4: Fix Interval Issues** (15 min)
1. Fix LIVE mode logic
2. Fix 7D/30D hourly interval
3. Test alle timeframes

### **STAP 5: Testing & Validation** (10 min)
1. Test alle timeframes met ETH
2. Test met andere tokens
3. Verify data quality

**Totaal tijd**: ~70 minuten

---

## 🎯 VERWACHT RESULTAAT

Na implementatie:
- ✅ **LIVE**: Real-time price updates (1 seconde refresh)
- ✅ **1D**: 5-minute granularity (288 points)
- ✅ **7D**: Hourly data (~168 points)
- ✅ **30D**: Hourly data (~720 points)
- ✅ **1J**: Daily data (~365 points)
- ✅ **ALLES**: Daily data (max available)

---

## 🔧 TECHNISCHE DETAILS

### **CoinGecko API Endpoints**:
```
GET /api/v3/coins/{id}/market_chart
  ?vs_currency=usd
  &days={days}
  &interval={interval}  // Optional: hourly, daily, or null (auto)
  &x_cg_demo_api_key={API_KEY}  // For paid tier
```

### **Interval Rules**:
- `days=1`: No interval → 5-minute data (auto)
- `days=2-90`: `interval=hourly` → Hourly data
- `days>90`: `interval=daily` → Daily data

### **MCP Server Tools**:
- `coin_market_chart_by_id`: Price history
- `coin_by_id`: Token details
- `simple_price`: Current price

---

## ✅ VOORDELEN VAN DIT VOORSTEL

1. **Comprehensive debugging**: Exact zien wat er mis gaat
2. **API key integration**: Betere rate limits en data access
3. **MCP server**: AI-native approach, betere error handling
4. **Structured approach**: Stap voor stap, testbaar
5. **Backward compatible**: Geen breaking changes

---

**Klaar voor implementatie?** Wacht op goedkeuring van gebruiker.
