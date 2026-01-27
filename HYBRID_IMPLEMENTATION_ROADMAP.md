# 🗺️ OPTIE C (HYBRID) - COMPLETE IMPLEMENTATIE ROADMAP
**Target:** Secure wallet operations via server, regular operations via client RLS  
**Generated:** 2026-01-27  
**Status:** 📋 PLANNING FASE - NIETS AANGEPAST

---

## 📊 CATEGORISATIE: Wat gaat waar?

### 🔐 **SERVER-SIDE (Admin Client) - Fort Knox**

**Criteria:** 
- Bevat encrypted wallet mnemonic
- Bevat 2FA secrets/backup codes
- Device verification (security-critical)
- Sensitive security operations

| Table | Operation | Files | Reason |
|-------|-----------|-------|--------|
| `wallets` | SELECT | `lib/supabase-auth.ts`, `lib/supabase-auth-strict.ts` | **Encrypted mnemonic = most sensitive** |
| `wallets` | INSERT | `lib/supabase-auth.ts` (signup/import) | **Initial wallet creation** |
| `wallets` | UPDATE | `lib/supabase-auth.ts` | **Wallet backup/restore** |
| `user_profiles` | UPDATE 2FA | `app/api/2fa/route.ts`, `lib/2fa-service.ts` | **2FA secrets** |
| `user_profiles` | SELECT 2FA | `lib/2fa-service.ts` | **2FA verification** |
| `trusted_devices` | INSERT | `lib/supabase-auth-strict.ts` | **Device registration** |
| `trusted_devices` | UPDATE verify | `lib/supabase-auth-strict.ts`, `app/api/verify-device-code/route.ts` | **Device verification** |

**Action:** Keep as admin client (already correct or needs new endpoint)

---

### ✅ **CLIENT-SIDE (Authenticated Client with RLS) - Regular Operations**

