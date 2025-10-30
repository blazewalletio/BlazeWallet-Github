# 🔍 GRONDIGE ANALYSE: Chain Switching & Token Balance Problemen

## 📊 HUIDIGE ARCHITECTUUR OVERZICHT

### Data Flow Diagram
```
User Action → Chain Switch → fetchData() → [ASYNC OPERATIONS] → Update UI State
                  ↓
            [PROBLEM ZONE: Race Conditions]
                  ↓
            State Updates (updateTokens, setNativePriceUSD, etc.)
```

---

## ⚠️ GEÏDENTIFICEERDE PROBLEMEN

### **PROBLEEM #1: Native Price State Persistence (KRITIEK)**

**Locatie:** `components/Dashboard.tsx` regel 103, 166-170, 206-218

**Probleem Omschrijving:**
```typescript
// State die NIET reset bij chain switch:
const [nativePriceUSD, setNativePriceUSD] = useState(0);

// useEffect reset WEL, maar cache-berekening gebruikt OUDE state:
useEffect(() => {
  setNativePriceUSD(0); // Reset gebeurt
  setLastPriceUpdate(null);
}, [currentChain]);

// MAAR cache load gebeurt VOOR reset compleet is:
if (nativePriceUSD > 0) {
  // ❌ Dit gebruikt OUDE prijs van vorige chain!
  cachedNativeValueUSD = parseFloat(cachedBalance) * nativePriceUSD;
}
```

**Concrete Scenario:**
1. User op Ethereum → `nativePriceUSD` = $3895 (ETH)
2. User switcht naar Solana → useEffect triggert
3. **MAAR:** `fetchData()` runt meteen met OUDE `nativePriceUSD` state
4. Cache berekening: 0.000947171 SOL × **$3895** = $3.69 ❌
5. Correcte berekening zou zijn: 0.000947171 SOL × $192.17 = $0.18 ✅

**Root Cause:**
- React state updates zijn **asynchroon**
- `fetchData()` runt met stale state voordat reset compleet is
- Cache load gebruikt stale `nativePriceUSD` voor berekening

---

### **PROBLEEM #2: Race Conditions bij Async Token Fetching (KRITIEK)**

**Locatie:** `components/Dashboard.tsx` regel 178-505

**Probleem Omschrijving:**
```typescript
const fetchData = async (force = false) => {
  // Geen tracking van welke chain deze fetch is gestart!
  
  // STEP 1: Balance fetch (~200ms)
  const bal = await blockchain.getBalance(displayAddress);
  
  // ❌ User kan hier chain switchen!
  
  // STEP 2: Price fetch (~300ms)
  const pricesMap = await priceService.getMultiplePrices(allSymbols);
  
  // ❌ User kan hier chain switchen!
  
  // STEP 3: Token balance fetch (~500ms)
  const erc20Tokens = await blockchain.getERC20TokenBalances(displayAddress);
  
  // ❌ User kan hier chain switchen!
  
  // STEP 5: State update met VERKEERDE chain data!
  updateTokens(tokensWithValue); // ❌ ERC20 tokens onder Solana!
  setTotalValueUSD(totalValue);  // ❌ Verkeerde berekening!
}
```

**Concrete Scenario:**
1. User op Solana, 3 SPL tokens geladen ✅
2. User switcht naar Ethereum → `fetchData()` start
3. STEP 1-3 lopen (Ethereum ERC20 tokens ophalen, ~800ms)
4. User switcht TERUG naar Solana tijdens STEP 3
5. Ethereum `fetchData()` completeert → `updateTokens(erc20Tokens)`
6. **RESULTAAT:** ERC20 tokens worden getoond onder Solana! ❌

**Root Cause:**
- Geen tracking van "welke chain" een async fetch behoort
- Geen abort mechanism bij chain switch
- State updates gebeuren altijd, ongeacht huidige chain

---

### **PROBLEEM #3: Global State Pollution**

**Locatie:** `hooks/wallet-store.ts` regel 519-521

