# Grondige Analyse: Balance Berekening per Chain

**Datum:** 30 oktober 2025  
**Probleem:** Solana chain toont een te hoog saldo in de Assets sectie  
**Status:** Analyse voltooid - Fix voorgesteld

---

## 🔍 Executive Summary

Na grondig onderzoek van de console logs en code heb ik **DRIE kritieke problemen** gevonden:

### Probleem 1: OUDE CODE DRAAIT NOG IN PRODUCTIE ❌
De console log toont dat de oude code nog draait:
- Symbol-based price fetching voor ERC20 tokens (in plaats van address-based)
- Geen singleton pattern (excessive AlchemyService instantiaties)
- PENDLE price fetching faalt door symbol-based API

### Probleem 2: MOGELIJKE SOLANA DOUBLE-COUNTING ⚠️
Er is een risico dat SPL tokens met price $0 nog steeds geteld worden in het totaal.

### Probleem 3: FAILED PRICE FETCHING VOOR SOLANA SPL TOKENS 🔴
Symbol-based price fetching faalt voor meme tokens zoals NPCS en ai16z.

---

## 📊 Console Log Analyse

### Wat de log vertelt (Ethereum chain):

```
STEP 3: Fetch Token Balances (EVM)
✅ Alchemy found 1 ERC20 tokens with balance

STEP 4: Fetch Token Prices
📡 Fetching prices for: PENDLE    ← ❌ OUDE CODE! Zou moeten zijn: "Fetching prices for 1 addresses..."

/api/prices?symbols=PENDLE: 400 (Bad Request)
/api/prices-binance?symbols=PENDLE: 400 (Bad Request)
❌ All APIs failed for PENDLE
⚠️ No price data for PENDLE! Balance: 0.559280, Address: 0x808507121b80c02388fad14726482e061b8da827
```

### Conclusie:
**De nieuw geïmplementeerde code draait NIET in productie!** De singleton pattern en address-based price fetching zijn nog niet gedeployed.

---

## 🧮 Hoe Balance Berekening NU werkt

### ETHEREUM (EVM Chains):

```typescript
// STEP 1: Fetch native balance
const bal = await blockchain.getBalance(displayAddress);  // bijv. "0.0" ETH

// STEP 2: Fetch prices (batch)
const pricesMap = await priceService.getMultiplePrices(['ETH', 'USDT', 'USDC', ...]);

// STEP 3: Fetch ERC20 tokens via Alchemy
const erc20Tokens = await blockchain.getERC20TokenBalances(displayAddress);
// Geeft: [{ symbol: 'PENDLE', balance: '0.559280', address: '0x808...' }]

// STEP 4: Enrich met USD prices (NIEUWE CODE - NIET IN PRODUCTIE)
const pricesByAddress = await priceService.getPricesByAddresses(tokenAddresses, 'ethereum');

// STEP 5: Calculate total
const nativeValueUSD = parseFloat(bal) * nativePrice;  // 0.0 * $3895 = $0
const tokensTotalUSD = tokens.reduce((sum, t) => sum + parseFloat(t.balanceUSD), 0);
const totalValue = nativeValueUSD + tokensTotalUSD;
```

**✅ GEEN DOUBLE-COUNTING RISICO** voor Ethereum: Native balance en ERC20 tokens zijn volledig gescheiden.

---

### SOLANA:

```typescript
// STEP 1: Fetch native SOL balance
const bal = await blockchain.getBalance(displayAddress);  // bijv. "0.5" SOL

// STEP 2: Fetch prices (batch)
const pricesMap = await priceService.getMultiplePrices(['SOL']);

// STEP 3: Fetch SPL tokens
const splTokens = await solanaService.getSPLTokenBalances(displayAddress);
// ↓
// getSPLTokenAccounts() → Fetch TOKEN_PROGRAM_ID + TOKEN_2022_PROGRAM_ID
// ↓
// Filter: non-zero balance ONLY
// ↓
// Geeft: [
//   { symbol: 'NPCS', balance: '100', address: 'mint123...' },
//   { symbol: 'ai16z', balance: '50', address: 'mint456...' }
// ]

// STEP 4: Fetch SPL token prices (SYMBOL-BASED - PROBLEMATISCH!)
const splPricesMap = await priceService.getMultiplePrices(['NPCS', 'ai16z']);
// ❌ FAALT voor meme tokens! CoinGecko/Binance kennen deze symbols niet.

// Als fallback: DexScreener via mint address
const mintPrices = await priceService.getPricesByMints([...]);

// STEP 5: Calculate total
const nativeValueUSD = parseFloat(bal) * nativePrice;  // 0.5 * $150 = $75
const tokensTotalUSD = tokens.reduce((sum, t) => sum + parseFloat(t.balanceUSD), 0);
const totalValue = nativeValueUSD + tokensTotalUSD;
```

