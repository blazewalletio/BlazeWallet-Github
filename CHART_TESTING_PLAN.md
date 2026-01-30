# 📊 TOKEN PRICE CHART - TESTING PLAN

**Status:** Ready for testing
**Server:** http://localhost:3001
**Date:** 2026-01-30

## ✅ FIXES IMPLEMENTED

### 1. CoinGecko Pro API Integration
- ✅ Switched from free tier to Pro API endpoints
- ✅ Fixed API key handling (using `x-cg-pro-api-key` header)
- ✅ Pro API endpoint: `https://pro-api.coingecko.com/api/v3`
- ✅ Fixed TypeScript header types
- ✅ Improved logging for debugging

### 2. API Key Configuration
- ⚠️ **MANUAL FIX REQUIRED:** Remove `\n` from `.env.local`
  ```bash
  # Current (WRONG):
  COINGECKO_API_KEY="CG-2zNxDeFXb8KJ2DSnpWMdKi7z\n"
  
  # Should be (CORRECT):
  COINGECKO_API_KEY="CG-2zNxDeFXb8KJ2DSnpWMdKi7z"
  ```

### 3. All Timeframes Supported
- **LIVE:** 1-second refresh (updateLivePrice)
- **1D:** 5-minute intervals (~288 points)
- **7D:** Hourly intervals (~168 points)
- **30D:** Hourly intervals (~720 points)
- **1J:** Daily intervals (~365 points)
- **ALLES:** Daily intervals (max available)

---

## 🧪 TESTING CHECKLIST

### Test 1: ETH (Ethereum) - All Timeframes
**Steps:**
1. Open wallet at http://localhost:3001
2. Click on ETH token
3. Test each timeframe:
   - [ ] LIVE - Should update every second
   - [ ] 1D - Should show ~288 points (5-min intervals)
   - [ ] 7D - Should show ~168 points (hourly)
   - [ ] 30D - Should show ~720 points (hourly)
   - [ ] 1J - Should show ~365 points (daily)
   - [ ] ALLES - Should show all available data

**Expected Logging:**
```
[Price History API] 🔑 CoinGecko API key check
[Price History API] 📡 Step 4: Fetching market chart data
  usingProAPI: true
  apiKeyPresent: true
  coinGeckoId: "ethereum"
```

---

### Test 2: SOL (Solana) - All Timeframes
**Steps:**
1. Click on SOL token
2. Test each timeframe:
   - [ ] LIVE
   - [ ] 1D
   - [ ] 7D
   - [ ] 30D
   - [ ] 1J
   - [ ] ALLES

**Expected Logging:**
```
[Price History API] 🔍 Symbol lookup result
  symbol: "SOL"
  coinGeckoId: "solana"
[Price History API] 📡 Step 4: Fetching market chart data
  usingProAPI: true
```

---

### Test 3: BTC (Bitcoin) - All Timeframes
**Steps:**
1. Click on BTC token (if available)
2. Test all timeframes

---

### Test 4: USDC (Stablecoin) - Flat Line Test
**Steps:**
1. Click on USDC token
2. Check 7D timeframe
3. Should show relatively flat line around $1.00

---

### Test 5: ERC-20 Token (e.g., UNI, PENDLE)
**Steps:**
1. Click on any ERC-20 token in wallet
2. Test 1D and 7D timeframes
3. Verify contract address lookup works

**Expected Logging:**
```
[Price History API] 📡 Contract lookup API call
  platform: "ethereum"
  contractAddress: "0x..."
  usingProAPI: true
```

---

### Test 6: SPL Token (Solana token)
**Steps:**
1. Switch to Solana network
2. Click on any SPL token
3. Test 1D and 7D timeframes

---

## 📋 WHAT TO CHECK IN LOGS

### 1. API Key Usage
✅ **Should see:**
```
hasApiKeyInEnv: true
apiKeyLength: 27
apiKeyPrefix: "CG-2zN..."
```

❌ **Should NOT see:**
```
apiKeyLength: 29  // This means \n is still there!
```

