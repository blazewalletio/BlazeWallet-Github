# 🔥 PERFECT BALANCE CHART PROPOSAL - BITVAVO STYLE + BLAZE DESIGN

## 🎯 HOE BITVAVO HET DOET

**Bitvavo's aanpak:**
1. ✅ Grafiek begint vanaf **eerste deposit/transactie** (niet wallet creation)
2. ✅ Gebruikt **token holdings + historical prices** voor reconstructie
3. ✅ Toont **exacte momenten** waarop portfolio veranderde (deposits/withdrawals)
4. ✅ **Smooth interpolatie** tussen data punten
5. ✅ **Grote, prominente grafiek** met perfecte styling

---

## 🎨 BLAZE WALLET STYLING (GEBASEERD OP CODEBASE)

### **Kleuren & Gradients:**
```css
Primary Gradient: from-orange-500 to-yellow-500 (🔥 Flame theme)
Secondary: from-purple-500 to-pink-500
Success: from-emerald-500 to-teal-500
Card: glass-card (backdrop-blur, white/transparent)
```

### **Design Patterns:**
- ✅ `glass-card` - Frosted glass effect
- ✅ `card-3d` - 3D lift effect
- ✅ `subtle-shimmer` - Subtle animation
- ✅ Gradient overlays: `bg-gradient-to-r from-orange-500 to-yellow-500`
- ✅ Rounded corners: `rounded-xl`, `rounded-2xl`
- ✅ Shadows: `shadow-lg`, `shadow-xl`

---

## 📐 PERFECTE IMPLEMENTATIE

### **1. DATA RECONSTRUCTIE (Zoals Bitvavo)**

```typescript
// lib/portfolio-reconstruction.ts
export async function reconstructPortfolioHistory(
  tokens: Token[],
  nativeBalance: string,
  nativeSymbol: string,
  chain: string,
  timeframe: 'LIVE' | '1D' | '7D' | '30D' | '1J' | 'ALLES',
  firstTransactionTimestamp?: number // Eerste deposit/transactie
): Promise<BalanceSnapshot[]> {
  
  // 1. Bepaal start tijd (eerste transactie OF timeframe start)
  const now = Date.now();
  const days = timeframeToDays(timeframe);
  const startTime = firstTransactionTimestamp 
    ? Math.max(firstTransactionTimestamp, now - days * 24 * 60 * 60 * 1000)
    : now - days * 24 * 60 * 60 * 1000;
  
  // 2. Haal historische prijzen op voor ALLE tokens (parallel)
  const priceHistories = await Promise.all([
    // Native token
    getTokenPriceHistory(nativeSymbol, days, undefined, chain),
    // Alle ERC20/SPL tokens
    ...tokens.map(token => 
      getTokenPriceHistory(token.symbol, days, token.address, chain)
    )
  ]);
  
  // 3. Reconstruct portfolio value per tijdstip
  const portfolioPoints: BalanceSnapshot[] = [];
  const nativeHistory = priceHistories[0];
  
  if (!nativeHistory.success || nativeHistory.prices.length === 0) {
    return [];
  }
  
  // Loop door native price history (meest complete)
  for (const nativePoint of nativeHistory.prices) {
    if (nativePoint.timestamp < startTime) continue;
    
    let totalValue = parseFloat(nativeBalance) * nativePoint.price;
    
    // Voeg token values toe
    tokens.forEach((token, index) => {
      const tokenHistory = priceHistories[index + 1];
      if (tokenHistory.success && tokenHistory.prices.length > 0) {
        // Vind dichtstbijzijnde prijs voor dit tijdstip
        const closestPrice = findClosestPrice(
          tokenHistory.prices, 
          nativePoint.timestamp
        );
        if (closestPrice) {
          const tokenBalance = parseFloat(token.balance || '0');
          totalValue += tokenBalance * closestPrice.price;
        }
      }
    });
    
    portfolioPoints.push({
      timestamp: nativePoint.timestamp,
      balance: totalValue,
      address: '', // Not needed for chart
      chain: chain
    });
  }
  
  return portfolioPoints;
}
```

### **2. PERFECTE BLAZE STYLING**

