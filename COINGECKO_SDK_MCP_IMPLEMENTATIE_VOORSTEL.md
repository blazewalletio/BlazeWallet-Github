# 🦎 COINGECKO SDK & MCP SERVER IMPLEMENTATIE VOORSTEL

**Datum**: 29 december 2025  
**Status**: Voorstel - Wacht op goedkeuring  
**Focus**: Perfecte price charts voor alle timeframes (LIVE, 1D, 7D, 30D, 1J, ALLES)  
**API Key**: `CG-2zNxDeFXb8KJ2DSnpWMdKi7z` (Betaalde tier)

---

## 🎯 DOEL

Implementeer de CoinGecko TypeScript SDK en integreer de CoinGecko MCP server om:
- ✅ Perfecte price charts voor **alle** timeframes
- ✅ Betere error handling en type safety
- ✅ Optimale gebruik van betaalde API key
- ✅ AI-native approach via MCP server
- ✅ Betere rate limit handling

---

## 📊 HUIDIGE SITUATIE

### **Wat werkt:**
- ✅ **1D**: Werkt perfect (5-minute granularity)
- ✅ **1J**: Werkt perfect (daily data)

### **Wat werkt NIET:**
- ❌ **LIVE**: Speciale update logica werkt niet goed
- ❌ **7D**: Interval=hourly faalt (mogelijk API key issue)
- ❌ **30D**: Interval=hourly faalt (mogelijk API key issue)
- ❌ **ALLES**: Mogelijk rate limit of data issue

### **Huidige Problemen:**
1. **API Key niet gebruikt**: Code gebruikt `useApiKey = false` (free tier)
2. **Directe fetch calls**: Geen type safety, moeilijke error handling
3. **Geen MCP integratie**: Mist AI-native approach
4. **Interval issues**: Hourly interval werkt niet met free tier

---

## 🚀 VOORSTEL: SDK + MCP INTEGRATIE

### **FASE 1: COINGECKO SDK IMPLEMENTATIE** 📦

**Doel**: Vervang directe fetch calls met officiële SDK voor betere type safety en error handling

**Voordelen**:
- ✅ Volledige TypeScript type safety
- ✅ Automatische retries (2x default)
- ✅ Betere error handling (APIError subclasses)
- ✅ Timeout handling (1 min default)
- ✅ Logging support
- ✅ Rate limit detection

**Implementatie**:

1. **Create CoinGecko Client Service** (`lib/coingecko-sdk-service.ts`):
```typescript
import Coingecko from '@coingecko/coingecko-typescript';
import { logger } from '@/lib/logger';

let coingeckoClient: Coingecko | null = null;

export function getCoinGeckoClient(): Coingecko {
  if (!coingeckoClient) {
    const apiKey = process.env.COINGECKO_API_KEY?.trim();
    
    // ✅ Use Demo API key format (CG-xxx)
    // Check if key starts with 'CG-' for demo tier
    const isDemoKey = apiKey?.startsWith('CG-');
    
    coingeckoClient = new Coingecko({
      // ✅ Use demoAPIKey for CG-xxx keys, proAPIKey for others
      ...(isDemoKey 
        ? { demoAPIKey: apiKey, environment: 'demo' }
        : { proAPIKey: apiKey, environment: 'pro' }
      ),
      logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
      timeout: 30 * 1000, // 30 seconds
      maxRetries: 2, // Default retries
    });
    
    logger.log(`🦎 [CoinGecko SDK] Client initialized`, {
      hasApiKey: !!apiKey,
      keyType: isDemoKey ? 'demo' : 'pro',
      environment: isDemoKey ? 'demo' : 'pro',
    });
  }
  
  return coingeckoClient;
}
```

2. **Update Price History API Route** (`app/api/price-history/route.ts`):
```typescript
import { getCoinGeckoClient } from '@/lib/coingecko-sdk-service';

export async function GET(request: Request) {
  // ... existing code for params ...
  
  const client = getCoinGeckoClient();
  
  // ✅ Use SDK for market chart
  try {
    const marketChartParams: Coingecko.Coins.MarketChartGetParams = {
      id: coinGeckoId,
      vs_currency: 'usd',
      days: days.toString(),
      ...(interval ? { interval } : {}), // Only add if not null
    };
    
    logger.log(`[Price History API] 📡 SDK call`, {
      coinGeckoId,
      days,
      interval: interval || 'null (auto)',
      params: marketChartParams,
    });
    
    const data = await client.coins.marketChart.get(marketChartParams);
    
    // ✅ SDK returns typed response
    // data.prices is Array<[number, number]> (timestamp, price)
    // data.market_caps is Array<[number, number]>
    // data.total_volumes is Array<[number, number]>
    
    const prices = data.prices
      .filter(([timestamp, price]) => 
        timestamp && price && price > 0 && !isNaN(price) && !isNaN(timestamp)
      )
      .map(([timestamp, price]) => ({
        timestamp: timestamp,
        price: price,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return NextResponse.json({
      prices,
      success: true,
      source: 'CoinGecko SDK',
      coinGeckoId,
    });
    
  } catch (error: any) {
    // ✅ SDK provides typed errors
    if (error instanceof Coingecko.APIError) {
      logger.error(`[Price History API] ❌ SDK API Error`, {
        status: error.status,
        name: error.name,
        message: error.message,
        coinGeckoId,
        days,
        interval,
      });
      
      if (error.status === 429) {
        return NextResponse.json(
          { prices: [], success: false, error: 'Rate limited - please try again in a moment' },
          { status: 200 }
        );
      }
      
      if (error.status === 404) {
        return NextResponse.json(
          { prices: [], success: false, error: 'Token not found on CoinGecko' },
          { status: 200 }
        );
      }
    }
    
    // Re-throw for generic error handling
    throw error;
  }
}
```

