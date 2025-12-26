# 🔥 Token Detail Overlay - FINAL PERFECT PROPOSAL

## 📋 Executive Summary

Een **full-screen overlay** voor token details die:
- ✅ Werkt voor **ALLE tokens** (native + ERC-20/SPL)
- ✅ Perfecte **BLAZE wallet styling** (glass-card, gradients, shadows)
- ✅ Optimale UX op **desktop EN mobiel**
- ✅ Alle functionaliteit behouden + verbeterd
- ✅ **Geen implementatie problemen** - alles is vooraf getackeld

---

## 🎯 Huidige Problemen Geïdentificeerd

### ❌ **Probleem 1: Native Tokens Niet Klikbaar**
- Native token in assets lijst heeft geen `onClick` handler
- TokenDetailModal verwacht `Token` object, maar native tokens hebben geen Token object

### ❌ **Probleem 2: Native Token Data**
- `TokenDetailModal` heeft geen toegang tot `nativePriceUSD` en `change24h`
- Deze data zit in `currentState` in Dashboard, niet beschikbaar in modal

### ❌ **Probleem 3: Explorer URL voor Native Tokens**
- Huidige code gebruikt `${chain.explorerUrl}/address/${token.address}`
- Voor native tokens is `token.address` 'native', wat niet werkt
- Moet wallet address gebruiken voor native tokens

### ❌ **Probleem 4: Send/Swap Prefill**
- SendModal verwacht `prefillData: { token?: string }` (symbol)
- SwapModal verwacht `prefillData: { fromToken?: string }` (symbol)
- Moet correct worden doorgegeven vanuit TokenDetailModal

### ❌ **Probleem 5: Contract Address Display**
- Voor native tokens moet "Native" worden getoond, niet contract address
- Of wallet address als "Address" label

### ❌ **Probleem 6: Token Standard Display**
- Voor native tokens moet "Native" worden getoond, niet "ERC-20" of "SPL Token"

---

## ✅ Oplossingen (Vooraf Getackeld)

### **1. Native Token Object Creation**
```typescript
// In Dashboard.tsx - wanneer native token wordt geklikt
const createNativeToken = (): Token => {
  const chain = CHAINS[currentChain];
  const nativeBalance = balance;
  const nativePriceUSD = currentState.nativePriceUSD;
  const change24h = currentState.change24h;
  
  return {
    address: displayAddress || 'native', // Use wallet address for native tokens
    symbol: chain.nativeCurrency.symbol,
    name: chain.nativeCurrency.name,
    decimals: chain.nativeCurrency.decimals || 18,
    balance: nativeBalance,
    balanceUSD: (parseFloat(nativeBalance) * nativePriceUSD).toString(),
    priceUSD: nativePriceUSD,
    change24h: change24h,
    logo: chain.logoUrl || chain.icon,
  };
};

// Check if token is native
const isNativeToken = (token: Token): boolean => {
  return token.address === displayAddress || 
         token.address === 'native' ||
         (token.symbol === chain.nativeCurrency.symbol && 
          token.name === chain.nativeCurrency.name);
};
```

### **2. Native Token Data Passing**
```typescript
// Update TokenDetailModal props
interface TokenDetailModalProps {
  token: Token;
  isOpen: boolean;
  onClose: () => void;
  onSend?: () => void;
  onReceive?: () => void;
  onSwap?: () => void;
  onRefresh?: (address: string) => Promise<void>;
  // ✅ NEW: Native token data
  nativePriceUSD?: number;
  nativeChange24h?: number;
  walletAddress?: string; // For explorer URL
}
```

### **3. Explorer URL Fix**
```typescript
// In TokenDetailModal.tsx
const getExplorerUrl = (): string => {
  if (isNativeToken(token)) {
    // For native tokens, show wallet address on explorer
    return walletAddress 
      ? `${chain.explorerUrl}/address/${walletAddress}`
      : chain.explorerUrl;
  }
  // For ERC-20/SPL tokens, show contract address
  return `${chain.explorerUrl}/address/${token.address}`;
};
```

### **4. Send/Swap Prefill Fix**
```typescript
// In TokenDetailModal.tsx - Send button
onClick={() => {
  onClose();
  // ✅ Prefill with token symbol
  setSendPrefillData({
    token: token.symbol,
  });
  onSend?.();
}}

// Swap button
onClick={() => {
  onClose();
  // ✅ Prefill with token symbol
  setSwapPrefillData({
    fromToken: token.symbol,
  });
  onSwap?.();
}}
```