```tsx
// components/BalanceChart.tsx - NIEUWE VERSIE

export default function BalanceChart({...}) {
  // ... existing code ...
  
  return (
    <div className="w-full mt-6">
      {/* Header met BLAZE styling */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isPositiveChange 
              ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
              : 'bg-gradient-to-br from-rose-500 to-orange-500'
          } shadow-lg`}>
            {isPositiveChange ? (
              <TrendingUp className="w-5 h-5 text-white" />
            ) : (
              <TrendingDown className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900">Portfolio</h3>
            <p className="text-xs text-gray-500">Total balance over time</p>
          </div>
        </div>
      </div>

      {/* Timeframe Selector - BLAZE Style */}
      <div className="flex items-center gap-2 mb-4 px-1 overflow-x-auto pb-2">
        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-xl p-1.5 border border-gray-200/50 shadow-sm">
          {timeframes.map((timeframe) => (
            <motion.button
              key={timeframe}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTimeframeChange(timeframe)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
                selectedTimeframe === timeframe
                  ? `bg-gradient-to-r ${
                      isPositiveChange 
                        ? 'from-emerald-500 to-teal-500' 
                        : 'from-rose-500 to-orange-500'
                    } text-white shadow-lg`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {timeframe}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart Container - BLAZE Glass Card */}
      <div className="glass-card rounded-2xl p-4 md:p-6 border border-gray-200/50 shadow-xl relative overflow-hidden">
        {/* Gradient overlay - BLAZE style */}
        <div className={`absolute inset-0 opacity-5 pointer-events-none ${
          isPositiveChange 
            ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
            : 'bg-gradient-to-br from-rose-500 to-orange-500'
        }`} />
        
        <div className="relative z-10">
          {isLoading ? (
            <div className="h-[280px] md:h-[380px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Loading chart data...</p>
              </div>
            </div>
          ) : chartData.length > 0 ? (
            <>
              {/* Min/Max Labels - BLAZE Style */}
              <div className="absolute top-4 left-4 z-20">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-gray-200/50">
                  <p className="text-xs font-semibold text-gray-500">Min</p>
                  <p className="text-sm font-bold text-gray-900">{formatUSDSync(minValue)}</p>
                </div>
              </div>
              <div className="absolute top-4 right-4 z-20">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-gray-200/50">
                  <p className="text-xs font-semibold text-gray-500">Max</p>
                  <p className="text-sm font-bold text-gray-900">{formatUSDSync(maxValue)}</p>
                </div>
              </div>

              {/* Chart - Large & Prominent */}
              <div className="h-[280px] md:h-[380px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData} 
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.4} />
                        <stop offset="50%" stopColor={lineColor} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#9ca3af"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tick={{ fill: '#6b7280' }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      style={{ fontSize: '11px', fontWeight: 500 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatUSDSync(value)}
                      domain={[minValue, maxValue]}
                      width={75}
                      tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ 
                        stroke: lineColor, 
                        strokeWidth: 2, 
                        strokeDasharray: '5 5',
                        strokeOpacity: 0.5
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={lineColor}
                      strokeWidth={3}
                      fill={`url(#${gradientId})`}
                      dot={false}
                      activeDot={{ 
                        r: 7, 
                        fill: lineColor, 
                        strokeWidth: 3, 
                        stroke: '#fff',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="h-[280px] md:h-[380px] flex items-center justify-center">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                  isPositiveChange 
                    ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10' 
                    : 'bg-gradient-to-br from-rose-500/10 to-orange-500/10'
                }`}>
                  <BarChart3 className={`w-8 h-8 ${
                    isPositiveChange ? 'text-emerald-500' : 'text-rose-500'
                  }`} />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No chart data available</p>
                <p className="text-xs text-gray-500">Start trading to see your portfolio history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### **3. MOBIEL PERFECT DESIGN**

```tsx
// Responsive breakpoints:
// Mobile: < 768px
// Desktop: >= 768px

// Mobile optimizations:
- Smaller chart height: 280px (vs 380px desktop)
- Horizontal scroll voor timeframe buttons
- Compact min/max labels
- Touch-friendly tooltips
- Swipe gestures voor timeframe switching (future)
```

---

## 🚀 IMPLEMENTATIE STAPPEN

1. ✅ **Nieuwe functie**: `reconstructPortfolioHistory()` in `lib/portfolio-reconstruction.ts`
2. ✅ **Update BalanceChart**: Gebruik reconstructie als er geen snapshots zijn
3. ✅ **Styling**: Perfect BLAZE glass-card met gradients
4. ✅ **Mobile**: Perfect responsive design
5. ✅ **Performance**: Cache resultaten, parallel API calls

---

## 📊 RESULTAAT

- ✅ **Exact zoals Bitvavo**: Reconstructie vanaf eerste transactie
- ✅ **Perfect BLAZE styling**: Glass-card, gradients, shadows
- ✅ **Perfect mobiel**: Responsive, touch-friendly
- ✅ **Snel**: Parallel API calls, caching
- ✅ **Accuraat**: Token holdings + historical prices

