# ✅ ONRAMPER IMPLEMENTATIE CHECKLIST

**Datum:** 22 December 2025  
**Status:** Klaar voor Implementatie

---

## 📋 PRE-IMPLEMENTATIE VALIDATIE

### ✅ Test Resultaten (via Onramper MCP Server)
- ✅ `/supported/onramps` - Werkt perfect, returns `{ message: [...] }`
- ✅ `/supported/payment-types/{source}` - Werkt perfect, returns `{ message: [...] }`
- ✅ `/supported/defaults/all` - Werkt perfect, returns `{ message: {...} }`
- ✅ `/quotes/{fiat}/{crypto}` - Werkt perfect, returns **direct array** (niet in `message`!)
- ✅ `/checkout/intent` - Werkt perfect, maar vereist `onramp` parameter (REQUIRED)
- ✅ `/transactions/{transactionId}` - Werkt perfect, geeft `onramp` en `status` voor tracking

### ⚠️ Belangrijke Aandachtspunten (Geïdentificeerd tijdens Test)
1. ✅ **Response structure verschillen** - Verschillende endpoints hebben verschillende formats
2. ✅ **Provider selection REQUIRED** - Moet provider kiezen VOOR `/checkout/intent`
3. ✅ **Quotes endpoint direct array** - Niet in `message` field
4. ✅ **Transaction tracking mogelijk** - Via `/transactions/{transactionId}` endpoint
5. ✅ **Caching nodig** - Rate limits vereisen caching strategy

---

## 🔧 IMPLEMENTATIE CHECKLIST

### **FASE 1: Supabase Migration & User Preferences**

#### 1.1 Create Supabase Migration
- [ ] Create `supabase/migrations/20250122000000_user_onramp_preferences.sql`
- [ ] Define `user_onramp_preferences` table structure
- [ ] Add indexes for performance
- [ ] Add RLS policies
- [ ] Test migration in local Supabase

#### 1.2 Implement User Preferences Service
- [ ] Create `lib/user-onramp-preferences.ts`
- [ ] Implement `get(userId)` method
- [ ] Implement `addVerifiedProvider(userId, provider)` method
- [ ] Implement `setPreferredProvider(userId, provider)` method
- [ ] Implement `setLastUsedProvider(userId, provider, paymentMethod)` method
- [ ] Implement `updateAfterTransaction(userId, transactionId)` method
- [ ] Add error handling and logging

#### 1.3 Add Transaction Tracking
- [ ] Add `getTransaction(transactionId)` method to `OnramperService`
- [ ] Use `/transactions/{transactionId}` endpoint
- [ ] Parse response (direct object, not in `message`)
- [ ] Extract `onramp` and `status` fields
- [ ] Call `updateAfterTransaction` when transaction completes

---

### **FASE 2: Dynamic Provider & Payment Method Detection**

#### 2.1 Implement `/supported/onramps` Endpoint
- [ ] Add `getAvailableProviders()` method to `OnramperService`
- [ ] Handle response structure (`{ message: [...] }`)
- [ ] Parse provider data (onramp, country, paymentMethods, recommendedPaymentMethod)
- [ ] Add error handling
- [ ] Add caching (5 minutes)

#### 2.2 Implement `/supported/payment-types/{source}` Endpoint
- [ ] Add `getPaymentMethods()` method to `OnramperService`
- [ ] Handle response structure (`{ message: [...] }`)
- [ ] Parse payment method data (paymentTypeId, name, icon, limits)
- [ ] Extract provider support from `details.limits`
- [ ] Add error handling
- [ ] Add caching (5 minutes)

#### 2.3 Implement `/supported/defaults/all` Endpoint
- [ ] Add `getCountryDefaults()` method to `OnramperService`
- [ ] Handle response structure (`{ message: {...} }`)
- [ ] Parse recommended defaults and country-specific defaults
- [ ] Add error handling
- [ ] Add caching (1 hour)

#### 2.4 Update Existing Code
- [ ] Remove hardcoded provider lists
- [ ] Remove hardcoded payment method lists
- [ ] Update `BuyModal3.tsx` to use dynamic data
- [ ] Update `supported-data` API route to use new methods

---

### **FASE 3: Multi-Provider Quote Comparison**

#### 3.1 Update Quotes Endpoint
- [ ] Update `getAllProviderQuotes()` method in `OnramperService`
- [ ] **CRITICAL**: Handle direct array response (not in `message` field!)
- [ ] Filter out quotes with errors
- [ ] Parse quote data (ramp, payout, rate, fees, recommendations)
- [ ] Add error handling
- [ ] Add caching (30 seconds)

#### 3.2 Update Quotes API Route
- [ ] Update `/api/onramper/quotes/route.ts`
- [ ] Return array of all provider quotes (not just best one)
- [ ] Include provider name in response
- [ ] Include recommendations in response
- [ ] Include errors in response (for debugging)

#### 3.3 Update BuyModal3 Component
- [ ] Update to handle array of quotes
- [ ] Show all provider quotes in UI
- [ ] Highlight preferred provider if verified
- [ ] Show "Best Value" badge on best quote
- [ ] Show "✓ Verified" badge on verified providers

---

### **FASE 4: Smart Provider Selection**

#### 4.1 Implement Provider Selector
- [ ] Create `lib/provider-selector.ts`
- [ ] Implement `selectProvider()` method with preference priority
- [ ] Implement `selectBestQuote()` method
- [ ] Implement `calculateRateDifference()` method
- [ ] **CRITICAL**: Implement `selectAndCreateTransaction()` method
- [ ] Add error handling and logging

