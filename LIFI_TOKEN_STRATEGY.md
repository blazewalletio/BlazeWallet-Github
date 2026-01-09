# 🎯 LI.FI TOKEN STRATEGIE - PERFECT VOORSTEL

**Datum:** 9 januari 2026  
**Doel:** Optimale token lijst voor TO dropdown in SwapModal  
**Analyse:** Li.Fi MCP Server + ALLE 17 BLAZE chains

---

## 📊 HUIDIGE SITUATIE

### **Li.Fi Supported Chains (10/11 EVM):**
| Chain | Chain ID | Tokens | Status |
|-------|----------|--------|--------|
| Ethereum | 1 | 3,459 | ✅ Ondersteund |
| Polygon | 137 | 1,397 | ✅ Ondersteund |
| Arbitrum | 42161 | 1,137 | ✅ Ondersteund |
| Base | 8453 | 612 | ✅ Ondersteund |
| Optimism | 10 | 326 | ✅ Ondersteund |
| BSC | 56 | 686 | ✅ Ondersteund |
| Avalanche | 43114 | 388 | ✅ Ondersteund |
| Cronos | 25 | 25 | ✅ Ondersteund |
| zkSync Era | 324 | 73 | ✅ Ondersteund |
| Linea | 59144 | 108 | ✅ Ondersteund |
| **Fantom** | **250** | **N/A** | ❌ **NIET ondersteund** |

### **Non-EVM Chains:**
- **Solana (101):** Jupiter API (aparte integratie)
- **Bitcoin/Litecoin/Dogecoin/Bitcoin Cash:** Geen DEX support

---

## 🔍 ANALYSE: Li.Fi TOKEN ORDERING

### **PROBLEEM met Li.Fi's default ordering:**

Li.Fi retourneert tokens in een **chaotische volgorde**, NIET op populariteit:

**Ethereum top 10 (zoals Li.Fi het retourneert):**
1. ETH ✅
2. mkr (Maker) ❓
3. TAG (TAGBOND - scam?) 🚫
4. wCUSD (wrapped garbage) 🚫
5. OPU (Opu Coin - onbekend) 🚫
6. UNT (Unimonitor - onbekend) 🚫
7. wUSDL (wrapped stablecoin - obscuur) 🚫
8. HUH (Huh Token - onbekend) 🚫
9. eFIL (wrapped Filecoin - zeer obscuur) 🚫
10. DNS (BitDNS - onbekend) 🚫

**❌ CONCLUSIE:** Li.Fi ordering is **NIET bruikbaar** voor een goede UX!

---

## ✅ OPLOSSING: HYBRIDE STRATEGIE

### **VOORSTEL 1: Li.Fi API + Handmatige Curated List (BESTE OPTIE)**

**Concept:**
1. **Curated Popular Tokens** per chain (top 10-20)
2. **Li.Fi API** voor search functie (alle 3000+ tokens searchable)
3. **Wallet Tokens** bovenaan (tokens die gebruiker heeft)

**Implementatie:**

```typescript
// 1. CURATED LISTS per chain (handmatig beheerd)
const POPULAR_TOKENS = {
  ethereum: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
    { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
    { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
    { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' },
  ],
  polygon: [
    { symbol: 'POL', name: 'Polygon', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
    { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6' },
    { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
    { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
    { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39' },
    { symbol: 'AAVE', address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B' },
  ],
  arbitrum: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
    { symbol: 'WBTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f' },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
    { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548' },
    { symbol: 'LINK', address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4' },
  ],
  base: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006' },
    { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
  ],
  optimism: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
    { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006' },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
    { symbol: 'WBTC', address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095' },
    { symbol: 'OP', address: '0x4200000000000000000000000000000000000042' },
  ],
  bsc: [
    { symbol: 'BNB', name: 'BNB', address: '0x0000...', isNative: true },
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
    { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
    { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8' },
    { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
    { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  ],
  avalanche: [
    { symbol: 'AVAX', name: 'Avalanche', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
    { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7' },
    { symbol: 'WETH.e', address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB' },
    { symbol: 'WBTC.e', address: '0x50b7545627a5162F82A992c33b87aDc75187B218' },
  ],
  cronos: [
    { symbol: 'CRO', name: 'Cronos', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59' },
    { symbol: 'USDT', address: '0x66e428c3f67a68878562e79A0234c1F83c208770' },
    { symbol: 'WCRO', address: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23' },
  ],
  zksync: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4' },
    { symbol: 'WETH', address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91' },
  ],
  linea: [
    { symbol: 'ETH', name: 'Ethereum', address: '0x0000...', isNative: true },
    { symbol: 'USDC', address: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' },
    { symbol: 'WETH', address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f' },
  ],
};

// 2. DISPLAY STRATEGY
const getTokensForChain = async (chainKey: string) => {
  // A. Curated popular tokens (instant display)
  const popularTokens = POPULAR_TOKENS[chainKey] || [];
  
  // B. Search via Li.Fi API (when user types)
  const searchTokens = async (query: string) => {
    const lifiTokens = await fetchFromLiFi(chainKey, query);
    return lifiTokens;
  };
  
  // C. Display order:
  // 1. Native token (always first)
  // 2. Wallet tokens (tokens user has balance)
  // 3. Popular tokens (curated list)
  // 4. Search results (Li.Fi API)
};
```

---

## 🎯 STRATEGIE PER CHAIN TYPE