3. **Update Environment Variables**:
```bash
# .env.local (voor lokale development)
COINGECKO_API_KEY=CG-2zNxDeFXb8KJ2DSnpWMdKi7z

# Vercel Environment Variables
# Key: COINGECKO_API_KEY
# Value: CG-2zNxDeFXb8KJ2DSnpWMdKi7z
# Environment: Production, Preview, Development
```

**Files te wijzigen**:
- ✅ `lib/coingecko-sdk-service.ts` - **NIEUW**: SDK client service
- ✅ `app/api/price-history/route.ts` - Update naar SDK calls
- ✅ `.env.example` - Document COINGECKO_API_KEY

---

### **FASE 2: COINGECKO MCP SERVER INTEGRATIE** 🤖

**Doel**: Gebruik CoinGecko MCP server voor AI-native data access

**Voordelen**:
- ✅ AI-native approach
- ✅ Betere error handling
- ✅ Geoptimaliseerde queries
- ✅ Real-time data streams (SSE)

**MCP Server Endpoints**:
- **Public**: `https://mcp.api.coingecko.com/mcp` (geen API key)
- **Pro**: `https://mcp.pro-api.coingecko.com/mcp` (met API key)

**Implementatie**:

1. **MCP Server Connection** (`lib/coingecko-mcp-service.ts`):
```typescript
import { logger } from '@/lib/logger';

interface MCPMarketChartParams {
  coinId: string;
  vsCurrency: string;
  days: number;
  interval?: 'hourly' | 'daily' | null;
}

export async function fetchMarketChartViaMCP(
  params: MCPMarketChartParams
): Promise<{ prices: Array<[number, number]> }> {
  const apiKey = process.env.COINGECKO_API_KEY?.trim();
  const isDemoKey = apiKey?.startsWith('CG-');
  
  // ✅ Use Pro MCP server with API key, or public without
  const mcpUrl = apiKey && !isDemoKey
    ? 'https://mcp.pro-api.coingecko.com/mcp'
    : 'https://mcp.api.coingecko.com/mcp';
  
  logger.log(`🦎 [CoinGecko MCP] Fetching market chart`, {
    coinId: params.coinId,
    days: params.days,
    interval: params.interval || 'null',
    mcpUrl,
    hasApiKey: !!apiKey,
  });
  
  // ✅ MCP server uses HTTP Streaming or SSE
  // For now, we'll use HTTP POST with JSON-RPC-like format
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      method: 'coin_market_chart_by_id',
      params: {
        id: params.coinId,
        vs_currency: params.vsCurrency,
        days: params.days,
        ...(params.interval ? { interval: params.interval } : {}),
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error(`MCP server error: ${response.status}`);
  }
  
  const data = await response.json();
  return data;
}
```

2. **Hybrid Approach**:
```typescript
// ✅ Try MCP first, fallback to SDK
export async function getMarketChartHybrid(
  coinId: string,
  days: number,
  interval?: string | null
) {
  try {
    // Try MCP first
    const mcpData = await fetchMarketChartViaMCP({
      coinId,
      vsCurrency: 'usd',
      days,
      interval: interval as 'hourly' | 'daily' | null,
    });
    return { prices: mcpData.prices, source: 'MCP' };
  } catch (mcpError) {
    logger.warn(`[CoinGecko] MCP failed, falling back to SDK`, { error: mcpError });
    
    // Fallback to SDK
    const client = getCoinGeckoClient();
    const data = await client.coins.marketChart.get({
      id: coinId,
      vs_currency: 'usd',
      days: days.toString(),
      ...(interval ? { interval } : {}),
    });
    return { prices: data.prices, source: 'SDK' };
  }
}
```

**Files te wijzigen**:
- ✅ `lib/coingecko-mcp-service.ts` - **NIEUW**: MCP server service
- ✅ `app/api/price-history/route.ts` - Integreer MCP als primary, SDK als fallback

---

### **FASE 3: INTERVAL & TIMEFRAME FIXES** ⚙️

**Doel**: Fix alle interval issues met betaalde API key

**Fixes**:

1. **LIVE Mode**:
```typescript
// ✅ LIVE: Use days=1 with interval=null (5-minute auto)
// Update only last data point, not full history
if (selectedTimeframe === 'LIVE') {
  const data = await getMarketChartHybrid(coinGeckoId, 1, null);
  // Use last 60 points (last hour of 5-minute data)
  const liveData = data.prices.slice(-60);
  return liveData;
}
```