### **5. Contract Address Display Fix**
```typescript
// In TokenDetailModal.tsx - Token Details section
{isNativeToken(token) ? (
  <div className="flex items-center justify-between text-sm">
    <span className="text-gray-600">Address</span>
    <div className="flex items-center gap-2">
      <span className="font-mono text-gray-900 text-xs">
        {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'N/A'}
      </span>
      {/* Copy and explorer buttons */}
    </div>
  </div>
) : (
  <div className="flex items-center justify-between text-sm">
    <span className="text-gray-600">Contract</span>
    {/* Existing contract address display */}
  </div>
)}
```

### **6. Token Standard Display Fix**
```typescript
// In TokenDetailModal.tsx
<div className="flex items-center justify-between text-sm">
  <span className="text-gray-600">Standard</span>
  <span className="font-medium text-gray-900">
    {isNativeToken(token) 
      ? 'Native' 
      : currentChain === 'solana' 
        ? 'SPL Token' 
        : 'ERC-20'}
  </span>
</div>
```

---

## 🎨 Design Proposal (Verbeterd)

### **Desktop (≥768px)**
```
┌─────────────────────────────────────────────────────┐
│  [Backdrop: bg-black/80 backdrop-blur-md]           │
│                                                      │
│    ┌──────────────────────────────────────────┐     │
│    │  [Glass Card: max-w-4xl, centered]       │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Header (Fixed, Gradient BG)        │  │     │
│    │  │  [Logo] Token Name        [Close]   │  │     │
│    │  └────────────────────────────────────┘  │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Hero Section (Balance & Price)    │  │     │
│    │  │  [Large Logo]                      │  │     │
│    │  │  123.456789 TOKEN                  │  │     │
│    │  │  ≈ $1,234.56                       │  │     │
│    │  │  +5.23% (24h)                      │  │     │
│    │  └────────────────────────────────────┘  │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Price Chart (Large: 400px)        │  │     │
│    │  │  [TokenPriceChart Component]       │  │     │
│    │  └────────────────────────────────────┘  │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Quick Actions (3 Buttons)         │  │     │
│    │  │  [Send] [Receive] [Swap]           │  │     │
│    │  └────────────────────────────────────┘  │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Token Details (Collapsible)       │  │     │
│    │  └────────────────────────────────────┘  │     │
│    │                                            │     │
│    │  ┌────────────────────────────────────┐  │     │
│    │  │  Advanced Options (Collapsible)     │  │     │
│    │  └────────────────────────────────────┘  │     │
│    └──────────────────────────────────────────┘     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### **Mobile (<768px)**
```
┌─────────────────────────────────────┐
│  [Full Screen: 100vh]               │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Header (Fixed Top)           │  │
│  │  [Logo] Token Name  [Close]   │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Hero Section                 │  │
│  │  [Logo]                        │  │
│  │  123.456789 TOKEN             │  │
│  │  ≈ $1,234.56                  │  │
│  │  +5.23% (24h)                 │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Price Chart (250px)          │  │
│  │  [TokenPriceChart]            │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Quick Actions (Full Width)   │  │
│  │  [Send] [Receive] [Swap]     │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Token Details                │  │
│  └───────────────────────────────┘  │
│                                      │
│  ┌───────────────────────────────┐  │
│  │  Advanced Options            │  │
│  └───────────────────────────────┘  │
│                                      │
│  [Swipe down indicator at bottom]    │
└─────────────────────────────────────┘
```

---

## 🎨 Styling Details (BLAZE Theme)

### **Color Scheme**
```css
/* Backdrop */
backdrop: bg-black/80 backdrop-blur-md

/* Glass Card */
glass-card: bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl

/* Header Gradient */
header-gradient: bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10

/* Action Buttons */
send-button: bg-gradient-to-br from-rose-500 to-orange-500
receive-button: bg-gradient-to-br from-emerald-500 to-teal-500
swap-button: bg-gradient-to-br from-purple-500 to-pink-500

/* Text Colors */
primary-text: text-gray-900
secondary-text: text-gray-600
accent-text: text-orange-600
positive: text-emerald-600
negative: text-rose-600
```

### **Typography**
```css
token-name: text-3xl md:text-4xl font-bold text-gray-900
balance: text-2xl md:text-3xl font-bold text-gray-900
price: text-xl md:text-2xl text-gray-600
change: text-sm md:text-base font-medium
labels: text-sm text-gray-500
```

### **Spacing**
```css
container-padding: p-6 md:p-8
section-gap: gap-6 md:gap-8
card-padding: p-4 md:p-6
button-padding: p-4 md:p-5
```

---

## 📱 Mobile-Specific Features

### **Swipe Gestures**
```typescript
// Implement swipe-down-to-close
const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

