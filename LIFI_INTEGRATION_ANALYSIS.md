# 🔄 LI.FI API INTEGRATION - VOLLEDIGE ANALYSE & IMPLEMENTATIEPLAN

## 📋 OVERZICHT

Dit document beschrijft de **100% perfecte en flawless** manier om Li.Fi API te integreren in de Blaze Wallet swap functie, ter vervanging/uitbreiding van de huidige 1inch implementatie.

---

## 🎯 WAAROM LI.FI?

### **Voordelen t.o.v. 1inch:**
- ✅ **Cross-chain swaps** - Swap tussen verschillende chains (ETH → Polygon, etc.)
- ✅ **Bridges geïntegreerd** - Automatisch beste bridge route vinden
- ✅ **Meer chains** - Ondersteunt 70+ blockchains
- ✅ **Betere rates** - Aggregeert meerdere DEXes + bridges
- ✅ **Unified API** - Eén API voor alle swaps (same-chain + cross-chain)
- ✅ **Geen API key nodig** - Werkt zonder key (maar key geeft hogere rate limits)
- ✅ **Transaction status tracking** - Real-time status updates
- ✅ **Meer tokens** - Ondersteunt veel meer tokens dan 1inch

### **Li.Fi vs 1inch:**
| Feature | 1inch | Li.Fi |
|---------|-------|-------|
| Same-chain swaps | ✅ | ✅ |
| Cross-chain swaps | ❌ | ✅ |
| Bridge integration | ❌ | ✅ |
| Supported chains | ~10 | 70+ |
| API key required | ✅ | ❌ (optioneel) |
| Rate limits (no key) | N/A | 200/2h |
| Rate limits (with key) | 1M/month | 200/min |

---

## 🏗️ LI.FI API ARCHITECTUUR

### **Base URL:**
```
https://li.quest/v1/
```

### **Key Endpoints:**

#### **1. GET /quote** - Get swap quote
**Purpose:** Get best quote for a swap (same-chain or cross-chain)

**Request:**
```typescript
GET /quote?fromChain=1&toChain=137&fromToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&toToken=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174&fromAmount=1000000000000000000&toAddress=0x...
```

**Parameters:**
- `fromChain` (number) - Source chain ID
- `toChain` (number) - Destination chain ID (same as fromChain for same-chain swap)
- `fromToken` (string) - Source token address (native: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`)
- `toToken` (string) - Destination token address
- `fromAmount` (string) - Amount in wei/smallest unit
- `toAddress` (string) - Recipient address
- `slippage` (number, optional) - Slippage tolerance (default: 0.03 = 3%)
- `order` (string, optional) - `RECOMMENDED` (default) or `CHEAPEST` or `FASTEST`

**Response:**
```typescript
{
  id: string; // Route ID
  action: {
    fromToken: Token;
    toToken: Token;
    fromAmount: string;
    toAmount: string;
    slippage: number;
    fromChainId: number;
    toChainId: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string; // Min amount after slippage
    approvalAddress: string; // Token approval address (if needed)
    feeCosts: Array<{
      name: string;
      description: string;
      token: Token;
      amount: string;
      amountUSD: string;
    }>;
    gasCosts: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
      amount: string;
      amountUSD: string;
      token: Token;
    }>;
    executionDuration: number; // Estimated time in seconds
  };
  tool: string; // DEX/bridge name (e.g., "1inch", "Uniswap", "Stargate")
  integrator: string;
  steps: Array<{
    id: string;
    type: string; // "swap", "bridge", "approve"
    action: {
      fromToken: Token;
      toToken: Token;
      fromAmount: string;
      toAmount: string;
      slippage: number;
      fromChainId: number;
      toChainId: number;
    };
    estimate: {
      fromAmount: string;
      toAmount: string;
      toAmountMin: string;
      approvalAddress: string;
      feeCosts: Array<any>;
      gasCosts: Array<any>;
      executionDuration: number;
    };
    tool: string;
    integrator: string;
  }>;
}
```

#### **2. POST /stepTransaction** - Get transaction data for a step
**Purpose:** Get transaction data to execute a swap step

**Request:**
```typescript
POST /stepTransaction
{
  route: QuoteResponse; // Full quote from /quote endpoint
  stepIndex: number; // Which step to execute (0, 1, 2, ...)
  userAddress: string; // User's wallet address
  recipientAddress?: string; // Optional: different recipient
}
```

**Response:**
```typescript
{
  transactionRequest: {
    data: string; // Transaction data
    to: string; // Contract address
    value: string; // Native token amount (if needed)
    gasPrice: string; // Gas price
    gasLimit: string; // Gas limit
    from: string; // User address
  };
  route: QuoteResponse; // Updated route with transaction
}
```

#### **3. GET /status** - Get transaction status
**Purpose:** Track status of a swap transaction

**Request:**
```typescript
GET /status?txHash=0x...&bridge=stargate&fromChain=1&toChain=137
```

**Response:**
```typescript
{
  status: 'PENDING' | 'DONE' | 'FAILED';
  sending: {
    txHash: string;
    txLink: string;
    amount: string;
    token: Token;
  };
  receiving: {
    txHash?: string;
    txLink?: string;
    amount?: string;
    token?: Token;
  };
}
```

#### **4. GET /chains** - Get supported chains
**Purpose:** Get list of all supported chains

**Response:**
```typescript
Array<{
  id: number;
  key: string;
  name: string;
  coin: string;
  mainnet: boolean;
  chainType: string;
  logoURI: string;
  nativeToken: Token;
  rpc: string[];
  explorers: Array<{
    name: string;
    url: string;
  }>;
}>
```

#### **5. GET /tokens** - Get supported tokens
**Purpose:** Get list of supported tokens for a chain

**Request:**
```typescript
GET /tokens?chainIds=1,137,56
```

**Response:**
```typescript
{
  [chainId: string]: Array<{
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
    name: string;
    coinKey: string;
    logoURI: string;
    priceUSD: string;
  }>;
}
```

---

## 🔧 IMPLEMENTATIE STRUCTUUR

### **Nieuwe Bestanden:**
```
lib/
  ├── lifi-service.ts          # Li.Fi service class
  └── types.ts                 # TypeScript types (uitbreiden)