2. **7D & 30D (Hourly)**:
```typescript
// ✅ 7D & 30D: Use interval='hourly' with paid API key
// Paid tier supports hourly interval
if (days >= 2 && days <= 90) {
  const data = await getMarketChartHybrid(coinGeckoId, days, 'hourly');
  return data.prices;
}
```

3. **ALLES (365 days)**:
```typescript
// ✅ ALLES: Use interval='daily' for max data
if (days > 90) {
  const data = await getMarketChartHybrid(coinGeckoId, days, 'daily');
  return data.prices;
}
```

**Files te wijzigen**:
- ✅ `app/api/price-history/route.ts` - Fix interval logic
- ✅ `components/TokenPriceChart.tsx` - Fix LIVE mode logic

---

## 📋 IMPLEMENTATIE PLAN

### **STAP 1: SDK Setup** (15 min)
1. ✅ SDK al geïnstalleerd (`@coingecko/coingecko-typescript`)
2. Create `lib/coingecko-sdk-service.ts`
3. Update `app/api/price-history/route.ts` naar SDK
4. Test met API key

### **STAP 2: MCP Server Integration** (20 min)
1. Create `lib/coingecko-mcp-service.ts`
2. Implement MCP connection
3. Test MCP vs SDK
4. Implement hybrid approach

### **STAP 3: Interval Fixes** (15 min)
1. Fix LIVE mode (days=1, interval=null)
2. Fix 7D/30D (interval=hourly)
3. Fix ALLES (interval=daily)
4. Test alle timeframes

### **STAP 4: API Key Integration** (10 min)
1. Add `COINGECKO_API_KEY` to Vercel env vars
2. Update `.env.local` voor lokale dev
3. Test met betaalde key
4. Verify rate limits

### **STAP 5: Testing & Validation** (15 min)
1. Test alle timeframes met ETH
2. Test met andere tokens (BTC, SOL, etc.)
3. Verify data quality
4. Check error handling

**Totaal tijd**: ~75 minuten

---

## 🎯 VERWACHT RESULTAAT

Na implementatie:
- ✅ **LIVE**: Real-time price updates (1 seconde refresh, 5-minute data)
- ✅ **1D**: 5-minute granularity (288 points) - **WERKT AL**
- ✅ **7D**: Hourly data (~168 points) - **FIXED**
- ✅ **30D**: Hourly data (~720 points) - **FIXED**
- ✅ **1J**: Daily data (~365 points) - **WERKT AL**
- ✅ **ALLES**: Daily data (max available) - **FIXED**

---

## 🔧 TECHNISCHE DETAILS

### **CoinGecko SDK Methods**:
```typescript
// Market Chart
client.coins.marketChart.get({
  id: 'ethereum',
  vs_currency: 'usd',
  days: '7',
  interval: 'hourly', // Optional: 'hourly' | 'daily' | null
});

// Simple Price
client.simple.price.get({
  ids: 'bitcoin,ethereum',
  vs_currencies: 'usd',
  include_24hr_change: true,
});

// Coin by ID
client.coins.id.get({
  id: 'ethereum',
  localization: false,
  tickers: false,
  market_data: true,
});
```

### **API Key Format**:
- **Demo Key**: `CG-xxx` → Use `demoAPIKey` + `environment: 'demo'`
- **Pro Key**: `xxx` → Use `proAPIKey` + `environment: 'pro'`

### **Interval Rules** (met betaalde key):
- `days=1`: `interval=null` → 5-minute data (auto)
- `days=2-90`: `interval='hourly'` → Hourly data ✅ **NU MOGELIJK**
- `days>90`: `interval='daily'` → Daily data

### **MCP Server**:
- **Public**: `https://mcp.api.coingecko.com/mcp` (rate limited)
- **Pro**: `https://mcp.pro-api.coingecko.com/mcp` (met API key)
- **Protocol**: HTTP Streaming of SSE
- **Format**: JSON-RPC-like

---

## ✅ VOORDELEN VAN DIT VOORSTEL

1. **Type Safety**: Volledige TypeScript types van SDK
2. **Error Handling**: Typed errors (APIError subclasses)
3. **Retries**: Automatische retries bij failures
4. **API Key**: Betaalde key wordt correct gebruikt
5. **MCP Integration**: AI-native approach voor toekomst
6. **Hybrid**: MCP primary, SDK fallback
7. **Backward Compatible**: Geen breaking changes
8. **Better Logging**: SDK logging support

---

## 🚨 RISICO'S & MITIGATIE

1. **MCP Server niet beschikbaar**:
   - ✅ Mitigatie: SDK als fallback
   - ✅ Hybrid approach zorgt voor redundancy

2. **API Key format issue**:
   - ✅ Mitigatie: Check `CG-` prefix voor demo key
   - ✅ Support beide formats

3. **Rate limits**:
   - ✅ Mitigatie: SDK heeft automatische retries
   - ✅ Logging voor monitoring

4. **Breaking changes**:
   - ✅ Mitigatie: Stap-voor-stap implementatie
   - ✅ Test elke fase apart

---

**Klaar voor implementatie?** Wacht op goedkeuring van gebruiker.

