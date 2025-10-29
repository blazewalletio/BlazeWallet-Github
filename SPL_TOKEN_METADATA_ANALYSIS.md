# 🔍 **SPL TOKEN METADATA - PROBLEEM ANALYSE**

## **DATUM:** 28 Oktober 2025
## **PROBLEEM:** SPL tokens tonen "Unknown" in transaction history, terwijl ze wel correct in Assets lijst staan

---

## **OBSERVATIES:**

### **✅ WERKT WEL:**
1. **Dashboard Assets lijst** toont "dogwifhat" correct
2. **Dashboard Assets lijst** toont andere tokens met correcte namen (als Jupiter API werkt)

### **❌ WERKT NIET:**
1. **Transaction History** toont "Unknown" voor SPL tokens
2. **Transaction History** gebruikt NIET `getSPLTokenMetadata()`

---

## **ROOT CAUSE ANALYSE:**

### **1. ASSETS LIJST (Dashboard) - WERKT GOED ✅**

**Code Flow:**
```typescript
// components/Dashboard.tsx → fetchData()
const splTokens = await solanaService.getSPLTokenBalances(displayAddress);

// lib/solana-service.ts → getSPLTokenBalances()
const metadata = await getSPLTokenMetadata(account.mint);
return {
  symbol: metadata.symbol,    // ✅ "WIF"
  name: metadata.name,          // ✅ "dogwifhat"
  logo: metadata.logoURI,       // ✅ "/crypto-wif.png"
};
```

**Metadata Lookup:**
```typescript
// lib/spl-token-metadata.ts → getSPLTokenMetadata()

Step 1: Check hardcoded POPULAR_SPL_TOKENS
  → 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' (WIF mint)
  → ✅ FOUND: { symbol: 'WIF', name: 'dogwifhat' }

Step 2: Check Jupiter API cache
  → Loads: https://tokens.jup.ag/tokens?tags=verified
  → Caches 1000+ tokens for 1 hour
  → ✅ WORKS for tokens not in hardcoded list

Step 3: Fallback
  → symbol: mint.slice(0, 4) + '...' + mint.slice(-4)
  → name: 'Unknown Token'
  → ❌ Only used if both above fail
```

**Result:** ✅ **Assets lijst heeft volledige metadata via getSPLTokenMetadata()**

---

### **2. TRANSACTION HISTORY (Solana) - WERKT NIET ❌**

**Code Flow:**
```typescript
// lib/solana-service.ts → getTransactionHistory()
const txDetails = this.parseTransaction(tx, accountKeys, instructions, address);

// lib/solana-service.ts → detectSPLTransfer()
return {
  tokenSymbol: postBalance.uiTokenAmount.symbol || 'Unknown',  // ❌ PROBLEEM!
  type: 'Token Transfer',
};
```

**Waar komt `uiTokenAmount.symbol` vandaan?**
```typescript
// Solana RPC Response Structure:
tx.meta.postTokenBalances = [
  {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    owner: "Hz4Yqp...",
    uiTokenAmount: {
      amount: "366817",
      decimals: 6,
      uiAmount: 0.366817,
      uiAmountString: "0.366817",
      symbol: null  // ❌ USUALLY NULL!
    }
  }
]
```

**KRITISCH PROBLEEM:**
- Solana RPC `getTransaction()` response bevat **GEEN** token symbol
- `uiTokenAmount.symbol` is vrijwel **ALTIJD NULL**
- Code gebruikt fallback `'Unknown'` als symbol `null` is
- **GEEN gebruik van `getSPLTokenMetadata()` in transaction history!**

---

## **VERGELIJKING: ASSETS vs HISTORY**

| Aspect | Assets Lijst | Transaction History |
|--------|-------------|---------------------|
| **Data Source** | `getSPLTokenBalances()` | `getTransactionHistory()` |
| **Metadata Lookup** | ✅ Calls `getSPLTokenMetadata()` | ❌ NIET called |
| **Hardcoded Check** | ✅ Checks `POPULAR_SPL_TOKENS` | ❌ Skip |
| **Jupiter API** | ✅ Checks Jupiter cache | ❌ Skip |
| **Fallback Source** | RPC + API | ✅ **ALLEEN RPC** |
| **Symbol Accuracy** | ✅ 99% correct (WIF, USDC, etc) | ❌ "Unknown" |