### **A. Li.Fi SUPPORTED CHAINS (10 chains):**
**Ethereum, Polygon, Arbitrum, Base, Optimism, BSC, Avalanche, Cronos, zkSync, Linea**

**Strategie:**
1. ✅ **Curated list** (top 10-20 populaire tokens)
2. ✅ **Li.Fi API search** (alle 3000+ tokens searchable)
3. ✅ **Wallet tokens** prioriteit (bovenaan)

### **B. FANTOM (Li.Fi NIET ONDERSTEUND):**
**Fantom (250)**

**Strategie:**
1. ✅ **Supabase token_registry** (onze eigen database)
2. ✅ **Handmatig curated list** voor populaire tokens
3. ❌ **Geen swap functionaliteit** (graceful error message)

### **C. NON-EVM CHAINS:**
**Solana, Bitcoin, Litecoin, Dogecoin, Bitcoin Cash**

**Strategie:**
1. ✅ **Solana:** Jupiter API (aparte integratie)
2. ❌ **Bitcoin/LTC/DOGE/BCH:** Geen swap (UTXO chains)

---

## 📋 VOORSTEL: 3-TIER TOKEN SYSTEM

### **TIER 1: NATIVE TOKEN** (altijd bovenaan)
- Ethereum: ETH
- Polygon: POL (was MATIC)
- Base: ETH
- etc.

### **TIER 2: WALLET TOKENS** (tokens die gebruiker heeft)
- Haalt uit wallet store
- Sorted by USD value (hoogste eerst)
- Badge: "In wallet" of balance display

### **TIER 3: POPULAR TOKENS** (curated list)
- Top 10-20 per chain
- Handmatig beheerd (zoals MetaMask/Phantom)
- Gesorteerd op market cap / populariteit

### **TIER 4: SEARCH RESULTS** (Li.Fi API)
- Alleen bij search query
- Alle 3000+ tokens searchable
- Real-time van Li.Fi API

---

## 💡 IMPLEMENTATIE VOORSTEL

### **OPTIE A: VOLLEDIGE LI.FI INTEGRATIE (BESTE UX)**

**Voordelen:**
- ✅ 3000+ tokens per chain searchable
- ✅ Altijd up-to-date (Li.Fi maintained)
- ✅ Accurate pricing data
- ✅ Beste swap routing

**Nadelen:**
- ❌ Requires curated list voor ordering
- ❌ API calls voor search

**Implementatie:**
```typescript
// 1. Create curated lists (lib/popular-tokens.ts)
// 2. Display curated by default
// 3. Use Li.Fi API for search
// 4. Cache Li.Fi responses (5min)
```

---

### **OPTIE B: HYBRID (SUPABASE + LI.FI)**

**Voordelen:**
- ✅ Snelle initial load (Supabase)
- ✅ Fallback naar Li.Fi voor search
- ✅ Works voor Fantom (Supabase only)

**Nadelen:**
- ❌ Dubbel onderhoud (Supabase + curated)
- ❌ Mogelijk verouderde data in Supabase

---

### **OPTIE C: 100% CURATED (SIMPELST)**

**Voordelen:**
- ✅ Simpelste implementatie
- ✅ Geen API calls nodig
- ✅ Instant display

**Nadelen:**
- ❌ Beperkt tot curated list (20-50 tokens)
- ❌ Geen obscure tokens
- ❌ Handmatig onderhoud

---

## 🏆 AANBEVELING: OPTIE A (VOLLEDIGE LI.FI)

### **WAAROM?**

1. **Beste UX** - Zoals MetaMask/Phantom
2. **Meeste tokens** - 3000+ searchable per chain
3. **Altijd up-to-date** - Li.Fi maintained
4. **Future-proof** - Schaalt met nieuwe tokens

### **IMPLEMENTATIE STAPPEN:**

1. ✅ **Maak curated lists** (`lib/popular-tokens.ts`)
   - Top 10-20 per chain
   - Handmatig getest en verified
   - Include: symbol, name, address, logoURI

2. ✅ **Update TokenSearchModal**
   - Display curated by default
   - Use Li.Fi API for search
   - Cache responses (5min)
   - Wallet tokens bovenaan

3. ✅ **Fallback voor Fantom**
   - Use Supabase token_registry
   - Graceful swap error message
   - Same UI/UX

4. ✅ **Testing**
   - Test alle 10 Li.Fi chains
   - Test search functie
   - Test wallet token prioriteit

---

## 📊 VERWACHTE RESULTAAT

### **TO DROPDOWN (na implementatie):**

**Display order:**
1. **Native token** (bijv. ETH) - altijd bovenaan
2. **Wallet tokens** (tokens die je hebt) - sorted by USD value
3. **─── Popular Tokens ───** (divider)
4. **Curated tokens** (USDC, USDT, DAI, etc.) - handmatig geselecteerd
5. **─── Search Results ───** (alleen bij search)
6. **Li.Fi search results** (3000+ tokens) - real-time

**Totaal zichtbaar zonder search:** 15-30 tokens  
**Totaal searchable:** 3000+ tokens per chain  

---

## ✅ CONCLUSIE

**Gebruik Li.Fi API** met **curated popular lists** voor de beste UX!

- ✅ Display: Curated lists (instant)
- ✅ Search: Li.Fi API (3000+ tokens)
- ✅ Wallet tokens: Prioriteit (bovenaan)
- ✅ Fallback: Supabase voor Fantom

**Resultaat:** Exact zoals MetaMask/Phantom, maar met betere swap routing via Li.Fi!