**Probleem Omschrijving:**
```typescript
updateTokens: (tokens: Token[]) => {
  set({ tokens }); // ❌ GEEN chain-specifieke opslag!
}

// Dit betekent:
// - Ethereum tokens overschrijven Solana tokens
// - Solana tokens overschrijven Ethereum tokens
// - Geen isolatie tussen chains
```

**Impact:**
- Tokens state is GLOBAAL, niet per-chain
- Chain A tokens blijven zichtbaar na switch naar Chain B
- Race conditions kunnen tokens van verkeerde chain tonen

---

### **PROBLEEM #4: Cache Key Collision Risk**

**Locatie:** `lib/token-balance-cache.ts` regel 82, 109

**Probleem Omschrijving:**
```typescript
const key = `${chain}:${address}`; // ✅ Goed, maar...

// Bij cache load:
if (nativePriceUSD > 0) {
  // ❌ Gebruikt GLOBAL state, niet chain-specific!
  cachedNativeValueUSD = parseFloat(cachedBalance) * nativePriceUSD;
}
```

**Impact:**
- Cache keys zijn correct per-chain
- MAAR: Cache VALUE berekening gebruikt global `nativePriceUSD` state
- Cross-chain price contamination

---

### **PROBLEEM #5: Geen Loading State Isolation**

**Locatie:** `components/Dashboard.tsx` regel 82, 182

**Probleem Omschrijving:**
```typescript
const [isRefreshing, setIsRefreshing] = useState(false);

// Single boolean voor ALLE chains
// Betekent:
if (isRefreshing) return; // ❌ Blokkeert nieuwe fetch voor andere chain!
```

**Impact:**
- Als Ethereum fetch loopt, kan Solana niet laden
- User moet wachten tot eerste fetch compleet is
- Slechte UX bij snelle chain switches

---

## 🎯 VOORSTEL: COMPLETE HERSTRUCTURERING

### **OPLOSSING #1: Chain-Scoped State Management**

```typescript
// Nieuwe state structure:
const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());

interface ChainState {
  nativePriceUSD: number;
  totalValueUSD: number;
  tokens: Token[];
  isRefreshing: boolean;
  lastUpdate: Date | null;
  activeF fetchId: string | null; // ✅ Track async operations!
}

// Chain-specific getters:
const getCurrentChainState = () => {
  return chainStates.get(currentChain) || DEFAULT_CHAIN_STATE;
};
```

**Voordelen:**
- ✅ Volledige state isolatie per chain
- ✅ Geen cross-chain pollution
- ✅ Parallelle fetch operations mogelijk

---

### **OPLOSSING #2: Abort Controller Pattern**

```typescript
// Track active fetches:
const activeFetchControllers = useRef<Map<string, AbortController>>(new Map());

const fetchData = async (force = false) => {
  // Cancel previous fetch voor deze chain
  const existingController = activeFetchControllers.current.get(currentChain);
  if (existingController) {
    existingController.abort();
    console.log(`🚫 Aborted stale fetch for ${currentChain}`);
  }
  
  // Create new abort controller
  const controller = new AbortController();
  const fetchId = `${currentChain}-${Date.now()}`;
  activeFetchControllers.current.set(currentChain, controller);
  
  try {
    // STEP 1: Balance fetch met abort check
    const bal = await blockchain.getBalance(displayAddress);
    if (controller.signal.aborted) throw new Error('Aborted');
    
    // STEP 2: Tokens fetch met abort check
    const tokens = await blockchain.getTokenBalances(displayAddress);
    if (controller.signal.aborted) throw new Error('Aborted');
    
    // STEP 3: FINALE check voor state update
    if (controller.signal.aborted) throw new Error('Aborted');
    if (activeFetchControllers.current.get(currentChain)?.signal !== controller.signal) {
      throw new Error('Newer fetch started');
    }
    
    // ✅ SAFE: State update alleen als fetch nog relevant is
    updateChainState(currentChain, { tokens, balance: bal });
    
  } catch (error) {
    if (error.message === 'Aborted') {
      console.log(`✅ Successfully aborted stale fetch for ${currentChain}`);
      return;
    }
    throw error;
  } finally {
    activeFetchControllers.current.delete(currentChain);
  }
};
```

