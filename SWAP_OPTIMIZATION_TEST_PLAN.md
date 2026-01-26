# 🧪 SWAP FUNCTIE - COMPLETE OPTIMALISATIE & TEST PLAN

## 📋 DOEL
Complete analyse en optimalisatie van de Blaze Wallet swap functie, getest met Li.Fi MCP server en lokale dev server.

---

## ✅ TEST FASE 1: LI.FI MCP SERVER VALIDATIE

### Test 1.1: Verify Solana Chain Support
**Doel:** Controleer of Solana correct wordt herkend door Li.Fi

**MCP Tool:** `lifi_get_chains()`

**Expected Result:**
```json
{
  "id": "1151111081099710",  // String, niet numeric!
  "key": "solana",
  "name": "Solana",
  "coin": "SOL",
  "chainType": "SOL"
}
```

**Status:** PENDING

---

### Test 1.2: Verify TRUMP Token Exists
**Doel:** Valideer dat TRUMP token swappable is

**MCP Tool:** `lifi_get_token(chain: 'solana', token: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN')`

**Expected Result:**
```json
{
  "address": "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
  "symbol": "TRUMP",
  "name": "OFFICIAL TRUMP",
  "decimals": 6,
  "chainId": "1151111081099710",
  "logoURI": "https://..."
}
```

**Status:** PENDING

---

### Test 1.3: Verify Jupiter DEX Available
**Doel:** Controleer dat Jupiter (Solana DEX) beschikbaar is

**MCP Tool:** `lifi_get_tools(chains: 'solana')`

**Expected Result:**
```json
{
  "exchanges": [
    {
      "key": "jupiter",
      "name": "Jupiter",
      "logoURI": "https://...",
      "supportedChains": ["1151111081099710"]
    }
  ]
}
```

**Status:** PENDING

---

### Test 1.4: Verify SOL → TRUMP Route Possible
**Doel:** Pre-validation dat SOL → TRUMP swap mogelijk is

**MCP Tool:** `lifi_get_connections(fromChain: 'solana', toChain: 'solana')`

**Expected Result:**
- Route moet bestaan voor same-chain Solana swaps
- Jupiter moet beschikbaar zijn

**Status:** PENDING

---

### Test 1.5: Get All Solana Tokens with Logos
**Doel:** Fetch alle Solana tokens met logoURI voor logo fix

**MCP Tool:** `lifi_get_tokens(chains: '1151111081099710')`

**Expected Result:**
- 100+ Solana SPL tokens
- Elk met logoURI field
- USDC, USDT, TRUMP, WIF, BONK, etc. included

**Status:** PENDING

---

## 🔍 TEST FASE 2: HUIDIGE IMPLEMENTATIE ISSUES

### Issue 2.1: Solana Chain ID Mismatch
**Probleem:** `isSolanaChainId()` check faalt mogelijk

**Current Code:**
```typescript
export function isSolanaChainId(chainId: string | number): boolean {
  return chainId === '1151111081099710' || chainId === 101;
}
```

**Test:**
- Check wat Li.Fi exact teruggeeft als chain ID
- Verify dat check correct is

**Expected Fix:**
- Mogelijk toevoegen van meer fallbacks
- Ensure string comparison werkt

**Status:** PENDING

---

### Issue 2.2: Missing Token Logos
**Probleem:** Alle tokens tonen chain logo ipv token logo

**Root Cause:**
- `lib/popular-tokens.ts` heeft geen logoURI fields
- `TokenSearchModal` fallback naar chain logo

**Test:**
- Verify dat Li.Fi alle logos heeft
- Check TrustWallet CDN fallback

**Expected Fix:**
- Fetch logos van Li.Fi API
- Cache in memory
- Update popular-tokens.ts OR dynamic fetch

**Status:** PENDING

---

### Issue 2.3: Fixed Gas Reserve Too High
**Probleem:** MAX button gebruikt fixed 0.01 ETH reserve

**Current Code:**
```typescript
gasReserve = fromChain === 'ethereum' ? 0.005 : 0.05;
```

**Test:**
- Call `lifi_get_gas_suggestion()` voor verschillende chains
- Compare met fixed reserves

**Expected Fix:**
- Dynamic gas reserve via Li.Fi
- Per-chain calculation
- Balance-based tiers (small/medium/large)

**Status:** PENDING

---

### Issue 2.4: No Pre-Swap Validation
**Probleem:** Gebruiker kan amount invullen voordat we weten of swap mogelijk is

**Current Code:**
- Geen pre-validation
- Quote fetchen gebeurt na amount input

**Test:**
- Time delay tussen token select en quote
- User experience bij unavailable swaps