**Criteria:**
- Non-sensitive user preferences
- Read-only profile data
- Address book (user's own contacts)
- Transaction history (user's own)

| Table | Operation | Files | Reason |
|-------|-----------|-------|--------|
| `user_profiles` | SELECT profile | All components | **Non-sensitive user info** |
| `user_profiles` | UPDATE settings | Components (theme, notifications, etc.) | **User preferences** |
| `address_book` | ALL | `components/AddressBook.tsx`, `components/AddContactModal.tsx` | **User's own contacts** |
| `onramp_transactions` | SELECT | `components/PurchaseHistorySidebar.tsx`, `components/OnrampTransactionsPanel.tsx` | **User's own transaction history** |
| `trusted_devices` | SELECT list | Future: Account settings | **Show user their trusted devices** |

**Action:** Use authenticated client + ensure RLS policies exist

---

## 🔍 DETAILED FILE-BY-FILE ANALYSIS

---

### 📁 **1. `lib/supabase-auth.ts`** (CRITICAL)

**Current Pattern:** Mixed client queries  
**Target Pattern:** Server endpoints for wallet operations

#### **Lines 173-176: Wallet INSERT (Signup)**
```typescript
// ❌ CURRENT: Client insert
const { error: walletError } = await supabase
  .from('wallets')
  .insert({
    user_id: authData.user.id,
    encrypted_mnemonic: encryptedMnemonic,
  });
```

**🔧 CHANGE TO:**
```typescript
// ✅ NEW: Server endpoint
const response = await fetch('/api/wallet/create', {
  method: 'POST',
  body: JSON.stringify({
    userId: authData.user.id,
    encryptedMnemonic
  })
});
```

**New Endpoint:** `app/api/wallet/create/route.ts`

---

#### **Lines 262-265: Wallet SELECT (Sign-in)**
```typescript
// ❌ CURRENT: Client query (FAILS with 400!)
const { data: walletData, error: walletError } = await supabase
  .from('wallets')
  .select('encrypted_wallet, wallet_address')
  .eq('user_id', authData.user.id)
  .single();
```

**🔧 CHANGE TO:**
```typescript
// ✅ NEW: Use existing /api/get-wallet endpoint
const response = await fetch('/api/get-wallet', {
  method: 'POST',
  body: JSON.stringify({ userId: authData.user.id })
});
const { encrypted_mnemonic } = await response.json();
```

**Endpoint:** Already exists! `app/api/get-wallet/route.ts` ✅

---

#### **Lines 391-395: Check if wallet exists**
```typescript
// ❌ CURRENT: Client query
const { data } = await supabase
  .from('wallets')
  .select('id')
  .eq('user_id', userId)
  .single();
```

**🔧 CHANGE TO:**
```typescript
// ✅ NEW: Server endpoint
const response = await fetch('/api/wallet/exists', {
  method: 'POST',
  body: JSON.stringify({ userId })
});
const { exists } = await response.json();
```

**New Endpoint:** `app/api/wallet/exists/route.ts`

---

#### **Lines 412-418: Wallet UPDATE (Backup)**
```typescript
// ❌ CURRENT: Client update
const { error } = await supabase
  .from('wallets')
  .upsert({
    user_id: userId,
    encrypted_mnemonic: encryptedWallet,
  });
```

**🔧 CHANGE TO:**
```typescript
// ✅ NEW: Server endpoint
const response = await fetch('/api/wallet/update', {
  method: 'POST',
  body: JSON.stringify({
    userId,
    encryptedMnemonic: encryptedWallet
  })
});
```

**New Endpoint:** `app/api/wallet/update/route.ts`

---

#### **Lines 485-490: Wallet INSERT (Import)**
```typescript
// ❌ CURRENT: Client insert
const { error: walletError } = await supabase
  .from('wallets')
  .insert({
    user_id: authData.user.id,
    encrypted_mnemonic: encryptedMnemonic,
  });
```

**🔧 CHANGE TO:**
```typescript
// ✅ NEW: Use same /api/wallet/create endpoint
const response = await fetch('/api/wallet/create', {
  method: 'POST',
  body: JSON.stringify({
    userId: authData.user.id,
    encryptedMnemonic
  })
});
```

**Endpoint:** Same as signup (reuse `app/api/wallet/create/route.ts`)

---

### 📁 **2. `lib/supabase-auth-strict.ts`** (CRITICAL)

**Current Pattern:** Already uses fetch for wallet (via `/api/get-wallet`) ✅  
**Target Pattern:** Keep current pattern (already hybrid!)

#### **Lines 127-131: Wallet SELECT**
```typescript
// ❌ OLD CODE (commented out now):
// const { data: wallet } = await supabase
//   .from('wallets')
//   .select('encrypted_mnemonic')
//   .eq('user_id', data.user.id)
//   .single();

// ✅ CURRENT CODE (already server endpoint!):
const walletResponse = await fetch('/api/get-wallet', {
  method: 'POST',
  body: JSON.stringify({ userId: authData.user.id }),
});
```

**Action:** ✅ NO CHANGE NEEDED - Already correct!

---

#### **Lines 102-105, 118-120: Trusted Devices**
```typescript
// Current: Client queries for trusted_devices
const { data: existingDevice } = await supabase
  .from('trusted_devices')
  .select('*')
  .eq('user_id', data.user.id);

await supabase
  .from('trusted_devices')
  .update({ last_used_at: new Date().toISOString() });
```

**🤔 DECISION NEEDED:**
- **Keep client?** → Needs RLS policy (anon access for verification flow)
- **Move to server?** → More secure but adds complexity

**Recommendation:** Keep client BUT ensure RLS policies exist (they do! See migration `20260127000000_complete_device_verification_policies.sql`)

**Action:** ✅ NO CHANGE NEEDED - RLS policies already exist

---

### 📁 **3. `lib/2fa-service.ts`** (Already Correct!)

**Current Pattern:** Admin client for 2FA operations ✅  
**Target Pattern:** Keep as-is

```typescript
// ✅ CORRECT: Already using admin client
const { data: profile } = await supabaseAdmin
  .from('user_profiles')
  .select('two_factor_secret, two_factor_enabled')
  .eq('user_id', userId)
  .single();
```

**Action:** ✅ NO CHANGE NEEDED - Already using admin client correctly!

---

### 📁 **4. Components - User Profile Operations**

**Files:**
- `components/Dashboard.tsx`
- `components/AccountPage.tsx`
- `components/AccountPageNew.tsx`
- `components/SettingsModal.tsx`
- `components/ThemeSelectorModal.tsx`
- `components/NotificationSettingsModal.tsx`
- `components/AutoLockSettingsModal.tsx`

**Current Pattern:** Client queries to `user_profiles`  
**Target Pattern:** Keep client BUT ensure RLS works

#### **Example: Dashboard.tsx lines 285-287**
```typescript
// ✅ KEEP AS-IS: Non-sensitive user preference
const { data: profile } = await supabase
  .from('user_profiles')
  .select('balance_visible')
  .eq('user_id', user.id)
  .single();
```

**Required:** Ensure RLS policy exists

```sql
-- ✅ Should exist:
CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Action:** ✅ Verify RLS policy exists (likely already there), NO CODE CHANGES

---

### 📁 **5. Components - Address Book**

**Files:**
- `components/AddressBook.tsx`
- `components/AddContactModal.tsx`

**Current Pattern:** Client queries  
**Target Pattern:** Keep client BUT FIX overly permissive RLS policy

#### **Example: AddressBook.tsx lines 77-80**
```typescript
// ✅ KEEP AS-IS: User's own contacts
const { data, error } = await supabase
  .from('address_book')
  .select('*')
  .eq('user_id', userId)
  .order('name');
```

**Required:** Fix RLS policy (CRITICAL!)

```sql
-- ❌ CURRENT: Overly permissive
CREATE POLICY "Users can view their own contacts"
  ON address_book FOR SELECT
  TO authenticated, anon
  USING (
    (auth.uid()::text = user_id) OR
    true  -- ⚠️ ANYONE can read EVERYTHING!
  );

-- ✅ FIX TO:
CREATE POLICY "Users can view their own contacts"
  ON address_book FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);
```

**Action:** 🔧 Fix RLS policy in database, NO CODE CHANGES

---

### 📁 **6. Components - Onramp Transactions**

**Files:**
- `components/PurchaseHistorySidebar.tsx`
- `components/OnrampTransactionsPanel.tsx`

**Current Pattern:** Client queries  
**Target Pattern:** Keep client with RLS

#### **Example: PurchaseHistorySidebar.tsx lines 113-116**
```typescript
// ✅ KEEP AS-IS: User's own transaction history
let query = supabase
  .from('onramp_transactions')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Required:** Ensure RLS policy exists

```sql
-- ✅ Should exist:
CREATE POLICY "Users can read their own transactions"
  ON onramp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

**Action:** ✅ Verify RLS policy exists, NO CODE CHANGES

---

### 📁 **7. `lib/currency-service.ts`**

**Current Pattern:** Client query for currency preference  
**Target Pattern:** Keep as-is

#### **Lines 55-58**
```typescript
// ✅ KEEP AS-IS: Non-sensitive preference
const { data: profile } = await supabase
  .from('user_profiles')
  .select('preferred_currency')
  .eq('user_id', user.id)
  .single();
```

**Action:** ✅ NO CHANGE NEEDED

---

## 🚀 NEW API ENDPOINTS TO CREATE

### **1. `/api/wallet/create` - Create new wallet**

```typescript
// app/api/wallet/create/route.ts
POST /api/wallet/create
Body: { userId: string, encryptedMnemonic: string }
Response: { success: boolean, error?: string }

// Uses: supabaseAdmin.from('wallets').insert()
```

---

### **2. `/api/wallet/update` - Update existing wallet**

```typescript
// app/api/wallet/update/route.ts
POST /api/wallet/update
Body: { userId: string, encryptedMnemonic: string }
Response: { success: boolean, error?: string }

// Uses: supabaseAdmin.from('wallets').upsert()
```

---

### **3. `/api/wallet/exists` - Check if wallet exists**

```typescript
// app/api/wallet/exists/route.ts
POST /api/wallet/exists
Body: { userId: string }
Response: { exists: boolean }

// Uses: supabaseAdmin.from('wallets').select('id')
```

---

### **4. `/api/get-wallet` - Get encrypted wallet**

```typescript
// ✅ ALREADY EXISTS!
// app/api/get-wallet/route.ts
POST /api/get-wallet
Body: { userId: string }
Response: { success: boolean, encrypted_mnemonic: string }
```

---

## 🗄️ DATABASE: RLS POLICIES TO FIX/VERIFY

### **🔴 CRITICAL: Fix `address_book` overly permissive policy**

```sql
-- Migration: 20260127140000_fix_address_book_rls.sql

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON address_book;

-- ✅ Proper RLS policies
CREATE POLICY "Users can view their own contacts"
  ON address_book FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON address_book FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own contacts"
  ON address_book FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON address_book FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);