components/
  └── SwapModal.tsx            # Update met Li.Fi integratie

app/api/
  ├── lifi/
  │   ├── quote/route.ts       # Get swap quote
  │   ├── execute/route.ts     # Execute swap transaction
  │   ├── status/route.ts      # Get transaction status
  │   ├── chains/route.ts      # Get supported chains
  │   └── tokens/route.ts      # Get supported tokens
```

---

## 📦 LI.FI SERVICE CLASS

### **File:** `lib/lifi-service.ts`

**Functionaliteit:**
- ✅ Get quote (same-chain + cross-chain)
- ✅ Get transaction data for execution
- ✅ Get transaction status
- ✅ Get supported chains
- ✅ Get supported tokens
- ✅ Map chain IDs to Li.Fi format
- ✅ Handle native tokens
- ✅ Calculate fees and gas costs

**Key Methods:**
```typescript
class LiFiService {
  // Get quote for swap
  static async getQuote(
    fromChain: number,
    toChain: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    toAddress: string,
    slippage?: number,
    order?: 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST'
  ): Promise<LiFiQuote | null>
  
  // Get transaction data for a step
  static async getStepTransaction(
    route: LiFiQuote,
    stepIndex: number,
    userAddress: string
  ): Promise<LiFiTransaction | null>
  
  // Get transaction status
  static async getStatus(
    txHash: string,
    bridge: string,
    fromChain: number,
    toChain: number
  ): Promise<LiFiStatus | null>
  
  // Get supported chains
  static async getChains(): Promise<LiFiChain[]>
  
  // Get supported tokens
  static async getTokens(chainIds: number[]): Promise<LiFiTokens>
  
  // Map internal chain ID to Li.Fi chain ID
  static mapChainId(chainId: number): number
  
  // Get native token address for Li.Fi
  static getNativeTokenAddress(): string
}
```

---

## 🎨 SWAP MODAL UPDATE

### **Huidige State:**
- ✅ Same-chain swaps only
- ✅ 1inch integration (requires API key)
- ✅ Price estimate fallback
- ✅ "Coming Soon" overlay

### **Nieuwe Features met Li.Fi:**
- ✅ **Same-chain swaps** - Via Li.Fi (beter dan 1inch)
- ✅ **Cross-chain swaps** - ETH → Polygon, Polygon → Arbitrum, etc.
- ✅ **Chain selector** - User kan destination chain kiezen
- ✅ **Multi-step swaps** - Automatisch handling van complexe routes
- ✅ **Real-time status** - Track swap progress
- ✅ **Better rates** - Li.Fi vindt beste route over alle DEXes + bridges

### **UI Updates:**

#### **1. Chain Selector (Nieuw)**
```tsx
<div className="glass-card p-6">
  <label className="text-sm font-medium text-gray-900 mb-2 block">
    From network
  </label>
  <ChainSelector
    selectedChain={fromChain}
    onSelect={setFromChain}
  />
  
  <label className="text-sm font-medium text-gray-900 mb-2 block mt-4">
    To network
  </label>
  <ChainSelector
    selectedChain={toChain}
    onSelect={setToChain}
    allowSameChain={true} // Allow same-chain swaps
  />