**Expected Fix:**
- Call `lifi_get_connections()` bij token select
- Show "Swap not available" immediately
- Better UX

**Status:** PENDING

---

### Issue 2.5: Provider Initialization Bug (Solana)
**Probleem:** ethers.JsonRpcProvider wordt mogelijk gemaakt voor Solana

**Current Code:**
```typescript
const isFromSolana = isSolanaChainId(step.action?.fromChainId) || fromChain === 'solana';
```

**Test:**
- Log exact chain ID from Li.Fi response
- Verify dual check works

**Expected Fix:**
- Ensure Solana branch is ALWAYS taken
- Add more robust chain detection
- Never create ethers provider for Solana

**Status:** PENDING

---

## 🚀 TEST FASE 3: UI/UX OPTIMALISATIES

### UX 3.1: Quote Loading State
**Current:** Generic loader
**Improvement:** Show "Searching best rate..." met DEX logos

**Test:** Time quote fetch duration

**Status:** PENDING

---

### UX 3.2: Gas Cost Display
**Current:** Hidden in quote
**Improvement:** Prominent gas cost display

**Test:** User feedback

**Status:** PENDING

---

### UX 3.3: Slippage Explanation
**Current:** Just percentages
**Improvement:** "Slippage: What is this?" tooltip

**Test:** User confusion metrics

**Status:** PENDING

---

### UX 3.4: Cross-Chain Warning
**Current:** Small indicator
**Improvement:** Prominent "This is a cross-chain swap" warning

**Test:** User awareness

**Status:** PENDING

---

### UX 3.5: Balance Warning
**Current:** None
**Improvement:** "Not enough for gas" warning

**Test:** Failed transactions due to gas

**Status:** PENDING

---

## 🔧 TEST FASE 4: IMPLEMENTATIE FIXES

### Fix 4.1: Token Logo Implementation
**Approach:** Dynamic fetch via Li.Fi API

**Steps:**
1. Call `lifi_get_tokens()` voor chain
2. Extract logoURI per token address
3. Cache in TokenSearchModal state
4. Fallback: TrustWallet CDN
5. Update rendering logic

**Test:**
- Verify all 73+ curated tokens have logos
- Check cache performance (0ms after first load)
- Fallback works for unknown tokens

**Status:** PENDING

---

### Fix 4.2: Smart Gas Reserve
**Approach:** Dynamic via Li.Fi gas suggestion

**Steps:**
1. Call `lifi_get_gas_suggestion()` when MAX clicked
2. Use returned gas amount as reserve
3. Add balance-based tiers for very small balances
4. Update handleMaxAmount()

**Test:**
- MAX button with 0.001 ETH balance
- MAX button with 1 ETH balance
- MAX button with 100 ETH balance
- All should leave sufficient gas

**Status:** PENDING

---

### Fix 4.3: Solana Chain Detection
**Approach:** Enhanced isSolanaChainId + logging

**Steps:**
1. Add comprehensive logging to swap execution
2. Log exact chain ID from Li.Fi
3. Update isSolanaChainId() if needed
4. Ensure dual check works (step.action.fromChainId OR fromChain)

**Test:**
- SOL → TRUMP swap
- SOL → USDC swap
- Verify Solana branch is taken
- No ethers provider for Solana

**Status:** PENDING

---

### Fix 4.4: Pre-Swap Validation
**Approach:** Call lifi_get_connections() on token select

**Steps:**
1. Add useEffect to fetch connections when tokens change
2. Show loading state during validation
3. Display "Swap not available" if no route
4. Cache results per token pair

**Test:**
- Select tokens on same chain (should be fast)
- Select tokens on different chains
- Select unsupported token combination
- Cache works (no repeated calls)

**Status:** PENDING

---

## 📊 TEST FASE 5: COMPREHENSIVE CHAIN TESTING

### Test Per Chain:

#### Ethereum (Chain ID: 1)
- [ ] ETH → USDC (same-chain)
- [ ] ETH → MATIC (cross-chain to Polygon)
- [ ] USDC → USDT (ERC20 to ERC20)
- [ ] MAX button works
- [ ] Gas estimate accurate
- [ ] Token approval works

#### Polygon (Chain ID: 137)
- [ ] MATIC → USDC (same-chain)
- [ ] MATIC → ETH (cross-chain to Ethereum)
- [ ] Token logos display
- [ ] Gas cost in MATIC

#### Arbitrum (Chain ID: 42161)
- [ ] ETH → USDC (same-chain, low gas)
- [ ] Cross-chain bridge works

#### Base (Chain ID: 8453)
- [ ] ETH → USDC
- [ ] New chain support verified