```

---

### **🟡 VERIFY: Ensure `wallets` RLS policies exist**

```sql
-- Should already exist from: 20260127130000_fix_wallets_rls_policy.sql
-- But verify in production!

SELECT * FROM pg_policies WHERE tablename = 'wallets';
```

**Expected:**
- `Users can read their own wallet` (SELECT)
- `Users can update their own wallet` (UPDATE)
- `Users can insert their own wallet` (INSERT)
- `Service role can manage wallets` (ALL)

---

### **🟡 VERIFY: Ensure `user_profiles` RLS policies exist**

```sql
-- Should exist, but verify:
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
```

**Expected:**
- Users can SELECT their own profile
- Users can UPDATE their own profile
- Users can INSERT their own profile

---

### **🟡 VERIFY: Ensure `onramp_transactions` RLS policies exist**

```sql
-- Check if policies exist:
SELECT * FROM pg_policies WHERE tablename = 'onramp_transactions';
```

**If missing, create:**
```sql
CREATE POLICY "Users can read their own transactions"
  ON onramp_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Database Fixes (30 min)**
- [ ] Run `20260127130000_fix_wallets_rls_policy.sql` in production
- [ ] Create & run `20260127140000_fix_address_book_rls.sql`
- [ ] Verify all RLS policies with SQL queries
- [ ] Test client queries in console (should work!)