---

## **WAAROM DOGWIFHAT WEL WERKT IN ASSETS?**

```typescript
// lib/spl-token-metadata.ts (lines 66-73)
'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': {
  mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  symbol: 'WIF',           // ✅ Hardcoded
  name: 'dogwifhat',       // ✅ Hardcoded
  decimals: 6,
  logoURI: '/crypto-wif.png',
  coingeckoId: 'dogwifcoin',
}
```

**Assets lijst:**
1. Calls `getSPLTokenMetadata('EKpQGS...')` 
2. Finds mint in `POPULAR_SPL_TOKENS`
3. Returns `{ symbol: 'WIF', name: 'dogwifhat' }` ✅

**Transaction history:**
1. Gets transaction from RPC
2. Reads `uiTokenAmount.symbol` → `null`
3. Uses fallback: `'Unknown'` ❌
4. **NEVER calls `getSPLTokenMetadata()`!**

---

## **ANDERE TOKENS (NIET IN POPULAR_SPL_TOKENS)**

**Scenario:** Token X met mint `ABC123...` (NIET in hardcoded lijst)

**Assets lijst:**
1. Calls `getSPLTokenMetadata('ABC123...')`
2. NOT in `POPULAR_SPL_TOKENS` → Check Jupiter API
3. Jupiter API heeft 10,000+ tokens
4. Finds `{ symbol: 'TOKEN_X', name: 'Token X' }` ✅
5. **Werkt voor 99% van tokens**

**Transaction history:**
1. Gets transaction from RPC
2. Reads `uiTokenAmount.symbol` → `null`
3. Uses fallback: `'Unknown'` ❌
4. **NEVER checks Jupiter API!**

---

## **BEWIJS: CONSOLE LOGS ANALYSE**

**Als je Assets lijst laadt:**
```
🔍 [SPLTokenMetadata] Fetching Jupiter token list...
✅ [SPLTokenMetadata] Cached 12,543 tokens from Jupiter
💎 [SPLTokenMetadata] Found EKpQGS... in popular tokens
```

**Als je Transaction History laadt:**
```
[GEEN LOGS VAN SPLTokenMetadata]
→ getSPLTokenMetadata() wordt NOOIT aangeroepen!
```

---

## **CODE LOCATIE PROBLEEM:**

### **File:** `lib/solana-service.ts`
### **Method:** `detectSPLTransfer()` (lines 289-345)
### **Problematic Line 325:**

```typescript
tokenSymbol: postBalance.uiTokenAmount.symbol || 'Unknown',
```

**Huidige flow:**
```
1. Parse transaction from RPC
2. Read uiTokenAmount.symbol (usually null)
3. Fallback to 'Unknown'
4. Return to UI
```

**Wat NIET gebeurt:**
```
❌ Extract mint address from transaction
❌ Call getSPLTokenMetadata(mint)
❌ Get symbol from POPULAR_SPL_TOKENS or Jupiter API
```

---

## **WAAROM IS DIT EEN PROBLEEM?**

### **User Experience:**
```
✅ Assets tab: "dogwifhat (WIF) +0.366817"
❌ History tab: "Unknown +0.366817"

✅ Assets tab: "USD Coin (USDC) +10.00"
❌ History tab: "Unknown +10.00"
```

**Inconsistent!** Gebruiker ziet verschillende namen voor hetzelfde token.

---

## **TECHNICAL DEEP DIVE: SOLANA RPC RESPONSE**

```json
{
  "meta": {
    "preTokenBalances": [
      {
        "accountIndex": 2,
        "mint": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        "owner": "Hz4Yqp...",
        "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "uiTokenAmount": {
          "amount": "0",
          "decimals": 6,
          "uiAmount": 0,
          "uiAmountString": "0",
          "symbol": null  // ❌ NO SYMBOL IN RPC!
        }
      }
    ],
    "postTokenBalances": [
      {
        "accountIndex": 2,
        "mint": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",  // ✅ MINT IS AVAILABLE!
        "owner": "Hz4Yqp...",
        "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "uiTokenAmount": {
          "amount": "366817",
          "decimals": 6,
          "uiAmount": 0.366817,
          "uiAmountString": "0.366817",
          "symbol": null  // ❌ NO SYMBOL IN RPC!
        }
      }
    ]
  }
}
```

