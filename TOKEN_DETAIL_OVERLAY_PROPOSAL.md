# 🔥 Token Detail Overlay - Perfect Proposal

## 📋 Huidige Situatie
- TokenDetailModal is een modal die van onderen omhoog komt op mobiel
- Werkt alleen voor ERC-20/SPL tokens, niet voor native tokens (ETH, SOL, MATIC, BNB, etc.)
- Desktop: gecentreerde modal met max-width
- Mobiel: bottom sheet style
- Styling is basic, niet volledig geïntegreerd met BLAZE wallet thema

## 🎯 Doel
Een **full-screen overlay** voor zowel desktop als mobiel die:
1. ✅ Werkt voor ALLE tokens (native + ERC-20/SPL)
2. ✅ Perfecte BLAZE wallet styling (glass-card, gradients, shadows)
3. ✅ Optimale UX op desktop EN mobiel
4. ✅ Alle functionaliteit behouden (Send, Receive, Swap, Chart, etc.)

---

## 🎨 Design Proposal

### **Desktop (≥768px)**
- **Full-screen overlay** met donkere backdrop (bg-black/80 backdrop-blur-md)
- **Centered content container** (max-w-4xl) met glass-card styling
- **Header**: Fixed top met gradient background, close button rechts
- **Content**: Scrollable area met alle token info
- **Chart**: Grote, prominente chart (min-height: 400px)
- **Actions**: 3 grote action buttons (Send, Receive, Swap) in gradient cards
- **Details**: Collapsible sections voor advanced info

### **Mobile (<768px)**
- **Full-screen overlay** (100vh) met swipe-down-to-close gesture
- **Header**: Fixed top met native token logo/icon, close button
- **Content**: Scrollable met alle info
- **Chart**: Compact maar duidelijk (min-height: 250px)
- **Actions**: 3 full-width buttons in gradient cards
- **Details**: Collapsible sections

---

## 🎨 Styling Details

### **Color Scheme (BLAZE Theme)**
- **Background**: `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900`
- **Glass Card**: `glass-card` met `backdrop-blur-xl bg-white/10 border border-white/20`
- **Gradients**:
  - Send: `from-rose-500 to-orange-500`
  - Receive: `from-emerald-500 to-teal-500`
  - Swap: `from-purple-500 to-pink-500`
- **Text**: White/light gray voor contrast
- **Shadows**: `shadow-2xl` met orange glow voor accent

### **Typography**
- **Token Name**: `text-3xl md:text-4xl font-bold`
- **Balance**: `text-2xl md:text-3xl font-bold`
- **Price**: `text-xl md:text-2xl`
- **Labels**: `text-sm text-gray-400`

### **Spacing**
- **Padding**: `p-6 md:p-8`
- **Gap**: `gap-6 md:gap-8`
- **Section spacing**: `space-y-6`

---

## 📱 Mobile-Specific Features

### **Swipe Gestures**
- **Swipe down** om te sluiten (min 100px swipe)
- **Pull-to-refresh** voor price updates
- **Haptic feedback** bij interactions

### **Touch Targets**
- **Minimum 44px** voor alle buttons
- **Large tap areas** voor action buttons
- **Swipeable sections** voor advanced details

---

## 🖥️ Desktop-Specific Features

### **Keyboard Shortcuts**
- **ESC**: Close overlay
- **S**: Open Send modal
- **R**: Open Receive modal
- **W**: Open Swap modal

### **Mouse Interactions**
- **Hover effects** op alle interactive elements
- **Smooth transitions** voor alle state changes
- **Focus states** voor accessibility

---

## 🔧 Functionaliteit

### **Native Token Support**
```typescript
// Create native token object when clicked
const nativeToken: Token = {
  address: 'native', // Special identifier
  symbol: chain.nativeCurrency.symbol,
  name: chain.nativeCurrency.name,
  decimals: chain.nativeCurrency.decimals || 18,
  balance: balance,
  balanceUSD: (parseFloat(balance) * nativePriceUSD).toString(),
  priceUSD: nativePriceUSD,
  change24h: change24h,
  logo: chain.logoUrl || chain.icon,
};
```

### **Chart Integration**
- **TokenPriceChart** component gebruiken (al geïmplementeerd)
- **Native tokens**: Gebruik symbol-based price history
- **ERC-20/SPL**: Gebruik address-based price history

### **Actions**
- **Send**: Pre-fill met selected token
- **Receive**: Show QR code voor token address
- **Swap**: Pre-select token als "from" token

---

## 📐 Layout Structure