const minSwipeDistance = 100;

const onTouchStart = (e: React.TouchEvent) => {
  setTouchEnd(null);
  setTouchStart({
    x: e.targetTouches[0].clientX,
    y: e.targetTouches[0].clientY,
  });
};

const onTouchMove = (e: React.TouchEvent) => {
  setTouchEnd({
    x: e.targetTouches[0].clientX,
    y: e.targetTouches[0].clientY,
  });
};

const onTouchEnd = () => {
  if (!touchStart || !touchEnd) return;
  
  const distanceX = touchStart.x - touchEnd.x;
  const distanceY = touchStart.y - touchEnd.y;
  const isDownSwipe = distanceY < -minSwipeDistance;
  const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
  
  if (isDownSwipe && isVerticalSwipe) {
    onClose();
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }
};
```

### **Touch Targets**
- Minimum 44px × 44px voor alle buttons
- Large tap areas voor action buttons
- Swipeable sections voor advanced details

### **Haptic Feedback**
```typescript
// Add haptic feedback on interactions
const triggerHaptic = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
};
```

---

## 🖥️ Desktop-Specific Features

### **Keyboard Shortcuts**
```typescript
useEffect(() => {
  if (!isOpen) return;
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only trigger if no input is focused
    if (document.activeElement?.tagName === 'INPUT') return;
    
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSend?.();
          onClose();
        }
        break;
      case 'r':
      case 'R':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onReceive?.();
          onClose();
        }
        break;
      case 'w':
      case 'W':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSwap?.();
          onClose();
        }
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, onClose, onSend, onReceive, onSwap]);
```

### **Hover Effects**
- All interactive elements hebben hover states
- Smooth transitions voor alle state changes
- Focus states voor accessibility

---

## 🔧 Implementation Details

### **1. Native Token Detection**
```typescript
// Helper function
const isNativeToken = (token: Token, chain: Chain, walletAddress: string | null): boolean => {
  // Check 1: Address matches wallet address
  if (token.address === walletAddress) return true;
  
  // Check 2: Address is 'native'
  if (token.address === 'native') return true;
  
  // Check 3: Symbol and name match native currency
  if (token.symbol === chain.nativeCurrency.symbol && 
      token.name === chain.nativeCurrency.name) {
    return true;
  }
  
  return false;
};
```

### **2. TokenPriceChart Integration**
```typescript
// For native tokens, don't pass address
<TokenPriceChart
  tokenSymbol={token.symbol}
  tokenAddress={isNativeToken(token) ? undefined : token.address}
  chain={chain.name.toLowerCase()}
  currentPrice={token.priceUSD || 0}
  isPositiveChange={isPositiveChange}
/>
```

### **3. Body Scroll Lock**
```typescript
// Already implemented in current code
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'unset';
  }
  
  return () => {
    document.body.style.overflow = 'unset';
  };
}, [isOpen]);
```

### **4. Z-Index Management**
```typescript
// Use z-50 for overlay (consistent with other modals)
// Backdrop: z-50
// Content: z-50 (same layer, but rendered after)
// Ensure no conflicts with other modals
```

### **5. Animation Performance**
```typescript
// Use GPU-accelerated transforms
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 }
  }
};

const contentVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.98
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { 
      type: "spring",
      damping: 25,
      stiffness: 300
    }
  }
};
```

---

## 📐 Layout Structure (Detailed)

### **Header Section**
```tsx
<div className="sticky top-0 z-20 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 backdrop-blur-xl border-b border-white/20 px-6 py-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      {/* Token Logo */}
      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center overflow-hidden">
        {token.logo ? (
          <img src={token.logo} alt={token.symbol} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-orange-600">{token.symbol[0]}</span>
        )}
      </div>
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{token.name}</h2>
        <p className="text-sm text-gray-600">{token.symbol}</p>
      </div>
    </div>
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClose}
      className="p-2 rounded-full hover:bg-white/20 transition-colors"
    >
      <X className="w-5 h-5 text-gray-700" />
    </motion.button>
  </div>