#### Optimism (Chain ID: 10)
- [ ] ETH → USDC
- [ ] Optimistic rollup specific features

#### BSC (Chain ID: 56)
- [ ] BNB → BUSD
- [ ] BNB → ETH (cross-chain)

#### Avalanche (Chain ID: 43114)
- [ ] AVAX → USDC
- [ ] Different gas model

#### Cronos (Chain ID: 25)
- [ ] CRO → USDC
- [ ] Less common chain

#### ZKSync (Chain ID: 324)
- [ ] ETH → USDC
- [ ] ZK-specific features

#### Linea (Chain ID: 59144)
- [ ] ETH → USDC
- [ ] New chain verification

#### **Solana (Chain ID: "1151111081099710")**
- [ ] SOL → USDC (Jupiter)
- [ ] SOL → TRUMP (meme coin)
- [ ] SOL → WIF (another meme)
- [ ] SPL token handling
- [ ] VersionedTransaction support
- [ ] NO ethers.js initialization

#### Fantom (Status: NOT SUPPORTED)
- [ ] Should show "Not available" message
- [ ] Graceful error handling

---

## 🎯 SUCCESS CRITERIA

### Critical (MUST WORK):
- ✅ All EVM chains work (same-chain swaps)
- ✅ Solana swaps work (SOL → TRUMP, SOL → USDC, etc.)
- ✅ Token logos display correctly
- ✅ MAX button accurate for all chains
- ✅ No build errors
- ✅ No runtime errors

### High Priority (SHOULD WORK):
- ✅ Cross-chain swaps work (Ethereum → Polygon, etc.)
- ✅ Token approval flow smooth
- ✅ Gas estimates accurate
- ✅ Pre-swap validation fast
- ✅ UI/UX polished

### Medium Priority (NICE TO HAVE):
- ✅ Gas price warnings
- ✅ Slippage tooltips
- ✅ Cross-chain bridge tracking
- ✅ Revenue tracking setup

---

## 📝 TESTING METHODOLOGY

### Automated Tests (Via MCP Server):
1. `lifi_get_chains()` - Verify all chains
2. `lifi_get_tokens()` - Verify tokens per chain
3. `lifi_get_tools()` - Verify DEXes/bridges
4. `lifi_get_connections()` - Verify routes
5. `lifi_get_gas_suggestion()` - Gas estimates

### Manual Tests (Via Local Server):
1. Open http://localhost:3000
2. Login to wallet
3. Navigate to Swap
4. Test each chain systematically
5. Test edge cases (low balance, unsupported tokens, etc.)

### Live Tests (User Login Required):
1. Real swap execution
2. Real gas costs
3. Real approvals
4. Real bridge transactions

---

## 🔄 TESTING WORKFLOW

### Step 1: MCP Server Tests (Automated)
```bash
# Run via Cursor with MCP tools
lifi_get_chains() → Verify Solana exists
lifi_get_token() → Verify TRUMP exists
lifi_get_tools() → Verify Jupiter exists
lifi_get_connections() → Verify routes
```

### Step 2: Code Analysis
```bash
# Read all swap-related files
- SwapModal.tsx
- lifi-service.ts
- lifi-chain-ids.ts
- TokenSearchModal.tsx
- popular-tokens.ts
```

### Step 3: Identify Issues
```bash
# Create issue list with:
- Current behavior
- Expected behavior
- Root cause
- Proposed fix
```

### Step 4: Implement Fixes
```bash
# For each issue:
1. Write fix
2. Test locally
3. Verify no regressions
4. Update documentation
```

### Step 5: Local Testing
```bash
# Dev server at localhost:3000
1. Test UI/UX
2. Test quote fetching
3. Test error handling
4. Test edge cases
```

### Step 6: Live Testing
```bash
# Real wallet, real swaps
1. Test with small amounts
2. Test approval flow
3. Test cross-chain
4. Monitor transaction
```

### Step 7: Build & Deploy
```bash
npm run build
# Verify no errors
git add -A
git commit -m "..."
git push origin main
```

---

## 📊 PROGRESS TRACKING

### Current Status:
- [ ] MCP Server Tests Complete
- [ ] Issues Identified
- [ ] Fixes Implemented
- [ ] Local Tests Pass
- [ ] Live Tests Pass
- [ ] Build Success
- [ ] Deployed

### Blockers:
- None currently

### Next Actions:
1. Run MCP server tests
2. Analyze results
3. Implement fixes
4. Test locally
5. Report back

---

**Last Updated:** 2026-01-26
**Testing By:** Cursor AI with Li.Fi MCP Server
**Status:** READY TO START