### **Phase 2: Create New API Endpoints (1 hour)**
- [ ] Create `app/api/wallet/create/route.ts`
- [ ] Create `app/api/wallet/update/route.ts`
- [ ] Create `app/api/wallet/exists/route.ts`
- [ ] Test all endpoints with Postman/curl

### **Phase 3: Update `lib/supabase-auth.ts` (1 hour)**
- [ ] Replace wallet INSERT with `/api/wallet/create`
- [ ] Replace wallet SELECT with `/api/get-wallet`
- [ ] Replace wallet UPDATE with `/api/wallet/update`
- [ ] Replace hasCloudWallet with `/api/wallet/exists`
- [ ] Test signup flow
- [ ] Test sign-in flow
- [ ] Test import wallet flow

### **Phase 4: Verify Other Files (30 min)**
- [ ] Confirm `lib/supabase-auth-strict.ts` still works
- [ ] Confirm `lib/2fa-service.ts` still works
- [ ] Confirm components can read user_profiles
- [ ] Confirm address book works
- [ ] Confirm onramp transactions display

### **Phase 5: Testing (1 hour)**
- [ ] Full signup → wallet creation flow
- [ ] Full sign-in → wallet unlock flow
- [ ] Profile updates (theme, settings)
- [ ] Address book CRUD operations
- [ ] 2FA setup/verification
- [ ] Device verification flow
- [ ] Transaction history viewing

### **Phase 6: Cleanup & Documentation (30 min)**
- [ ] Remove old commented code
- [ ] Update code comments
- [ ] Document new API endpoints
- [ ] Update security audit report
- [ ] Create deployment notes

---

## 🎯 EXPECTED CHANGES SUMMARY

### **Files to MODIFY:**
1. ✏️ `lib/supabase-auth.ts` - Replace 5 wallet queries with API calls
2. ✏️ Database - Fix address_book RLS policy

### **Files to CREATE:**
1. ✨ `app/api/wallet/create/route.ts`
2. ✨ `app/api/wallet/update/route.ts`
3. ✨ `app/api/wallet/exists/route.ts`
4. ✨ `supabase/migrations/20260127140000_fix_address_book_rls.sql`

### **Files to VERIFY (no changes):**
- ✅ `lib/supabase-auth-strict.ts` (already correct!)
- ✅ `lib/2fa-service.ts` (already correct!)
- ✅ All components (should work with RLS)

---

## ⏱️ TIME ESTIMATE

| Phase | Task | Time |
|-------|------|------|
| 1 | Database fixes | 30 min |
| 2 | New API endpoints | 1 hour |
| 3 | Update supabase-auth.ts | 1 hour |
| 4 | Verification | 30 min |
| 5 | Testing | 1 hour |
| 6 | Cleanup | 30 min |
| **TOTAL** | **Full implementation** | **~4.5 hours** |

---

## 🚨 RISKS & MITIGATION

### **Risk 1: RLS policies not working in production**
**Mitigation:** Test each policy with direct SQL queries BEFORE code changes

### **Risk 2: Session timing issues**
**Mitigation:** Add proper error handling and retry logic in API endpoints

### **Risk 3: Breaking existing functionality**
**Mitigation:** Test each change incrementally, rollback if issues

### **Risk 4: Users mid-session during deployment**
**Mitigation:** Deploy during low-traffic hours, add backwards compatibility

---

## ✅ SUCCESS CRITERIA

After implementation, these should ALL work:

1. ✅ User can sign up → wallet created via server
2. ✅ User can sign in → wallet decrypted via server
3. ✅ User can update profile → via client + RLS
4. ✅ User can manage address book → via client + RLS
5. ✅ User can view transactions → via client + RLS
6. ✅ User cannot access other users' data
7. ✅ 2FA setup/verify works via server
8. ✅ Device verification works
9. ✅ No 400/403 errors in console
10. ✅ Performance is acceptable (<500ms for wallet ops)

---

## 🎓 ARCHITECTURE DECISION RECORD

**Decision:** Hybrid approach (Optie C)

**Rationale:**
- Wallet mnemonic requires maximum security (server-side)
- User preferences benefit from fast client access (RLS)
- Clear separation of concerns
- Follows crypto wallet industry patterns

**Trade-offs:**
- Slightly more complex than pure RLS
- Extra API calls for wallet operations
- But: Better security, clear separation, maintainable

---

*End of Roadmap - Ready for approval & implementation*