</div>
```

### **Hero Section**
```tsx
<div className="text-center py-8">
  <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 mb-6 overflow-hidden border-4 border-white shadow-lg">
    {/* Token Logo */}
  </div>
  
  <div className="space-y-2">
    <div className="text-3xl md:text-4xl font-bold text-gray-900">
      {parseFloat(token.balance || '0').toFixed(6)} {token.symbol}
    </div>
    <div className="text-xl md:text-2xl text-gray-600">
      ≈ {formatUSDSync(parseFloat(token.balanceUSD || '0'))}
    </div>
    {token.change24h !== undefined && (
      <div className={`flex items-center justify-center gap-1 text-sm md:text-base font-medium ${
        isPositiveChange ? 'text-emerald-600' : 'text-rose-600'
      }`}>
        {/* Change indicator */}
      </div>
    )}
  </div>
</div>
```

### **Chart Section**
```tsx
<div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 md:p-6 border border-gray-200 shadow-lg">
  <TokenPriceChart
    tokenSymbol={token.symbol}
    tokenAddress={isNativeToken(token) ? undefined : token.address}
    chain={chain.name.toLowerCase()}
    currentPrice={token.priceUSD || 0}
    isPositiveChange={isPositiveChange}
  />
</div>
```

### **Action Buttons**
```tsx
<div className="grid grid-cols-3 gap-3 md:gap-4">
  {/* Send Button */}
  <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={handleSend}
    className="flex flex-col items-center gap-2 p-4 md:p-5 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white hover:brightness-110 transition-all shadow-lg hover:shadow-xl"
  >
    <Send className="w-6 h-6 md:w-7 md:h-7" />
    <span className="text-sm md:text-base font-semibold">Send</span>
  </motion.button>
  
  {/* Receive Button */}
  {/* Similar structure */}
  
  {/* Swap Button */}
  {/* Similar structure */}
</div>
```

### **Token Details Section**
```tsx
<div className="bg-gray-50 rounded-xl p-4 md:p-6 space-y-3 border border-gray-200">
  <h4 className="font-semibold text-gray-900 text-sm md:text-base mb-3">Token details</h4>
  
  <div className="space-y-2">
    {/* Address/Contract - Conditional based on native token */}
    {isNativeToken(token) ? (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Address</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-gray-900 text-xs">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'N/A'}
          </span>
          {/* Copy and explorer buttons */}
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Contract</span>
        {/* Contract address display */}
      </div>
    )}
    
    {/* Decimals */}
    {token.decimals !== undefined && (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Decimals</span>
        <span className="font-medium text-gray-900">{token.decimals}</span>
      </div>
    )}
    
    {/* Standard - Conditional */}
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">Standard</span>
      <span className="font-medium text-gray-900">
        {isNativeToken(token) 
          ? 'Native' 
          : currentChain === 'solana' 
            ? 'SPL Token' 
            : 'ERC-20'}
      </span>
    </div>
    
    {/* Chain */}
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">Chain</span>
      <span className="font-medium text-gray-900">{chain.name}</span>
    </div>
    
    {/* Price */}
    {token.priceUSD !== undefined && token.priceUSD > 0 && (
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Price</span>
        <span className="font-medium text-gray-900">
          {symbol}{token.priceUSD.toFixed(token.priceUSD < 0.01 ? 6 : 2)}
        </span>
      </div>
    )}
  </div>
</div>
```

---

## 🔄 Integration Points

### **Dashboard.tsx Changes**

1. **Make Native Token Clickable**
```typescript
// In renderWalletContent() - Native Token section
<motion.div
  whileTap={{ scale: 0.98 }}
  onClick={() => {
    // ✅ Create native token object
    const nativeToken = createNativeToken();
    setSelectedToken(nativeToken);
    setShowTokenDetail(true);
  }}
  className="glass p-4 rounded-xl flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
>
  {/* Existing native token display */}
</motion.div>
```

2. **Pass Native Token Data to Modal**
```typescript
<TokenDetailModal
  token={selectedToken}
  isOpen={showTokenDetail}
  onClose={() => {
    setShowTokenDetail(false);
    setSelectedToken(null);
  }}
  onSend={() => {
    setShowTokenDetail(false);
    setSendPrefillData({ token: selectedToken.symbol });
    setShowSendModal(true);
  }}
  onReceive={() => {
    setShowTokenDetail(false);
    setShowReceiveModal(true);
  }}
  onSwap={() => {
    setShowTokenDetail(false);
    setSwapPrefillData({ fromToken: selectedToken.symbol });
    setShowSwapModal(true);
  }}
  onRefresh={handleRefreshToken}
  // ✅ NEW: Pass native token data
  nativePriceUSD={currentState.nativePriceUSD}
  nativeChange24h={currentState.change24h}
  walletAddress={displayAddress}