**Voordelen:**
- ✅ Automatische abort bij chain switch
- ✅ Voorkomt race conditions
- ✅ Clean state updates, alleen voor actieve chain

---

### **OPLOSSING #3: Chain-Specific Token Store**

```typescript
// In wallet-store.ts:
interface WalletState {
  // ❌ VERWIJDER global tokens array
  // tokens: Token[];
  
  // ✅ VERVANG met chain-specific storage
  chainTokens: Map<string, Token[]>;
  chainBalances: Map<string, string>;
  chainPrices: Map<string, number>;
}

updateTokens: (chain: string, tokens: Token[]) => {
  const { chainTokens } = get();
  const updated = new Map(chainTokens);
  updated.set(chain, tokens);
  set({ chainTokens: updated });
},

getChainTokens: (chain: string): Token[] => {
  const { chainTokens } = get();
  return chainTokens.get(chain) || [];
},
```

**Voordelen:**
- ✅ Complete isolatie tussen chains
- ✅ Geen overwrite risk
- ✅ Kan meerdere chains cachen

---

### **OPLOSSING #4: Smart Cache met Chain Context**

```typescript
// In token-balance-cache.ts:
async set(
  chain: string, 
  address: string, 
  tokens: any[], 
  nativeBalance: string,
  nativePrice: number, // ✅ NIEUW: Bewaar prijs IN cache!
  ttl: number = 15 * 60 * 1000
): Promise<void> {
  const cached: CachedTokenData = {
    key: `${chain}:${address}`,
    tokens,
    nativeBalance,
    nativePrice, // ✅ Prijs gebonden aan cache entry!
    timestamp: Date.now(),
    expiresAt: Date.now() + ttl,
    version: CACHE_VERSION,
  };
  
  await this.setToDB(cached);
}

async getStale(chain: string, address: string): Promise<CachedResult> {
  const cached = await this.getFromDB(`${chain}:${address}`);
  
  if (cached) {
    // ✅ Gebruik cached price, NIET global state!
    const cachedNativeValueUSD = parseFloat(cached.nativeBalance) * cached.nativePrice;
    
    return {
      tokens: cached.tokens,
      nativeBalance: cached.nativeBalance,
      nativeValueUSD: cachedNativeValueUSD, // ✅ Correct voor deze chain!
      isStale: Date.now() > cached.expiresAt
    };
  }
  
  return { tokens: null, nativeBalance: null, nativeValueUSD: 0, isStale: false };
}
```

**Voordelen:**
- ✅ Prijs context bewaard in cache
- ✅ Geen dependency op global state
- ✅ Correcte berekeningen altijd

---

### **OPLOSSING #5: Chain Switch Hook met Cleanup**

```typescript
// Nieuwe hook voor chain switch coordination:
useEffect(() => {
  console.log(`🔄 Chain switching: ${prevChain} → ${currentChain}`);
  
  // 1. Abort alle active fetches voor ALLE chains
  activeFetchControllers.current.forEach((controller, chain) => {
    controller.abort();
    console.log(`🚫 Aborted fetch for ${chain}`);
  });
  activeFetchControllers.current.clear();
  
  // 2. Clear loading states
  setIsRefreshing(false);
  
  // 3. Load cached data voor nieuwe chain (instant!)
  const cachedState = chainStates.get(currentChain);
  if (cachedState) {
    // Toon immediate cached data
    console.log(`⚡ Loading cached state for ${currentChain}`);
    updateBalance(cachedState.nativeBalance);
    updateTokens(cachedState.tokens);
    setTotalValueUSD(cachedState.totalValueUSD);
  }
  
  // 4. Start fresh fetch voor nieuwe chain
  setTimeout(() => {
    fetchData(false); // Background refresh
  }, 50); // Small delay voor state stabilization
  
}, [currentChain]); // ✅ Trigger op elke chain change
```