</div>
```

#### **2. Quote Display (Uitgebreid)**
```tsx
{quote && (
  <div className="glass-card p-6 space-y-4">
    {/* Main Quote */}
    <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-200 rounded-xl p-6">
      <div className="text-sm text-gray-600 mb-1">You'll receive</div>
      <div className="text-4xl font-bold text-gray-900 mb-1">
        {quote.estimate.toAmount} {quote.action.toToken.symbol}
      </div>
      <div className="text-sm text-gray-600">
        ≈ {quote.estimate.toAmountUSD} USD
      </div>
    </div>
    
    {/* Cross-chain indicator */}
    {fromChain !== toChain && (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-700">
          <ArrowRight className="w-5 h-5" />
          <span className="font-semibold">Cross-chain swap</span>
        </div>
        <div className="text-sm text-blue-600 mt-2">
          Estimated time: {quote.estimate.executionDuration}s
        </div>
      </div>
    )}
    
    {/* Fees Breakdown */}
    <div className="space-y-2 text-sm">
      {quote.estimate.feeCosts.map((fee, i) => (
        <div key={i} className="flex justify-between">
          <span className="text-gray-600">{fee.name}</span>
          <span className="font-semibold text-gray-900">
            {fee.amount} {fee.token.symbol} ({fee.amountUSD} USD)
          </span>
        </div>
      ))}
      
      {quote.estimate.gasCosts.map((gas, i) => (
        <div key={i} className="flex justify-between">
          <span className="text-gray-600">Gas ({gas.type})</span>
          <span className="font-semibold text-gray-900">
            {gas.amount} {gas.token.symbol} ({gas.amountUSD} USD)
          </span>
        </div>
      ))}
      
      <div className="h-px bg-gray-200 my-2" />
      <div className="flex justify-between font-semibold text-base">
        <span className="text-gray-900">Total cost</span>
        <span className="text-gray-900">
          {totalCostUSD} USD
        </span>
      </div>
    </div>
    
    {/* Route Info */}
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="text-xs text-gray-600 mb-2">Route</div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900">{quote.tool}</span>
        {quote.steps.length > 1 && (
          <span className="text-xs text-gray-600">
            ({quote.steps.length} steps)
          </span>
        )}
      </div>
    </div>
  </div>
)}
```

#### **3. Multi-Step Execution (Nieuw)**
```tsx
const executeSwap = async () => {
  if (!quote || !wallet) return;
  
  setIsSwapping(true);
  setCurrentStep(0);
  setTotalSteps(quote.steps.length);
  
  try {
    // Execute each step sequentially
    for (let i = 0; i < quote.steps.length; i++) {
      setCurrentStep(i + 1);
      
      // Get transaction data for this step
      const txData = await LiFiService.getStepTransaction(
        quote,
        i,
        wallet.address
      );
      
      // Check if approval needed
      if (txData.approvalNeeded) {
        // Handle token approval
        await handleTokenApproval(txData.approvalAddress, txData.approvalAmount);
      }
      
      // Execute transaction
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const signer = wallet.connect(provider);
      
      const tx = await signer.sendTransaction({
        to: txData.transactionRequest.to,
        data: txData.transactionRequest.data,
        value: txData.transactionRequest.value || '0',
        gasLimit: txData.transactionRequest.gasLimit,
        gasPrice: txData.transactionRequest.gasPrice,
      });
      
      // Wait for confirmation
      await tx.wait();
      
      // If cross-chain, start status polling
      if (fromChain !== toChain && i === quote.steps.length - 1) {
        pollTransactionStatus(tx.hash, quote);
      }
    }
    
    setSuccess(true);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsSwapping(false);
  }
};
```

---

## 🔄 SWAP FLOW

### **Same-Chain Swap:**
1. User selecteert fromToken en toToken (same chain)
2. User voert amount in
3. Li.Fi quote wordt opgehaald
4. User bevestigt
5. Transaction wordt uitgevoerd
6. Success!

### **Cross-Chain Swap:**
1. User selecteert fromChain en fromToken
2. User selecteert toChain en toToken
3. User voert amount in
4. Li.Fi quote wordt opgehaald (inclusief bridge route)
5. User bevestigt
6. **Step 1:** Approval (als nodig)
7. **Step 2:** Source chain transaction
8. **Step 3:** Bridge transfer (automatisch)
9. **Step 4:** Destination chain transaction (automatisch)
10. Status polling tot completion
11. Success!

---

## 🎯 CHAIN MAPPING

### **Blaze Wallet → Li.Fi Chain IDs:**
```typescript
const CHAIN_MAP: Record<number, number> = {
  1: 1,        // Ethereum
  137: 137,    // Polygon
  56: 56,      // BSC
  42161: 42161, // Arbitrum
  10: 10,      // Optimism
  8453: 8453,  // Base
  43114: 43114, // Avalanche
  250: 250,    // Fantom
  100: 100,    // Gnosis
  1101: 1101,  // Polygon zkEVM
  324: 324,    // zkSync Era
  59144: 59144, // Linea
  // ... meer chains
};
```

### **Native Token Address:**
```typescript
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
```

---

## 🔐 API KEY SETUP

### **Optioneel maar Aanbevolen:**
- **Zonder key:** 200 requests per 2 uur
- **Met key:** 200 requests per minuut

### **Hoe te verkrijgen:**
1. Ga naar https://portal.li.fi/
2. Maak account aan
3. Request API key
4. Voeg toe aan environment variables: `LIFI_API_KEY`

### **Usage:**
```typescript
const headers = {
  'Accept': 'application/json',
  ...(apiKey && { 'x-lifi-api-key': apiKey }),
};
```

---

## 📊 SUPPORTED CHAINS (Blaze Wallet)

### **EVM Chains:**
- ✅ Ethereum (1)
- ✅ Polygon (137)
- ✅ BSC (56)
- ✅ Arbitrum (42161)
- ✅ Optimism (10)
- ✅ Base (8453)
- ✅ Avalanche (43114)
- ✅ Fantom (250)
- ✅ Gnosis (100)
- ✅ Polygon zkEVM (1101)
- ✅ zkSync Era (324)
- ✅ Linea (59144)

### **Non-EVM (Toekomst):**
- ⚠️ Solana (101) - Li.Fi ondersteunt Solana, maar vereist speciale handling
- ⚠️ Bitcoin (0) - Niet direct ondersteund door Li.Fi

---

## 🎨 UI/UX IMPROVEMENTS

### **1. Chain Selector Component**
- Dropdown met chain logos
- "Same chain" optie voor same-chain swaps
- Visual indicator voor cross-chain swaps

### **2. Quote Display**
- Duidelijke breakdown van fees
- Gas costs per chain (voor cross-chain)
- Estimated time (vooral belangrijk bij cross-chain)
- Route visualization (welke DEX/bridge wordt gebruikt)

### **3. Multi-Step Progress**
- Progress bar voor multi-step swaps
- Status per step
- Real-time updates

### **4. Error Handling**
- Duidelijke error messages
- Retry mechanism
- Fallback naar andere routes

---

## 🚀 IMPLEMENTATIE STAPPEN

### **STAP 1: LiFiService Class** (2-3 uur)
- Create `lib/lifi-service.ts`
- Implement all methods
- Add TypeScript types
- Add error handling

### **STAP 2: API Routes** (2-3 uur)
- `/api/lifi/quote` - Get quote
- `/api/lifi/execute` - Execute swap
- `/api/lifi/status` - Get status
- `/api/lifi/chains` - Get chains
- `/api/lifi/tokens` - Get tokens

### **STAP 3: SwapModal Update** (4-6 uur)
- Add chain selector
- Update quote display
- Add multi-step execution
- Add status tracking
- Update error handling

### **STAP 4: Testing** (2-3 uur)
- Test same-chain swaps
- Test cross-chain swaps
- Test error scenarios
- Test with/without API key

### **STAP 5: Documentation** (1 uur)
- Update README
- Add setup guide
- Document API key setup

---

## ⚠️ BELANGRIJKE OVERWEGINGEN

### **1. Token Approvals**
- Li.Fi kan token approvals vereisen
- Moet automatisch worden afgehandeld
- User moet approval transaction signen

### **2. Cross-Chain Timing**
- Cross-chain swaps kunnen 5-30 minuten duren
- Status polling is essentieel
- User moet geïnformeerd blijven

### **3. Slippage**
- Default: 3% (Li.Fi default)
- User moet kunnen aanpassen
- Min/max amounts worden berekend

### **4. Gas Costs**
- Gas wordt betaald op source chain
- Voor cross-chain: mogelijk gas op beide chains
- Duidelijk tonen in UI

### **5. Rate Limits**
- Zonder API key: 200/2h
- Met API key: 200/min
- Implement rate limiting in frontend

---

## 🎯 SUCCESS CRITERIA

### **Functional:**
- ✅ Same-chain swaps werken perfect
- ✅ Cross-chain swaps werken perfect
- ✅ Multi-step swaps worden correct uitgevoerd
- ✅ Status tracking werkt real-time
- ✅ Error handling is robust

### **Performance:**
- ✅ Quote fetching < 2 seconden
- ✅ Transaction execution < 30 seconden (same-chain)
- ✅ Status updates < 5 seconden

### **UX:**
- ✅ Duidelijke UI voor same-chain vs cross-chain
- ✅ Progress indicators voor multi-step swaps
- ✅ Real-time status updates
- ✅ Duidelijke error messages

---

## 💻 CONCRETE CODE VOORBEELDEN

### **1. LiFiService.getQuote() - Volledige Implementatie**

```typescript
// lib/lifi-service.ts
import { logger } from '@/lib/logger';