### 2. Pro API Endpoint
✅ **Should see:**
```
url: "https://pro-api.coingecko.com/api/v3/coins/ethereum/market_chart..."
usingProAPI: true
```

❌ **Should NOT see:**
```
url: "https://api.coingecko.com/api/v3..."  // This is free tier!
usingFreeTier: true
```

### 3. Data Points
✅ **Should see correct granularity:**
- 1D: `pricesLength: ~288` (5-minute intervals)
- 7D: `pricesLength: ~168` (hourly)
- 30D: `pricesLength: ~720` (hourly)
- 1J: `pricesLength: ~365` (daily)

### 4. Rate Limits
✅ **Pro API:** 500 calls/min
❌ **Free tier:** 10-50 calls/min

If you see 429 errors with Pro API, something is wrong!

---

## 🐛 KNOWN ISSUES TO VERIFY FIXED

### Issue 1: Charts Not Loading
**Symptom:** Empty chart or "Chart not available"
**Cause:** API key not being sent
**Fix:** ✅ Now using Pro API with correct headers

### Issue 2: Wrong Data Points
**Symptom:** Chart shape doesn't match CoinGecko website
**Cause:** Wrong interval parameter or free tier fallback
**Fix:** ✅ Correct intervals now used

### Issue 3: Rate Limiting
**Symptom:** 429 errors in console
**Cause:** Free tier rate limits (10-50 calls/min)
**Fix:** ✅ Pro API has 500 calls/min

---

## 🎯 SUCCESS CRITERIA

### Must Have:
- [ ] All 6 timeframes load correctly for ETH
- [ ] Charts match CoinGecko website exactly
- [ ] Console shows "usingProAPI: true"
- [ ] No 429 rate limit errors
- [ ] Correct data point counts (288 for 1D, etc.)

### Nice to Have:
- [ ] LIVE mode updates smoothly every second
- [ ] Charts load quickly (< 2 seconds)
- [ ] Smooth transitions between timeframes

---

## 🔍 HOW TO TEST

### Option 1: Browser Console
1. Open http://localhost:3001
2. Open DevTools (F12)
3. Go to Console tab
4. Filter by "Price History API" or "TokenPriceChart"
5. Click on tokens and switch timeframes
6. Watch the logging

### Option 2: Terminal Logs
1. Watch the terminal where `npm run dev` is running
2. Look for `[Price History API]` logs
3. Verify Pro API usage

---

## 🚨 URGENT: FIX API KEY FIRST

Before testing, **MANUALLY EDIT `.env.local`:**

```bash
# Open the file
nano /Users/rickschlimback/Desktop/BLAZE\ Wallet\ 29-12/.env.local

# Find this line:
COINGECKO_API_KEY="CG-2zNxDeFXb8KJ2DSnpWMdKi7z\n"

# Change to:
COINGECKO_API_KEY="CG-2zNxDeFXb8KJ2DSnpWMdKi7z"

# Save (Ctrl+O, Enter, Ctrl+X)

# Restart dev server
# Kill current server (Ctrl+C in terminal 8)
npm run dev
```

---

## 📝 NOTES FOR USER

1. **API Key Issue:** I couldn't edit `.env.local` (blocked by globalignore), so you need to manually remove the `\n` at the end of the API key.

2. **Server Running:** Dev server is on port 3001 (port 3000 was in use)

3. **All Code Fixed:** 
   - ✅ Pro API endpoints
   - ✅ Correct headers
   - ✅ Proper logging
   - ✅ No TypeScript errors

4. **Ready to Test:** Once you fix the API key, everything should work perfectly!

5. **What I'll Do Next:** After you test and confirm it works, I'll commit all changes to GitHub.

---

## 🎯 EXPECTED OUTCOME

After testing, you should see:
- ✅ All charts load perfectly
- ✅ Smooth transitions between timeframes
- ✅ Charts match CoinGecko website exactly
- ✅ Console logs show "usingProAPI: true"
- ✅ No errors or warnings
- ✅ Fast load times (< 2 seconds)

**Let me know the results and I'll continue with any fixes needed!** 🚀