---

## 🔴 GEVONDEN PROBLEMEN

### Probleem A: Solana Price Fetching Faalt
**Symptoom:** SPL tokens krijgen price = $0  
**Oorzaak:** Symbol-based API ondersteunt meme tokens niet  
**Gevolg:** Totale balance kan incorrect zijn als deze tokens NIET goed gefilterd worden

**Code Locatie:** `Dashboard.tsx`, regel 296-297

```typescript
const splPricesMap = await priceService.getMultiplePrices(splSymbols);
```

### Probleem B: Possible Double-Counting Scenario
**Hypothese:** Als een SPL token mint het native SOL address zou matchen, zou dit dubbel geteld kunnen worden.  
**Analyse:** Dit is **ONWAARSCHIJNLIJK** omdat:
1. `getSPLTokenAccounts()` haalt alleen SPL token accounts op (niet native SOL)
2. Native SOL heeft geen "token account", het is een balance op de wallet zelf
3. Er is geen overlap tussen `getBalance()` en `getSPLTokenBalances()`

**Conclusie:** GEEN double-counting van native SOL.

### Probleem C: Tokens met Price $0 Nog Steeds Geteld?
**Real Issue:** Als een token `price = 0` heeft maar `balance > 0`, dan:

```typescript
const balanceUSD = balanceNum * price;  // 100 * 0 = 0
```

Dit zou CORRECT moeten zijn! Token heeft geen waarde dus $0 USD.

**MAAR:**  
De console log van de user toont: "De solana chain toont nu een verkeerd (te hoog) saldo"

Dit suggereert dat de totale waarde **TE HOOG** is, niet te laag!

---

## 🎯 ROOT CAUSE ANALYSE

### Hypothese 1: Prijs API geeft verkeerde prijs terug
Als DexScreener of CoinGecko een **foutieve hoge prijs** teruggeeft voor een obscure SPL token:

```
Token: SCAM_TOKEN
Balance: 1,000,000 tokens
Incorrect Price: $0.01 (zou $0.000001 moeten zijn)
↓
Calculated Value: $10,000 ← TE HOOG!
```

### Hypothese 2: Decimals Issue
Als een token `decimals = 9` heeft maar de API dit niet correct interpreteert:

```
Raw balance: 1000000000 (1 token met 9 decimals)
Fout geïnterpreteerd als: 1,000,000,000 tokens
↓
1 miljard tokens × $0.01 = $10,000,000 ← TE HOOG!
```

**Controle in code:**  
`uiAmountString` van Solana corrigeert dit automatisch:

```typescript
return {
  balance: info.parsed?.info?.tokenAmount?.uiAmountString,  // ✅ Correct gecorrigeerd
  decimals: info.parsed?.info?.tokenAmount?.decimals,
};
```

### Hypothese 3: Cached Stale Price Data
Als een oude prijs in de cache zit van toen een token $10 waard was, maar nu $0.01:

```
Token: RUGGED_TOKEN
Cached Price (1 week oud): $10
Actual Price: $0.0001
↓
Balance: 1000 tokens × $10 = $10,000 ← TE HOOG!
```

---

## ✅ VOORGESTELDE FIX

### Fix 1: Deploy de Nieuwe Code naar Productie 🚀
**Actie:** Git commit en deploy naar Vercel

**Wat dit oplost:**
- ✅ Address-based price fetching voor ERC20 (PENDLE werkt weer)
- ✅ Singleton pattern (geen console spam meer)
- ✅ DexScreener fallback voor ontbrekende tokens

### Fix 2: Verbetering Solana Price Fetching 🔧
**Probleem:** Symbol-based price fetching faalt voor SPL tokens

**Oplossing:** Gebruik MINT-based price fetching ALTIJD voor Solana

**Code Change:**

```typescript
// OUDE CODE (Dashboard.tsx, regel 293-297):
const splSymbols = splTokens.map((t: any) => t.symbol);
const splPricesMap = await priceService.getMultiplePrices(splSymbols);

// NIEUWE CODE:
const splMints = splTokens.map((t: any) => t.address);  // Gebruik mint addresses
const splPricesMap = await priceService.getPricesByMints(splMints);  // Direct naar DexScreener
```

### Fix 3: Extra Logging voor Debug 🔍
**Actie:** Voeg gedetailleerde logging toe in Solana balance calculation

```typescript
console.log(`\n💰 [Solana Balance Breakdown]`);
console.log(`Native SOL: ${bal} × $${nativePrice} = $${nativeValueUSD.toFixed(2)}`);

splTokens.forEach((token: any) => {
  console.log(`${token.symbol}: ${token.balance} × $${token.priceUSD} = $${token.balanceUSD}`);
});

console.log(`Total SPL Tokens Value: $${tokensTotalUSD.toFixed(2)}`);
console.log(`Total Portfolio: $${totalValue.toFixed(2)}`);
```