#### 4.2 Update Checkout Intent Flow
- [ ] Update `/api/onramper/checkout-intent/route.ts`
- [ ] **CRITICAL**: Require `onramp` parameter (provider selection must happen BEFORE this call)
- [ ] Remove hardcoded `banxa` provider
- [ ] Use selected provider from request body
- [ ] Add validation for required `onramp` parameter

#### 4.3 Update BuyModal3 Component
- [ ] Call provider selection BEFORE checkout intent
- [ ] Pass selected provider to checkout intent API
- [ ] Show comparison UI if rate difference is significant
- [ ] Show preferred provider badge if using verified provider

---

### **FASE 5: Smart Country Detection**

#### 5.1 Implement Geolocation Service
- [ ] Create `lib/geolocation.ts`
- [ ] Implement `detectCountry()` method
- [ ] Priority 1: User's saved preference (localStorage)
- [ ] Priority 2: Cloudflare header (`cf-ipcountry`)
- [ ] Priority 3: Let Onramper auto-detect (no `country` parameter)
- [ ] Add error handling

#### 5.2 Update API Routes
- [ ] Update `/api/onramper/supported-data/route.ts` to use country detection
- [ ] Update `/api/onramper/quotes/route.ts` to use country detection
- [ ] Update `/api/onramper/checkout-intent/route.ts` to use country detection
- [ ] Remove hardcoded 'NL' country

#### 5.3 Update BuyModal3 Component
- [ ] Remove hardcoded `?country=NL` from API calls
- [ ] Let server-side detect country automatically
- [ ] Store user's country preference in localStorage

---

### **FASE 6: Enhanced Mobile UX**

#### 6.1 Implement In-App Browser
- [ ] Create `components/InAppBrowser.tsx`
- [ ] Add header with back button
- [ ] Add navigation buttons (back/forward)
- [ ] Listen for payment completion messages
- [ ] Handle transaction completion
- [ ] Update user preferences after completion

#### 6.2 Update BuyModal3 Component
- [ ] Use InAppBrowser instead of direct redirect on mobile
- [ ] Keep popup for desktop (better UX)
- [ ] Add payment status tracking
- [ ] Poll transaction status if needed

#### 6.3 Add Payment Status Tracking
- [ ] Add `getTransaction()` method to `OnramperService`
- [ ] Use `/transactions/{transactionId}` endpoint
- [ ] Poll transaction status every 3 seconds
- [ ] Update UI when status changes
- [ ] Call `updateAfterTransaction` when completed

---

## 🧪 TESTING CHECKLIST

### **Unit Tests**
- [ ] Test response parsing for each endpoint type
- [ ] Test provider selection logic (preference priority)
- [ ] Test rate difference calculation
- [ ] Test country detection (all priority levels)
- [ ] Test user preferences CRUD operations

### **Integration Tests**
- [ ] Test full flow: quotes → selection → checkout intent
- [ ] Test transaction tracking and preference update
- [ ] Test fallback mechanisms (preferred not available)
- [ ] Test error handling (API failures, invalid data)

### **E2E Tests**
- [ ] Test complete purchase flow (new user)
- [ ] Test complete purchase flow (returning user with verified provider)
- [ ] Test provider comparison UI
- [ ] Test mobile in-app browser
- [ ] Test desktop popup flow

---

## 📊 SUCCESS CRITERIA

### **Functional Requirements**
- [ ] ✅ Dynamic provider detection (no hardcoding)
- [ ] ✅ Dynamic payment method detection (no hardcoding)
- [ ] ✅ Country auto-detection works
- [ ] ✅ Multi-provider quote comparison works
- [ ] ✅ Provider preference system works
- [ ] ✅ KYC reuse works (verified providers preferred)
- [ ] ✅ Mobile UX improved (in-app browser)
- [ ] ✅ Desktop UX improved (popup with tracking)

### **Performance Requirements**
- [ ] ✅ Provider selection < 2 seconds
- [ ] ✅ Quotes cached for 30 seconds
- [ ] ✅ Provider/payment method lists cached for 5 minutes
- [ ] ✅ Country defaults cached for 1 hour

### **User Experience Requirements**
- [ ] ✅ < 3 taps to complete purchase
- [ ] ✅ Returning users don't need new KYC (if using same provider)
- [ ] ✅ Clear comparison UI when multiple providers available
- [ ] ✅ Preferred provider clearly indicated

---

## 🚨 KNOWN ISSUES & SOLUTIONS

### **Issue 1: Response Structure Differences**
**Problem:** Different endpoints return different structures
- `/supported/onramps` → `{ message: [...] }`
- `/quotes/{fiat}/{crypto}` → `[...]` (direct array)

**Solution:** Implement response parser that handles both formats

### **Issue 2: Provider Selection Required**
**Problem:** `/checkout/intent` requires `onramp` parameter

**Solution:** Select provider BEFORE calling checkout intent (in `selectAndCreateTransaction`)

### **Issue 3: Rate Limits**
**Problem:** API documentation warns about rate limits

**Solution:** Implement caching strategy (30s for quotes, 5min for providers, 1h for defaults)

### **Issue 4: Transaction Status Interpretation**
**Problem:** `status === 'completed'` doesn't guarantee KYC was done in this transaction

**Solution:** Conservative approach - if transaction completed, add to verified providers (user definitely can buy at this provider)

---

## ✅ IMPLEMENTATIE GOEDKEURING

**Test Status:** ✅ **ALL ENDPOINTS TESTED & VALIDATED**

**Geen Kritieke Problemen Gevonden!**

**Status:** ✅ **GOEDKEURING VOOR IMPLEMENTATIE**

Alle endpoints zijn getest en werken zoals verwacht. Alleen kleine aanpassingen nodig voor response parsing en provider selection flow.