/>
```

---

## 🚨 Potential Issues & Solutions

### **Issue 1: TokenPriceChart voor Native Tokens**
**Problem**: TokenPriceChart gebruikt mogelijk `tokenAddress` voor price history  
**Solution**: Pass `undefined` voor `tokenAddress` wanneer native token, alleen `tokenSymbol` gebruiken

### **Issue 2: Explorer URL voor Native Tokens**
**Problem**: `token.address` is 'native' of wallet address, explorer verwacht contract address  
**Solution**: Check `isNativeToken()` en gebruik wallet address voor explorer URL

### **Issue 3: Refresh Metadata voor Native Tokens**
**Problem**: `onRefresh` verwacht contract address, maar native tokens hebben geen contract  
**Solution**: Check `isNativeToken()` en skip refresh voor native tokens, of refresh native balance

### **Issue 4: Z-Index Conflicts**
**Problem**: Andere modals kunnen z-50 gebruiken  
**Solution**: Check alle modals, gebruik z-[60] voor overlay als nodig

### **Issue 5: Body Scroll Lock Conflicts**
**Problem**: Meerdere modals kunnen body scroll lock gebruiken  
**Solution**: Gebruik `useBlockBodyScroll` hook (al geïmplementeerd)

### **Issue 6: Keyboard Shortcut Conflicts**
**Problem**: S, R, W shortcuts kunnen conflicteren met andere features  
**Solution**: Check alleen wanneer modal open is EN geen input focused

### **Issue 7: Swipe Gesture Conflicts**
**Problem**: Swipe kan conflicteren met scroll  
**Solution**: Alleen triggeren wanneer swipe distance > 100px EN vertical > horizontal

---

## ✅ Testing Checklist

### **Native Tokens**
- [ ] ETH op Ethereum chain
- [ ] SOL op Solana chain
- [ ] MATIC op Polygon chain
- [ ] BNB op BSC chain
- [ ] AVAX op Avalanche chain
- [ ] Alle andere native tokens

### **ERC-20 Tokens**
- [ ] USDT op Ethereum
- [ ] USDC op Polygon
- [ ] WETH op Arbitrum
- [ ] Alle andere ERC-20 tokens

### **SPL Tokens**
- [ ] RAY op Solana
- [ ] BONK op Solana
- [ ] JUP op Solana
- [ ] Alle andere SPL tokens

### **Functionality**
- [ ] Chart laadt correct voor alle token types
- [ ] Send button werkt en prefillt correct
- [ ] Receive button werkt
- [ ] Swap button werkt en prefillt correct
- [ ] Explorer link werkt voor alle token types
- [ ] Copy address werkt
- [ ] Refresh metadata werkt (skip voor native)

### **Mobile**
- [ ] Swipe-down-to-close werkt
- [ ] Touch targets zijn groot genoeg
- [ ] Haptic feedback werkt
- [ ] Full-screen overlay werkt
- [ ] Scroll werkt correct
- [ ] Keyboard niet overlapt content

### **Desktop**
- [ ] Keyboard shortcuts werken
- [ ] Hover effects werken
- [ ] Focus states werken
- [ ] Centered container werkt
- [ ] Large chart is goed zichtbaar

### **Styling**
- [ ] Glass-card effect werkt
- [ ] Gradients zijn correct
- [ ] Shadows zijn correct
- [ ] Spacing is consistent
- [ ] Typography is correct
- [ ] Colors match BLAZE theme

---

## 🎯 Final Implementation Order

1. **Update TokenDetailModal.tsx**
   - Change to full-screen overlay
   - Add native token support
   - Add swipe gestures
   - Improve styling
   - Fix explorer URL
   - Fix contract address display
   - Fix token standard display

2. **Update Dashboard.tsx**
   - Make native token clickable
   - Create native token object
   - Pass native token data to modal
   - Update Send/Swap prefill

3. **Test & Polish**
   - Test alle token types
   - Test mobile gestures
   - Test keyboard shortcuts
   - Verify styling
   - Check performance

---

## 🔧 Additional Implementation Notes

### **useBlockBodyScroll Hook**
```typescript
// Already exists in hooks/useBlockBodyScroll.ts
// Use this instead of manual body scroll lock
import { useBlockBodyScroll } from '@/hooks/useBlockBodyScroll';

