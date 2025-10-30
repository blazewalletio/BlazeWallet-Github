# 🐛 PROBLEEM DIAGNOSE: USD waarde en Transaction Logos

## Datum: 30 Oktober 2025

---

## ❌ PROBLEEM 1: USD Waarde wordt niet getoond

**Status:** ⚠️ WAARSCHIJNLIJK GEEN BUG - Mogelijk price = 0

**Locatie:** `components/Dashboard.tsx` lijn 405-422

**Huidige Code:**
```typescript
const tokensWithPrices = await Promise.all(
  erc20Tokens.map(async (token: any) => {
    const price = tokenPrices[token.symbol] || 0; // ← Price is 0?
    const balanceNum = parseFloat(token.balance || '0');
    const balanceUSD = balanceNum * price;
    
    return {
      ...token,
      priceUSD: price,
      balanceUSD: balanceUSD.toFixed(2), // ← Correct toegevoegd!
      change24h,
      isNative: false,
    };
  })
);
```

**Analyse:**
- Code is correct ✅
- `balanceUSD` wordt berekend en toegevoegd ✅
- UI toont `${token.balanceUSD}` correct ✅

**Mogelijke oorzaak:**
- CoinGecko/Binance API heeft geen price data voor sommige tokens
- Alternatief nodig: gebruik Alchemy price data of DexScreener

---

## ❌ PROBLEEM 2: Transaction History toont ETH logo voor ERC20

**Status:** 🐛 BEVESTIGDE BUG

**Locatie:** `lib/alchemy-service.ts` lijn 250-259

**Huidige Code:**
```typescript
private getTokenLogo(tx: any): string | null {
  // Check if it's native currency
  if (tx.category === 'external' || tx.asset === 'ETH') {
    return '/crypto-eth.png';
  }
  
  // For now, return null and let frontend handle with placeholder
  // Could be enhanced with token list lookup
  return null; // ❌ PROBLEEM: Geeft null voor alle ERC20!
}
```

**Analyse:**
- Alchemy `getAssetTransfers()` geeft GEEN logo mee in response
- Alleen `rawContract.address` beschikbaar
- Moet logo opzoeken via token contract address

**Mogelijke oplossingen:**

### Optie A: Token Registry Cache
```typescript
private tokenLogoCache: Map<string, string> = new Map();

setTokens(tokens: any[]) {
  // Cache logos van alle tokens
  tokens.forEach(token => {
    this.tokenLogoCache.set(token.address.toLowerCase(), token.logo);
  });
}

private getTokenLogo(tx: any): string | null {
  if (tx.category === 'external') {
    return '/crypto-eth.png';
  }
  
  // Lookup logo from cache
  const address = tx.rawContract?.address?.toLowerCase();
  if (address) {
    return this.tokenLogoCache.get(address) || '/crypto-placeholder.png';
  }
  
  return '/crypto-placeholder.png';
}
```

### Optie B: On-Demand Metadata Lookup
```typescript
async getTokenLogo(tx: any): Promise<string | null> {
  if (tx.category === 'external') {
    return '/crypto-eth.png';
  }
  
  const address = tx.rawContract?.address;
  if (address) {
    try {
      const metadata = await this.alchemy.core.getTokenMetadata(address);
      return metadata.logo || '/crypto-placeholder.png';
    } catch {
      return '/crypto-placeholder.png';
    }
  }
  
  return '/crypto-placeholder.png';
}
```

### Optie C: Gebruik Alchemy getNFTMetadata (voor NFTs) + fallback
Niet relevant voor ERC20

---

## 🎯 AANBEVOLEN FIX:

**Voor Probleem 1:**
1. Check console logs voor price data
2. Als price = 0 voor tokens, voeg DexScreener lookup toe
3. Of gebruik Alchemy's eigen price API (indien beschikbaar)

**Voor Probleem 2:**
1. Gebruik **Optie B** (On-Demand Lookup) voor nu
2. Later optimaliseren met **Optie A** (Cache) voor performance
3. Update `getFullTransactionHistory()` om async logo lookup te doen

---

## 📝 IMPLEMENTATIE PLAN:

### Fase 1: Fix Transaction Logos (Prioriteit 1)
```typescript
// Update AlchemyService.getFullTransactionHistory()
// Map transactions met async logo lookup
```

### Fase 2: Verify USD Values (Prioriteit 2)
```typescript
// Add debug logging
console.log('Price for', token.symbol, ':', price);
console.log('BalanceUSD:', balanceUSD);
```

### Fase 3: Optimize met Cache (Later)
```typescript
// Implement token logo cache
// Update logos from getAllTokenBalances()
```

---

## 🧪 TEST SCENARIO:

1. **Switch naar Ethereum chain**
2. **Check Console:** 
   - Zie "Fetching prices for: USDT, USDC, PENDLE"
   - Zie "PENDLE: 0.5 × $0 = $0.00" ← HIER IS HET PROBLEEM
3. **Check Assets:**
   - Zie je Pendle logo? JA ✅
   - Zie je USD waarde? NEE ❌ (want price = 0)
4. **Check History:**
   - Zie je ETH logo voor Pendle tx? JA ❌
   - Zou Pendle logo moeten zijn

---

## ✅ VOLGENDE STAPPEN:

1. Implementeer async logo lookup in transaction history
2. Add debug logging voor price data
3. Test met Pendle token specifiek
4. Deploy en verify