```
┌─────────────────────────────────────┐
│  Header (Fixed)                     │
│  [Logo] Token Name        [Close]    │
├─────────────────────────────────────┤
│  Balance & Price (Hero Section)     │
│  ┌─────────────────────────────┐   │
│  │  123.456789 TOKEN            │   │
│  │  ≈ $1,234.56                 │   │
│  │  +5.23% (24h)                │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Price Chart (Large)                │
│  ┌─────────────────────────────┐   │
│  │  [TokenPriceChart]           │   │
│  │  (min-height: 250px mobile)  │   │
│  │  (min-height: 400px desktop) │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Quick Actions (3 Buttons)         │
│  [Send] [Receive] [Swap]           │
├─────────────────────────────────────┤
│  Token Details (Collapsible)        │
│  ┌─────────────────────────────┐   │
│  │  Contract Address            │   │
│  │  Decimals                    │   │
│  │  Standard                    │   │
│  │  Chain                       │   │
│  │  Price                       │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Advanced Options (Collapsible)     │
│  ┌─────────────────────────────┐   │
│  │  Refresh Metadata           │   │
│  │  Add to Favorites           │   │
│  │  Hide Token                 │   │
│  │  View on CoinGecko          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🎯 Key Improvements

### **1. Full-Screen Experience**
- ✅ Geen modal constraints meer
- ✅ Maximale ruimte voor content
- ✅ Betere focus op token details

### **2. Native Token Support**
- ✅ Native tokens (ETH, SOL, MATIC, etc.) zijn nu klikbaar
- ✅ Zelfde functionaliteit als ERC-20 tokens
- ✅ Correcte price history via symbol-based lookup

### **3. BLAZE Wallet Styling**
- ✅ Glass-card effects
- ✅ Gradient backgrounds
- ✅ Orange/amber accent colors
- ✅ Smooth animations
- ✅ Consistent met rest van app

### **4. Mobile Optimization**
- ✅ Full-screen voor maximale ruimte
- ✅ Swipe gestures voor betere UX
- ✅ Touch-friendly buttons
- ✅ Optimized chart sizing

### **5. Desktop Enhancement**
- ✅ Keyboard shortcuts
- ✅ Hover effects
- ✅ Better spacing
- ✅ Larger chart for better visibility

---

## 🔄 Implementation Steps

1. **Update TokenDetailModal.tsx**
   - Change to full-screen overlay
   - Add native token support
   - Improve styling with BLAZE theme
   - Add swipe gestures (mobile)

2. **Update Dashboard.tsx**
   - Make native token clickable
   - Create native token object when clicked
   - Pass to TokenDetailModal

3. **Styling Updates**
   - Apply glass-card styling
   - Add gradient backgrounds
   - Improve spacing and typography
   - Add animations

4. **Mobile Enhancements**
   - Implement swipe-down-to-close
   - Optimize touch targets
   - Add haptic feedback

5. **Desktop Enhancements**
   - Add keyboard shortcuts
   - Improve hover states
   - Better focus management

---

## 📱 Responsive Breakpoints

- **Mobile**: `< 768px` - Full-screen, swipe gestures
- **Tablet**: `768px - 1024px` - Centered container, max-w-2xl
- **Desktop**: `> 1024px` - Centered container, max-w-4xl

---

## ✅ Testing Checklist

- [ ] Native tokens openen correct
- [ ] ERC-20 tokens werken nog steeds
- [ ] SPL tokens werken nog steeds
- [ ] Chart laadt correct voor alle token types
- [ ] Send/Receive/Swap buttons werken
- [ ] Swipe gestures werken op mobiel
- [ ] Keyboard shortcuts werken op desktop
- [ ] Styling is consistent met BLAZE theme
- [ ] Performance is goed (geen lag)
- [ ] Accessibility (screen readers, focus states)

---

## 🎨 Visual Mockup (Text-based)

```
┌─────────────────────────────────────────────┐
│  [🔴] Ethereum                    [✕]      │ ← Header
├─────────────────────────────────────────────┤
│                                             │
│            [ETH Logo]                       │
│            Ethereum                         │
│            ETH                              │
│                                             │
│            0.123456 ETH                     │
│            ≈ $234.56                        │
│            +2.34% (24h)                     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │      [Price Chart - Large]          │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Send    │ │ Receive │ │  Swap   │     │
│  │  [Icon]  │ │  [Icon] │ │  [Icon] │     │
│  └──────────┘ └──────────┘ └──────────┘     │
│                                             │
│  Token Details ▼                            │
│  ┌─────────────────────────────────────┐   │
│  │  Contract: 0x0000...0000            │   │
│  │  Decimals: 18                        │   │
│  │  Standard: Native                    │   │
│  │  Chain: Ethereum                    │   │
│  │  Price: $1,900.23                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Advanced Options ▼                         │
│  ┌─────────────────────────────────────┐   │
│  │  [Icon] Add to Favorites            │   │
│  │  [Icon] Hide Token                  │   │
│  │  [Icon] View on CoinGecko           │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🚀 Ready to Implement?

Dit voorstel bevat:
- ✅ Full-screen overlay voor desktop EN mobiel
- ✅ Native token support
- ✅ Perfecte BLAZE wallet styling
- ✅ Alle functionaliteit behouden
- ✅ Optimale UX voor beide platforms
- ✅ Swipe gestures voor mobiel
- ✅ Keyboard shortcuts voor desktop

**Wil je dat ik dit implementeer?** 🎨