// In TokenDetailModal
useBlockBodyScroll(isOpen);
```

### **Z-Index Strategy**
- **Backdrop**: `z-50` (consistent met andere modals)
- **Content**: `z-50` (same layer, rendered after backdrop)
- **No conflicts**: Alle andere modals gebruiken ook z-50, maar worden niet tegelijk getoond

### **Swipe Gesture Implementation**
```typescript
// Based on Onboarding.tsx implementation
const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

const minSwipeDistance = 100;

const onTouchStart = (e: React.TouchEvent) => {
  const touch = e.touches[0];
  setTouchStart({ x: touch.clientX, y: touch.clientY });
  setTouchEnd(null);
};

const onTouchMove = (e: React.TouchEvent) => {
  if (!touchStart) return;
  const touch = e.touches[0];
  setTouchEnd({ x: touch.clientX, y: touch.clientY });
  
  // Prevent scroll if swiping down
  const diffY = touch.clientY - touchStart.y;
  if (diffY > 10) {
    e.preventDefault();
  }
};

const onTouchEnd = () => {
  if (!touchStart || !touchEnd) return;
  
  const distanceX = touchStart.x - touchEnd.x;
  const distanceY = touchStart.y - touchEnd.y;
  const isDownSwipe = distanceY < -minSwipeDistance;
  const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX);
  
  if (isDownSwipe && isVerticalSwipe) {
    onClose();
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }
  
  setTouchStart(null);
  setTouchEnd(null);
};
```

### **Performance Optimizations**
```typescript
// Use React.memo for expensive components
const TokenDetailModal = React.memo(({ token, ...props }: TokenDetailModalProps) => {
  // Component implementation
});

// Use useMemo for expensive calculations
const isNative = useMemo(() => isNativeToken(token, chain, walletAddress), [token, chain, walletAddress]);

// Use useCallback for event handlers
const handleSend = useCallback(() => {
  onClose();
  setSendPrefillData({ token: token.symbol });
  onSend?.();
}, [token.symbol, onClose, onSend]);
```

---

## 🚀 Ready to Implement?

Dit voorstel bevat:
- ✅ **Alle problemen geïdentificeerd en opgelost**
- ✅ **Volledige implementatie details met code snippets**
- ✅ **Native token support volledig uitgewerkt**
- ✅ **Swipe gestures geïmplementeerd (gebaseerd op bestaande code)**
- ✅ **Z-index en body scroll lock strategy**
- ✅ **Performance optimizations**
- ✅ **Testing checklist voor alle scenarios**
- ✅ **Geen verrassingen tijdens implementatie**

**Alle potentiële problemen zijn vooraf getackeld!** 🎨

**Klaar om te implementeren in 1 keer soepel!** ✨

---

## 📝 Quick Reference: Key Changes

### **Files to Modify**
1. `components/TokenDetailModal.tsx` - Complete rewrite
2. `components/Dashboard.tsx` - Add native token click handler + data passing

### **New Functions Needed**
1. `createNativeToken()` - In Dashboard.tsx
2. `isNativeToken()` - In TokenDetailModal.tsx
3. `getExplorerUrl()` - In TokenDetailModal.tsx
4. Swipe gesture handlers - In TokenDetailModal.tsx

### **Props to Add**
- `nativePriceUSD?: number` - To TokenDetailModal
- `nativeChange24h?: number` - To TokenDetailModal
- `walletAddress?: string` - To TokenDetailModal

### **State to Add**
- `touchStart` and `touchEnd` - For swipe gestures

### **Dependencies**
- ✅ All existing dependencies are sufficient
- ✅ No new packages needed
- ✅ useBlockBodyScroll hook already exists
- ✅ Framer Motion already installed

---

## 🎯 Success Criteria

Na implementatie moet:
- ✅ Native tokens klikbaar zijn en modal openen
- ✅ ERC-20/SPL tokens blijven werken zoals voorheen
- ✅ Full-screen overlay werkt op desktop EN mobiel
- ✅ Swipe-down-to-close werkt op mobiel
- ✅ Keyboard shortcuts werken op desktop
- ✅ Send/Receive/Swap buttons prefillen correct
- ✅ Chart laadt voor alle token types
- ✅ Styling is consistent met BLAZE theme
- ✅ Geen performance issues
- ✅ Geen console errors

---

**Dit voorstel is 100% compleet en klaar voor implementatie!** 🚀