### Fix 4: Sanity Check voor Abnormale Prijzen 🛡️
**Actie:** Voeg een sanity check toe om abnormaal hoge prijzen te detecteren

```typescript
// In Dashboard.tsx, na price fetching:
tokensWithValue = tokensWithValue.map(token => {
  const valueUSD = parseFloat(token.balanceUSD || '0');
  
  // 🛡️ SANITY CHECK: Detecteer verdacht hoge waarden
  if (valueUSD > 100000 && token.priceUSD > 0) {
    console.warn(`⚠️ SUSPICIOUS VALUE DETECTED:`, {
      symbol: token.symbol,
      balance: token.balance,
      priceUSD: token.priceUSD,
      balanceUSD: valueUSD,
      address: token.address
    });
    
    // Optioneel: Cap de waarde of zet op $0
    // return { ...token, balanceUSD: '0.00', priceUSD: 0 };
  }
  
  return token;
});
```

---

## 🧪 TEST PLAN

### Test 1: Ethereum Chain
1. Select Ethereum chain
2. Refresh wallet
3. Controleer console log voor:
   - ✅ "Fetching prices for X addresses..." (NIET "Fetching prices for PENDLE")
   - ✅ PENDLE price wordt succesvol opgehaald
   - ✅ USD value wordt correct getoond

### Test 2: Solana Chain
1. Select Solana chain
2. Refresh wallet
3. Controleer console log voor:
   - ✅ Native SOL balance en prijs
   - ✅ SPL token balances en prijzen
   - ✅ Total portfolio value
4. Vergelijk met verwachte waarde:
   - Check elke SPL token price op DexScreener manually
   - Bereken totaal: (SOL balance × SOL price) + Σ(token balance × token price)
   - Vergelijk met getoonde waarde

### Test 3: Price Cache
1. Refresh wallet (eerste keer)
2. Wacht 5 minuten
3. Refresh wallet (tweede keer)
4. Controleer dat prijzen consistent blijven

---

## 📝 IMPLEMENTATIE PRIORITY

### Priority 1: DEPLOY EXISTING CODE ✅
**Impact:** HOOG  
**Effort:** LAAG (alleen deployen)  
**Fix:** ERC20 prices, console spam, general improvements

### Priority 2: FIX SOLANA PRICE FETCHING ✅
**Impact:** HOOG  
**Effort:** MEDIUM  
**Fix:** SPL token prices worden correct opgehaald

### Priority 3: ADD DEBUG LOGGING ✅
**Impact:** MEDIUM (helpt met troubleshooting)  
**Effort:** LAAG  
**Fix:** Makkelijker om balance issues te detecteren

### Priority 4: ADD SANITY CHECKS ✅
**Impact:** MEDIUM (voorkomt toekomstige issues)  
**Effort:** MEDIUM  
**Fix:** Detecteert abnormale prijzen/waardes

---

## 🎬 VOLGENDE STAPPEN

1. **DEPLOY naar productie** (belangrijkste!)
   ```bash
   git add .
   git commit -m "Fix: Deploy singleton pattern and address-based price fetching"
   git push origin main
   ```

2. **Hard refresh browser** (Cmd+Shift+R op Mac, Ctrl+Shift+R op Windows)
   - Dit cleared de JavaScript cache

3. **Test Ethereum chain first**
   - Verifieer dat PENDLE price nu werkt
   - Check dat console logs correct zijn

4. **Test Solana chain**
   - Check native SOL balance
   - Check SPL token balances
   - Noteer exact welke tokens verkeerde prijzen hebben

5. **Als Solana nog steeds te hoog:**
   - Implementeer Fix 2 (Mint-based price fetching)
   - Implementeer Fix 3 (Debug logging)
   - Share nieuwe console log voor verdere analyse

---

## 💡 CONCLUSIE

De **meest waarschijnlijke oorzaak** van het Solana balance probleem is:

1. **De oude code draait nog** → Deploy nieuwe code
2. **SPL token price fetching faalt** → Gebruik mint-based ipv symbol-based
3. **Mogelijk een specifieke token met abnormale prijs** → Debug logging zal dit onthullen

**Geen double-counting** van native SOL gevonden in de code!

---

**Klaar voor implementatie?**  
Laat me weten of je wilt dat ik:
- A) Deploy de bestaande code naar productie
- B) Eerst Fix 2 implementeren (mint-based price fetching voor Solana)
- C) Eerst extra debug logging toevoegen
- D) Alles tegelijk doen (A + B + C)
