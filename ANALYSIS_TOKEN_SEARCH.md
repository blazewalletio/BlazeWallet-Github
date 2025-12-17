# 🔍 Token Search Analysis: Blaze Wallet vs MetaMask

## Probleem
Bij zoeken op "USDT" krijgen gebruikers **163 resultaten**, waarvan veel duplicaten/spam tokens. Dit maakt het moeilijk om de juiste token te vinden.

## MetaMask Aanpak (Analyse)
**Wat MetaMask doet:**
1. **Kwaliteitsfiltering**: Toont alleen tokens met:
   - Hoge liquidity (>$10k)
   - OF hoge volume (>$5k)
   - OF verified + established
2. **Deduplicatie**: Per symbol toont alleen de **beste** token (hoogste liquidity/volume)
3. **Beperkte resultaten**: ~7-10 relevante tokens
4. **Smart ranking**: 
   - Officiële tokens eerst (USDT, USDC)
   - Portal/bridge tokens (USDTet, USDCet)
   - Rest daarna

**Resultaat**: Gebruiker ziet direct de relevante tokens, geen spam.

## Onze Huidige Aanpak
**Wat we nu doen:**
1. **Geen filtering**: Alle tokens die matchen worden getoond
2. **Geen deduplicatie**: 109 verschillende USDT tokens worden allemaal getoond
3. **200 resultaten**: Te veel voor gebruiker
4. **Ranking**: Goed, maar niet genoeg filtering

**Resultaat**: 163 resultaten, veel spam, gebruiker moet veel scrollen.

## Aanbevolen Oplossing

### 1. **Kwaliteitsfiltering (Database)**
Filter tokens op basis van:
- `liquidity_usd > 10000` (minimaal $10k liquidity)
- OF `volume_24h_usd > 5000` (minimaal $5k volume)
- OF `is_verified = true AND is_popular = true` (officiële tokens)

Dit filtert ~90% van spam tokens weg.

### 2. **Deduplicatie per Symbol**
Voor tokens met dezelfde symbol:
- Groepeer alle tokens met identieke symbol
- Toon alleen de **beste** (hoogste liquidity, dan volume, dan verified)
- Dit reduceert 109 USDT tokens naar 1-3 beste

### 3. **Beperkte Top Resultaten**
- Eerste **20-30** topkwaliteit tokens
- Optioneel: "Show more" knop voor rest (als gebruiker echt alle tokens wil zien)

### 4. **Verbeterde Ranking**
1. Exact symbol match + hoge liquidity = **TOP**
2. Portal/bridge tokens (USDTet, USDCet) = **HOOG**
3. Verified + popular = **MIDDEL**
4. Rest = **LAAG**

## Implementatie Plan

### Database (search_tokens functie):
```sql
WHERE 
  tr.chain_key = p_chain_key
  AND (
    -- Search match
    tr.search_vector @@ plainto_tsquery('english', p_query) OR ...
  )
  AND (
    -- Quality filter: only show tokens with liquidity/volume OR verified+popular
    tr.liquidity_usd > 10000 
    OR tr.volume_24h_usd > 5000
    OR (tr.is_verified = true AND tr.is_popular = true)
  )
ORDER BY ... (existing ranking)
LIMIT 30  -- Reduced from 200
```

### Frontend (deduplication):
```typescript
// Group by symbol, keep only best
const deduplicated = new Map();
searchResults.forEach(token => {
  const key = token.symbol.toUpperCase();
  const existing = deduplicated.get(key);
  
  if (!existing || isBetterToken(token, existing)) {
    deduplicated.set(key, token);
  }
});

function isBetterToken(a, b) {
  // Compare: liquidity > volume > verified > popular
  if (a._liquidityUsd > b._liquidityUsd) return true;
  if (a._volume24hUsd > b._volume24hUsd) return true;
  if (a._isVerified && !b._isVerified) return true;
  if (a._isPopular && !b._isPopular) return true;
  return false;
}
```

## Voordelen
✅ **Minder resultaten**: 163 → ~10-20 relevante tokens
✅ **Geen spam**: Alleen tokens met echte liquidity/volume
✅ **Geen duplicaten**: 1 beste token per symbol
✅ **Betere UX**: Gebruiker vindt direct wat hij zoekt
✅ **Sneller**: Minder data om te renderen

## Nadelen
⚠️ **Mogelijk tokens missen**: Zeer nieuwe tokens zonder liquidity worden niet getoond
   - **Oplossing**: "Show all" toggle voor power users

## Conclusie
**MetaMask's aanpak is beter** voor UX. We moeten:
1. Kwaliteitsfiltering toevoegen (liquidity/volume thresholds)
2. Deduplicatie implementeren (beste token per symbol)
3. Limit verlagen (200 → 30)
4. Optioneel: "Show all" toggle voor edge cases

Dit geeft gebruikers **direct relevante resultaten** zonder spam.