**Voordelen:**
- ✅ Clean slate bij elke switch
- ✅ Instant cached data show
- ✅ Background refresh voor fresh data
- ✅ Geen leftover state

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Foundation (Critical)**
- [ ] Implement chain-scoped state management
- [ ] Add AbortController pattern voor alle async operations
- [ ] Update cache om nativePrice op te slaan
- [ ] Test: Switch Ethereum → Solana → Correct native balance

### **Phase 2: Store Refactor (High Priority)**
- [ ] Update wallet-store voor per-chain token storage
- [ ] Implement getChainTokens/updateChainTokens methods
- [ ] Migreer bestaande code naar nieuwe API
- [ ] Test: Switch chains, verify token isolation

### **Phase 3: UI/UX Improvements (Medium Priority)**
- [ ] Per-chain loading states
- [ ] Smooth transitions bij chain switch
- [ ] Progress indicators voor long operations
- [ ] Error boundaries per chain

### **Phase 4: Optimization (Low Priority)**
- [ ] Parallel token fetching waar mogelijk
- [ ] Smart prefetching voor vaak gebruikte chains
- [ ] Cache warming strategies
- [ ] Performance metrics logging

---

## ⚡ VERWACHTE RESULTATEN

### **Voor Implementatie (Huidige State)**
```
❌ Ethereum → Solana: Verkeerde native balance ($3.69 ipv $0.18)
❌ Switch tijdens load: ERC20 tokens onder Solana assets
❌ Snelle switches: Race conditions, frozen UI
❌ Cache reads: Cross-chain price contamination
```

### **Na Implementatie (Target State)**
```
✅ Ethereum → Solana: Correcte native balance altijd
✅ Switch tijdens load: Clean abort, geen mixed tokens
✅ Snelle switches: Smooth, instant cached data, geen race conditions
✅ Cache reads: 100% accurate, chain-isolated calculations
✅ UX: Instant switches, per-chain loading states, geen flickers
```

---

## 🎯 SUCCESS CRITERIA

1. **Correctheid:** 100% accurate balances voor elke chain, elke switch
2. **Performance:** < 50ms switch tijd (cached), < 1s fresh data
3. **Betrouwbaarheid:** Geen race conditions, geen mixed state
4. **UX:** Smooth transitions, instant feedback, geen loading blocks
5. **Maintainability:** Clean architecture, easy debugging, clear separation

---

## 💡 EXTRA OVERWEGINGEN

### **Solana-Specific Issues**
- Wrapped SOL filtering werkt correct ✅
- SPL token detection via Jupiter cache ✅
- DexScreener fallback voor obscure tokens ✅

### **Ethereum-Specific Issues**
- Alchemy API integration werkt goed ✅
- Address-based price fetching via CoinGecko ✅
- Token metadata fetching voor logos ✅

### **General Issues**
- ❌ State management: Global, geen chain isolation
- ❌ Race condition protection: Ontbreekt volledig
- ❌ Abort mechanism: Niet geïmplementeerd
- ❌ Cache price storage: Gebruikt stale global state

---

## 🏁 CONCLUSIE

De huidige implementatie heeft **fundamentele architectuur problemen** die leiden tot:
1. Verkeerde balances bij chain switches
2. Token mix-ups door race conditions
3. State pollution tussen chains
4. Cache contamination

De voorgestelde oplossingen vereisen een **significante refactor** maar resulteren in een **robuust, betrouwbaar systeem** dat perfect werkt voor elke chain, elke switch scenario.

**Geschatte Effort:** 6-8 uur development + 2-3 uur testing
**Risico:** Medium (breaking changes, requires thorough testing)
**Impact:** HIGH (fixes critical user-facing bugs)

---

**Status:** Ready for implementation approval
**Next Steps:** User approval → Implement Phase 1 → Test → Deploy