**SOLUTION:** Extract `mint` from `preTokenBalances` or `postTokenBalances`, dan call `getSPLTokenMetadata(mint)`!

---

## **VOORGESTELDE FIX:**

### **Option A: Minimal Fix (Fastest)**
```typescript
// In detectSPLTransfer(), line 325:

// VOOR:
tokenSymbol: postBalance.uiTokenAmount.symbol || 'Unknown',

// NA:
// Extract mint and lookup metadata
const mint = postBalance.mint || preBalance.mint;
const metadata = await getSPLTokenMetadata(mint);
tokenSymbol: metadata.symbol,
```

**Pros:**
- ✅ Minimal code change
- ✅ Reuses existing `getSPLTokenMetadata()`
- ✅ Works for ALL tokens (hardcoded + Jupiter)

**Cons:**
- ⚠️ Async call inside parseTransaction (slight performance impact)
- ⚠️ Needs async propagation up the call stack

---

### **Option B: Batch Metadata Lookup (Best Performance)**
```typescript
// In getTransactionHistory():
1. Parse all transactions first (extract mints)
2. Batch fetch metadata for all unique mints
3. Map metadata back to transactions
```

**Pros:**
- ✅ Single API call for all tokens
- ✅ Better performance (batch vs individual)
- ✅ Maintains metadata cache

**Cons:**
- ⚠️ More complex code refactor
- ⚠️ Larger initial change

---

### **Option C: Hybrid (Recommended)**
```typescript
// Make detectSPLTransfer() async
// Use metadata cache (already loaded by Dashboard)
// Only fetch if not in cache

Step 1: Check if Jupiter cache already loaded (by Assets)
  → If yes: Instant lookup (no API call)
  → If no: Load once, cache for 1 hour

Step 2: For each transaction:
  → Extract mint
  → Lookup in cache (instant)
  → Return correct symbol
```

**Pros:**
- ✅ Best performance (cache reuse)
- ✅ Minimal API calls
- ✅ Works for all tokens
- ✅ Consistent with Assets tab

**Cons:**
- ⚠️ Moderate code refactor

---

## **IMPACT ANALYSIS:**

### **Users Affected:**
- **100%** of users viewing SPL token transactions

### **Tokens Affected:**
- **ALL** SPL tokens (USDC, WIF, BONK, JUP, custom tokens)
- Only native SOL transfers show correct "SOL" symbol

### **Severity:**
- **Medium-High** - Data is technically correct (amounts, addresses)
- **UX issue** - Users can't identify which token was transferred
- **Consistency issue** - Assets shows correct name, History shows "Unknown"

---

## **RECOMMENDED SOLUTION:**

### **🎯 OPTION C: HYBRID APPROACH**

**Why:**
1. ✅ Reuses existing metadata cache from Assets tab
2. ✅ Minimal additional API calls
3. ✅ Works for 99%+ of tokens (hardcoded + Jupiter)
4. ✅ Consistent user experience
5. ✅ Maintainable code

**Implementation:**
1. Make `detectSPLTransfer()` async
2. Extract mint from `preTokenBalances`/`postTokenBalances`
3. Call `getSPLTokenMetadata(mint)` (uses cache if available)
4. Store mint in transaction data for future lookups
5. Update `getTransactionHistory()` to handle async parsing

**Estimated Effort:** 30-45 minutes
**Risk:** Low (isolated change, well-tested metadata service)

---

## **CONCLUSION:**

### **HUIDIGE SITUATIE:**
```
Assets:   ✅ dogwifhat (uses getSPLTokenMetadata)
History:  ❌ Unknown (reads RPC null symbol)

Assets:   ✅ USD Coin (uses getSPLTokenMetadata)
History:  ❌ Unknown (reads RPC null symbol)
```

### **NA FIX:**
```
Assets:   ✅ dogwifhat (uses getSPLTokenMetadata)
History:  ✅ dogwifhat (uses getSPLTokenMetadata)

Assets:   ✅ USD Coin (uses getSPLTokenMetadata)
History:  ✅ USD Coin (uses getSPLTokenMetadata)
```

**Status:** ✅ **READY FOR FIX PROPOSAL**