export interface LiFiQuote {
  id: string;
  action: {
    fromToken: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
      name: string;
      logoURI: string;
      priceUSD: string;
    };
    toToken: {
      address: string;
      symbol: string;
      decimals: number;
      chainId: number;
      name: string;
      logoURI: string;
      priceUSD: string;
    };
    fromAmount: string;
    toAmount: string;
    slippage: number;
    fromChainId: number;
    toChainId: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    approvalAddress: string;
    feeCosts: Array<{
      name: string;
      description: string;
      token: {
        address: string;
        symbol: string;
        decimals: number;
        chainId: number;
        name: string;
        logoURI: string;
        priceUSD: string;
      };
      amount: string;
      amountUSD: string;
    }>;
    gasCosts: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
      amount: string;
      amountUSD: string;
      token: {
        address: string;
        symbol: string;
        decimals: number;
        chainId: number;
        name: string;
        logoURI: string;
        priceUSD: string;
      };
    }>;
    executionDuration: number;
  };
  tool: string;
  integrator: string;
  steps: Array<any>;
}

export class LiFiService {
  private static readonly BASE_URL = 'https://li.quest/v1';
  private static readonly NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  static async getQuote(
    fromChain: number,
    toChain: number,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    toAddress: string,
    slippage: number = 0.03, // 3% default
    order: 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST' = 'RECOMMENDED',
    apiKey?: string
  ): Promise<LiFiQuote | null> {
    try {
      const params = new URLSearchParams({
        fromChain: fromChain.toString(),
        toChain: toChain.toString(),
        fromToken: fromToken === 'native' ? this.NATIVE_TOKEN : fromToken,
        toToken: toToken === 'native' ? this.NATIVE_TOKEN : toToken,
        fromAmount: fromAmount,
        toAddress: toAddress,
        slippage: slippage.toString(),
        order: order,
      });

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${this.BASE_URL}/quote?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Li.Fi quote API error:', response.status, errorData);
        return null;
      }

      const data = await response.json();
      logger.log('✅ Li.Fi quote received:', {
        fromChain,
        toChain,
        tool: data.tool,
        steps: data.steps?.length || 0,
      });

      return data;
    } catch (error) {
      logger.error('Error fetching Li.Fi quote:', error);
      return null;
    }
  }

  static async getStepTransaction(
    route: LiFiQuote,
    stepIndex: number,
    userAddress: string,
    apiKey?: string
  ): Promise<any | null> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${this.BASE_URL}/stepTransaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          route,
          stepIndex,
          userAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Li.Fi stepTransaction API error:', response.status, errorData);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error fetching Li.Fi step transaction:', error);
      return null;
    }
  }

  static async getStatus(
    txHash: string,
    bridge: string,
    fromChain: number,
    toChain: number,
    apiKey?: string
  ): Promise<any | null> {
    try {
      const params = new URLSearchParams({
        txHash,
        bridge,
        fromChain: fromChain.toString(),
        toChain: toChain.toString(),
      });

      const headers: HeadersInit = {
        'Accept': 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const response = await fetch(`${this.BASE_URL}/status?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching Li.Fi status:', error);
      return null;
    }
  }

  static getNativeTokenAddress(): string {
    return this.NATIVE_TOKEN;
  }

  static isNativeToken(address: string): boolean {
    return address.toLowerCase() === this.NATIVE_TOKEN.toLowerCase();
  }
}
```

### **2. API Route - /api/lifi/quote**

```typescript
// app/api/lifi/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromChain = parseInt(searchParams.get('fromChain') || '1');
    const toChain = parseInt(searchParams.get('toChain') || '1');
    const fromToken = searchParams.get('fromToken') || '';
    const toToken = searchParams.get('toToken') || '';
    const fromAmount = searchParams.get('fromAmount') || '0';
    const toAddress = searchParams.get('toAddress') || '';
    const slippage = parseFloat(searchParams.get('slippage') || '0.03');
    const order = (searchParams.get('order') || 'RECOMMENDED') as 'RECOMMENDED' | 'CHEAPEST' | 'FASTEST';

    if (!fromToken || !toToken || !fromAmount || !toAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📊 Fetching Li.Fi quote:', {
      fromChain,
      toChain,
      fromToken: fromToken.substring(0, 10) + '...',
      toToken: toToken.substring(0, 10) + '...',
      fromAmount,
    });

    const quote = await LiFiService.getQuote(
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount,
      toAddress,
      slippage,
      order,
      lifiApiKey
    );

    if (!quote) {
      return NextResponse.json(
        { error: 'Failed to fetch quote from Li.Fi' },
        { status: 500 }
      );
    }

    logger.log('✅ Li.Fi quote received');
    return NextResponse.json({ success: true, quote });

  } catch (error: any) {
    logger.error('Li.Fi quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote', details: error.message },
      { status: 500 }
    );
  }
}
```

### **3. SwapModal Update - Chain Selector**

```tsx
// In SwapModal.tsx - Add chain selector
const [fromChain, setFromChain] = useState(currentChain);
const [toChain, setToChain] = useState(currentChain);

// Chain Selector Component
<div className="glass-card p-6 space-y-6">
  {/* From Chain */}
  <div>
    <label className="text-sm font-medium text-gray-900 mb-2 block">
      From network
    </label>
    <div className="relative">
      <button
        onClick={() => setShowFromChainDropdown(!showFromChainDropdown)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {CHAINS[fromChain]?.logoUrl ? (
            <img 
              src={CHAINS[fromChain].logoUrl} 
              alt={CHAINS[fromChain].name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <span className="text-xl">{CHAINS[fromChain]?.icon}</span>
          )}
          <span>{CHAINS[fromChain]?.name}</span>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>
      
      {showFromChainDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
        >
          {Object.entries(CHAINS)
            .filter(([key, chain]) => !chain.isTestnet)
            .map(([key, chain]) => (
              <button
                key={key}
                onClick={() => {
                  setFromChain(key);
                  setShowFromChainDropdown(false);
                }}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                  fromChain === key ? 'bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {chain.logoUrl ? (
                    <img 
                      src={chain.logoUrl} 
                      alt={chain.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <span className="text-xl">{chain.icon}</span>
                  )}
                  <span className="font-medium text-gray-900">{chain.name}</span>
                </div>
                {fromChain === key && (
                  <Check className="w-5 h-5 text-orange-500" />
                )}
              </button>
            ))}
        </motion.div>
      )}
    </div>
  </div>

  {/* To Chain */}
  <div>
    <label className="text-sm font-medium text-gray-900 mb-2 block">
      To network
    </label>
    <div className="relative">
      <button
        onClick={() => setShowToChainDropdown(!showToChainDropdown)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-900 hover:border-orange-300 transition-colors focus:outline-none focus:border-orange-500 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {CHAINS[toChain]?.logoUrl ? (
            <img 
              src={CHAINS[toChain].logoUrl} 
              alt={CHAINS[toChain].name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <span className="text-xl">{CHAINS[toChain]?.icon}</span>
          )}
          <span>{CHAINS[toChain]?.name}</span>
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </button>
      
      {showToChainDropdown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
        >
          {Object.entries(CHAINS)
            .filter(([key, chain]) => !chain.isTestnet)
            .map(([key, chain]) => (
              <button
                key={key}
                onClick={() => {
                  setToChain(key);
                  setShowToChainDropdown(false);
                }}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors ${
                  toChain === key ? 'bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {chain.logoUrl ? (
                    <img 
                      src={chain.logoUrl} 
                      alt={chain.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <span className="text-xl">{chain.icon}</span>
                  )}
                  <span className="font-medium text-gray-900">{chain.name}</span>
                </div>
                {toChain === key && (
                  <Check className="w-5 h-5 text-orange-500" />
                )}
              </button>
            ))}
        </motion.div>
      )}
    </div>
  </div>
</div>
```

### **4. Multi-Step Execution**

```tsx
const executeSwap = async () => {
  if (!quote || !wallet) return;
  
  setIsSwapping(true);
  setCurrentStep(0);
  setTotalSteps(quote.steps.length);
  setError('');

  try {
    // Execute each step sequentially
    for (let i = 0; i < quote.steps.length; i++) {
      setCurrentStep(i + 1);
      setStepStatus(`Executing step ${i + 1} of ${quote.steps.length}...`);

      // Get transaction data for this step
      const response = await fetch('/api/lifi/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: quote,
          stepIndex: i,
          userAddress: wallet.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get transaction data');
      }

      const { transactionRequest } = await response.json();

      // Check if approval needed
      if (quote.steps[i].estimate.approvalAddress) {
        setStepStatus('Approving token...');
        // Handle token approval
        await handleTokenApproval(
          quote.steps[i].estimate.approvalAddress,
          quote.steps[i].action.fromAmount
        );
      }

      // Execute transaction
      const provider = new ethers.JsonRpcProvider(CHAINS[fromChain].rpcUrl);
      const signer = wallet.connect(provider);

      setStepStatus('Sending transaction...');
      const tx = await signer.sendTransaction({
        to: transactionRequest.to,
        data: transactionRequest.data,
        value: transactionRequest.value || '0',
        gasLimit: transactionRequest.gasLimit,
        gasPrice: transactionRequest.gasPrice,
      });

      setStepStatus('Waiting for confirmation...');
      await tx.wait();

      // If cross-chain and last step, start status polling
      if (fromChain !== toChain && i === quote.steps.length - 1) {
        setStepStatus('Bridge transfer in progress...');
        pollTransactionStatus(tx.hash, quote);
      }
    }

    setSuccess(true);
    setStepStatus('Swap completed!');
  } catch (err: any) {
    logger.error('Swap execution error:', err);
    setError(err.message || 'Swap failed');
    setIsSwapping(false);
  }
};
```

---

## 📚 RESOURCES

### **Li.Fi Documentation:**
- API Docs: https://docs.li.fi/api-reference/introduction
- API Reference: https://apidocs.li.fi/
- Partner Portal: https://portal.li.fi/
- Help Center: https://help.li.fi/

### **Examples:**
- Li.Fi SDK: https://github.com/lifinance/sdk
- Li.Fi Widget: https://github.com/lifinance/widget

---

## ✅ CONCLUSIE

Li.Fi is de **perfecte keuze** voor Blaze Wallet swap functie:

- ✅ **Unified API** - Eén API voor alles
- ✅ **Cross-chain** - Unieke feature
- ✅ **Betere rates** - Aggregeert alles
- ✅ **Geen API key nodig** - Werkt out-of-the-box
- ✅ **70+ chains** - Toekomst-proof
- ✅ **Transaction tracking** - Real-time status

**Implementatie tijd:** ~12-16 uur
**Complexiteit:** ⭐⭐⭐⭐ (4/5) - Medium-High
**Waarde:** ⭐⭐⭐⭐⭐ (5/5) - Zeer hoog

---

---

## 🎨 UI/UX DETAILED DESIGN

### **SwapModal Layout (Nieuw Design):**

```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│  🔥 Swap                                │
│  Exchange tokens at the best rates     │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  From Network: [Ethereum ▼]            │
│  From Token:   [ETH ▼]                 │
│  Amount:       [0.0        ]          │
│                                         │
│              [↓ Swap Arrow]            │
│                                         │
│  To Network:   [Polygon ▼]             │
│  To Token:     [USDC ▼]                │
│  You'll receive: [0.0]                 │
│                                         │
├─────────────────────────────────────────┤
│  Quote Card:                            │
│  ┌─────────────────────────────────┐   │
│  │ You'll receive                  │   │
│  │ 1,234.56 USDC                   │   │
│  │ ≈ $1,234.56 USD                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Cross-chain indicator if different]  │
│                                         │
│  Fees Breakdown:                        │
│  - Bridge fee: 0.5 USDC                │
│  - Gas (Ethereum): 0.001 ETH           │
│  - Gas (Polygon): 0.01 MATIC          │
│  ────────────────────────────────      │
│  Total cost: $12.34 USD                │
│                                         │
│  Route: Stargate (2 steps)             │
│                                         │
├─────────────────────────────────────────┤
│  [Swap now] Button                     │
│                                         │
└─────────────────────────────────────────┘
```

### **Multi-Step Progress Indicator:**

```tsx
{isSwapping && (
  <div className="glass-card p-6">
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-900">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-600">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <motion.div
          className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
    <p className="text-sm text-gray-600 text-center">{stepStatus}</p>
  </div>
)}
```

### **Cross-Chain Indicator:**

```tsx
{fromChain !== toChain && (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
        <ArrowRight className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900 mb-1">Cross-chain swap</div>
        <div className="text-sm text-gray-600">
          Estimated time: {quote.estimate.executionDuration}s
        </div>
      </div>
    </div>
  </motion.div>
)}
```

---

## 🔄 MIGRATION STRATEGY

### **Optie A: Volledige Vervanging (Aanbevolen)**
- ✅ Vervang 1inch volledig met Li.Fi
- ✅ Simpler codebase
- ✅ Eén swap provider
- ✅ Cross-chain support direct beschikbaar

### **Optie B: Hybrid Approach**
- ⚠️ Li.Fi als primary, 1inch als fallback
- ⚠️ Complexer codebase
- ⚠️ Twee providers onderhouden

**Aanbeveling: Optie A** - Li.Fi is superieur in alle opzichten

---

## 📋 IMPLEMENTATIE CHECKLIST

### **Phase 1: Foundation (4-6 uur)**
- [ ] Create `lib/lifi-service.ts` with all methods
- [ ] Add TypeScript types for Li.Fi responses
- [ ] Create API route `/api/lifi/quote`
- [ ] Create API route `/api/lifi/execute`
- [ ] Create API route `/api/lifi/status`
- [ ] Test API routes standalone

### **Phase 2: SwapModal Update (4-6 uur)**
- [ ] Add chain selector (from + to)
- [ ] Update quote fetching to use Li.Fi
- [ ] Update quote display with new format
- [ ] Add cross-chain indicator
- [ ] Add multi-step progress indicator
- [ ] Update swap execution logic
- [ ] Add status polling for cross-chain

### **Phase 3: Testing & Polish (2-3 uur)**
- [ ] Test same-chain swaps
- [ ] Test cross-chain swaps
- [ ] Test error scenarios
- [ ] Test with/without API key
- [ ] Polish UI/UX
- [ ] Add loading states
- [ ] Add error messages

### **Phase 4: Documentation (1 uur)**
- [ ] Update README
- [ ] Add setup guide
- [ ] Document API key setup
- [ ] Add code comments

---

## 🎯 EXACTE STYLING MATCH

### **Alle elementen matchen 100% met Send/Receive/Buy:**

✅ **Header:** Identiek aan andere modals
✅ **Back Button:** Identiek styling
✅ **Glass Cards:** `glass-card p-6` (exact zelfde)
✅ **Primary Buttons:** `bg-gradient-to-r from-orange-500 to-yellow-500` (exact zelfde)
✅ **Input Fields:** `input-field` class (exact zelfde)
✅ **Dropdowns:** Border-2, hover states, orange accents (exact zelfde)
✅ **Loading States:** `Loader2` met orange-500 (exact zelfde)
✅ **Success States:** Emerald-500 checkmark (exact zelfde)
✅ **Error States:** Red-50 border red-200 (exact zelfde)
✅ **Spacing:** `space-y-6`, `gap-3`, `mb-6` (exact zelfde)
✅ **Typography:** `text-2xl font-bold text-gray-900` (exact zelfde)
✅ **Colors:** Orange-500, yellow-500, gray-900, gray-600 (exact zelfde)

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### **1. Quote Caching**
- Cache quotes voor 10 seconden
- Voorkomt onnodige API calls tijdens typing

### **2. Debouncing**
- 500ms debounce op quote fetching
- Alleen fetch als user stopt met typen

### **3. Lazy Loading**
- Load tokens alleen als chain wordt geselecteerd
- Reduceert initial load time

### **4. Status Polling**
- Poll elke 5 seconden (niet te vaak)
- Stop na 5 minuten (timeout)

---

## 🔒 SECURITY CONSIDERATIONS

### **1. API Key Beveiliging**
- ✅ NOOIT API key in client code
- ✅ Server-side API routes gebruiken
- ✅ Environment variables alleen op server

### **2. Transaction Validation**
- ✅ Validate amounts before execution
- ✅ Check slippage limits
- ✅ Verify token addresses

### **3. Error Handling**
- ✅ Catch all errors gracefully
- ✅ Log errors for debugging
- ✅ User-friendly error messages

---

## 🎉 READY TO IMPLEMENT!

Dit plan zorgt voor een **100% perfecte Li.Fi integratie** die:
- ✅ Volledig naadloos aansluit bij Blaze Wallet styling
- ✅ Same-chain EN cross-chain swaps ondersteunt
- ✅ Multi-step swaps correct afhandelt
- ✅ Real-time status tracking heeft
- ✅ Perfecte error handling heeft
- ✅ Geen API key vereist (maar ondersteunt het wel)

**Het zal de beste swap functie zijn die je ooit hebt gezien!** 🔥

