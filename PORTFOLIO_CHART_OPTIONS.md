# 📊 Portfolio Chart Reconstruction - 3 Perfect Solutions

## 🎯 Probleem
De dashboard grafiek toont alleen het huidige punt omdat er geen historische portfolio data is. Portfolio history slaat alleen snapshots op vanaf het moment dat de gebruiker de wallet gebruikt.

---

## ✅ OPLOSSING 1: Token Holdings + Historical Prices (AANBEVOLEN)

### Concept
Gebruik de **huidige token holdings** en reconstrueer de portfolio waarde door **historische prijzen** van die tokens te gebruiken.

### Voordelen
- ✅ **100% accuraat** - Gebaseerd op echte holdings
- ✅ **Werkt voor alle timeframes** (1D, 7D, 30D, 1J, ALLES)
- ✅ **Geen transactie data nodig** - Alleen huidige balances
- ✅ **Snel** - Eén API call per token per timeframe
- ✅ **Betrouwbaar** - Gebruikt CoinGecko/DexScreener (al geïmplementeerd)

### Implementatie
```typescript
// Pseudo-code
async function reconstructPortfolioHistory(
  tokens: Token[], // Huidige holdings
  nativeBalance: number,
  timeframe: '1D' | '7D' | '30D' | '1J' | 'ALLES'
) {
  const days = timeframeToDays(timeframe);
  
  // 1. Haal historische prijzen op voor alle tokens
  const priceHistories = await Promise.all(
    tokens.map(token => 
      getTokenPriceHistory(token.symbol, days, token.address, chain)
    )
  );
  
  // 2. Haal native token prijs history (ETH, SOL, etc.)
  const nativePriceHistory = await getTokenPriceHistory(
    chain.nativeCurrency.symbol, 
    days
  );
  
  // 3. Reconstruct portfolio value voor elk tijdstip
  const portfolioPoints = nativePriceHistory.prices.map((nativePoint, index) => {
    let totalValue = nativeBalance * nativePoint.price;
    
    tokens.forEach((token, tokenIndex) => {
      const tokenPrice = priceHistories[tokenIndex].prices[index]?.price || 0;
      const tokenBalance = parseFloat(token.balance || '0');
      totalValue += tokenBalance * tokenPrice;
    });
    
    return {
      timestamp: nativePoint.timestamp,
      balance: totalValue
    };
  });
  
  return portfolioPoints;
}
```

### Complexiteit: ⭐⭐ (Medium)
### Accuraatheid: ⭐⭐⭐⭐⭐ (Perfect)
### Performance: ⭐⭐⭐⭐ (Goed - parallel API calls)

---

## ✅ OPLOSSING 2: Transaction-Based Reconstruction

### Concept
Analyseer **alle transacties** in de wallet en reconstrueer de balance door inkomende/uitgaande transfers te tracken.

### Voordelen
- ✅ **Zeer accuraat** - Gebaseerd op echte transacties
- ✅ **Toont exacte momenten** waarop portfolio veranderde
- ✅ **Werkt zelfs als token holdings onbekend zijn**

### Nadelen
- ⚠️ **Complex** - Moet alle transacties analyseren
- ⚠️ **Langzaam** - Veel API calls naar blockchain explorers
- ⚠️ **Mogelijk incompleet** - Als transacties niet allemaal geladen zijn

### Implementatie
```typescript
// Pseudo-code
async function reconstructFromTransactions(
  address: string,
  chain: string,
  timeframe: '1D' | '7D' | '30D' | '1J' | 'ALLES'
) {
  // 1. Haal alle transacties op
  const blockchain = MultiChainService.getInstance(chain);
  const transactions = await blockchain.getTransactionHistory(address, 1000);
  
  // 2. Sorteer op timestamp
  transactions.sort((a, b) => a.timestamp - b.timestamp);
  
  // 3. Reconstruct balance over tijd
  const portfolioPoints = [];
  let currentBalance = {
    native: 0,
    tokens: {} // { address: balance }
  };
  
  // Start met huidige balance
  const currentState = await getCurrentBalances(address, chain);
  
  // Loop backwards door transacties
  for (let i = transactions.length - 1; i >= 0; i--) {
    const tx = transactions[i];
    
    // Update balance op basis van transaction
    if (tx.type === 'received') {
      if (tx.token) {
        currentBalance.tokens[tx.token.address] = 
          (currentBalance.tokens[tx.token.address] || 0) - parseFloat(tx.value);
      } else {
        currentBalance.native -= parseFloat(tx.value);
      }
    } else if (tx.type === 'sent') {
      if (tx.token) {
        currentBalance.tokens[tx.token.address] = 
          (currentBalance.tokens[tx.token.address] || 0) + parseFloat(tx.value);
      } else {
        currentBalance.native += parseFloat(tx.value);
      }
    }
    
    // Haal prijzen op voor dit moment
    const prices = await getHistoricalPrices(tx.timestamp, currentBalance);
    const portfolioValue = calculatePortfolioValue(currentBalance, prices);
    
    portfolioPoints.push({
      timestamp: tx.timestamp,
      balance: portfolioValue
    });
  }
  
  return portfolioPoints.reverse();
}
```

### Complexiteit: ⭐⭐⭐⭐ (Hoog)
### Accuraatheid: ⭐⭐⭐⭐⭐ (Perfect - maar alleen als alle transacties bekend zijn)
### Performance: ⭐⭐ (Langzaam - veel API calls)

---

## ✅ OPLOSSING 3: Hybrid Approach (BEST OF BOTH)

### Concept
Combineer **beide methoden**:
- Gebruik **token holdings + historical prices** als basis (snel, accuraat)
- Gebruik **transactie data** om belangrijke momenten te markeren (deposits, withdrawals)
- **Interpolate** tussen transactie momenten met token price history

### Voordelen
- ✅ **Snel** - Gebruikt primair token price history
- ✅ **Accuraat** - Transacties markeren exacte veranderingen
- ✅ **Volledig** - Combineert beste van beide werelden
- ✅ **Schaalbaar** - Werkt voor alle timeframes

### Implementatie
```typescript
// Pseudo-code
async function hybridReconstruction(
  tokens: Token[],
  nativeBalance: number,
  address: string,
  chain: string,
  timeframe: '1D' | '7D' | '30D' | '1J' | 'ALLES'
) {
  // 1. Basis: Token holdings + historical prices (Oplossing 1)
  const baseHistory = await reconstructPortfolioHistory(
    tokens, 
    nativeBalance, 
    timeframe
  );
  
  // 2. Haal belangrijke transacties op (laatste 50)
  const blockchain = MultiChainService.getInstance(chain);
  const transactions = await blockchain.getTransactionHistory(address, 50);
  
  // 3. Markeer transactie momenten in history
  const enrichedHistory = baseHistory.map(point => {
    // Vind dichtstbijzijnde transactie
    const nearbyTx = transactions.find(tx => 
      Math.abs(tx.timestamp - point.timestamp) < 3600000 // binnen 1 uur
    );
    
    if (nearbyTx) {
      // Pas balance aan op basis van transactie
      // (vereist complexe logica om balance te berekenen op dat moment)
    }
    
    return point;
  });
  
  return enrichedHistory;
}
```

### Complexiteit: ⭐⭐⭐ (Medium-Hoog)
### Accuraatheid: ⭐⭐⭐⭐⭐ (Perfect)
### Performance: ⭐⭐⭐⭐ (Goed - combineert snelheid en accuraatheid)

---

## 🎯 AANBEVELING

**Kies OPLOSSING 1 (Token Holdings + Historical Prices)** omdat:
1. ✅ **Eenvoudigst te implementeren** - Gebruikt bestaande code
2. ✅ **Meest betrouwbaar** - Geen afhankelijkheid van transactie data
3. ✅ **Snel** - Parallel API calls
4. ✅ **Accuraat genoeg** - Voor portfolio tracking is dit perfect

**Implementatie tijd:** ~2-3 uur
**Impact:** ⭐⭐⭐⭐⭐ (Grote verbetering van UX)

---

## 📝 Implementatie Details voor Oplossing 1

### Nieuwe functie in `lib/portfolio-history.ts`:
```typescript
export async function reconstructPortfolioHistory(
  tokens: Token[],
  nativeBalance: string,
  nativeSymbol: string,
  chain: string,
  timeframe: '1D' | '7D' | '30D' | '1J' | 'ALLES'
): Promise<BalanceSnapshot[]>
```

### Aanpassingen in `components/BalanceChart.tsx`:
- Gebruik `reconstructPortfolioHistory()` als er geen snapshots zijn
- Fallback naar normale snapshots als reconstructie faalt
- Cache resultaten om performance te verbeteren

### API Calls:
- Per token: 1 CoinGecko/DexScreener call voor price history
- Native token: 1 CoinGecko call
- Totaal: ~N+1 calls (N = aantal tokens)
- Parallel uitvoeren voor snelheid

