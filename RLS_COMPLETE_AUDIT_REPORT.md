# 🔍 BLAZE WALLET - COMPLETE RLS AUDIT REPORT
**Generated:** 2026-01-27  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## 📊 EXECUTIVE SUMMARY

**Current State:** RLS policies exist but are NOT properly enforced in client-side code.  
**Root Cause:** Mix of client (anon/authenticated) and server (admin) queries without consistent pattern.  
**Impact:** Security vulnerabilities + performance issues + maintenance complexity.

---

## 🗂️ DATABASE TABLES AUDIT

### **Tables with Supabase Queries:**

| Table | RLS Enabled? | Has Policies? | Issues |
|-------|-------------|---------------|---------|
| `wallets` | ✅ YES | ⚠️ MAYBE | Client queries fail (400 error) |
| `user_profiles` | ✅ YES | ✅ YES | Mixed client/admin usage |
| `trusted_devices` | ✅ YES | ✅ YES | Works but complex policies |
| `user_activity_log` | ✅ YES | ✅ YES | Admin-only (correct) |
| `address_book` | ✅ YES | ✅ YES | Overly permissive (`true` policy) |
| `scheduled_transactions` | ✅ YES | ✅ YES | Admin-only (correct) |
| `onramp_transactions` | ✅ YES | ⚠️ UNKNOWN | Needs verification |
| `user_security_scores` | ✅ YES | ✅ YES | Read-only for users |

---

## 🔍 DETAILED FILE-BY-FILE ANALYSIS

### 🔴 **CRITICAL: `wallets` table**

#### **Files Accessing:**
1. `app/api/get-wallet/route.ts` - Server (admin)
2. `lib/supabase-auth-strict.ts` - Client → Server workaround
3. `lib/supabase-auth.ts` - Likely has queries too

#### **Current Issues:**
```typescript
// ❌ PROBLEM: Client query returns 400 Bad Request
const { data: wallet } = await supabase
  .from('wallets')
  .select('encrypted_mnemonic')
  .eq('user_id', userId)
  .single();
// → Error: 400 Bad Request

// 🔧 WORKAROUND: Server endpoint with admin client
const response = await fetch('/api/get-wallet', {
  method: 'POST',
  body: JSON.stringify({ userId })
});
// → Works, but adds latency
```

#### **Root Cause:**
- **HYPOTHESIS 1:** RLS policies not applied in production
- **HYPOTHESIS 2:** Client using wrong Supabase instance (anon vs authenticated)
- **HYPOTHESIS 3:** Session not properly set after `signInWithPassword()`

#### **Required Policies:**
```sql
-- ✅ SHOULD EXIST
CREATE POLICY "Users can read their own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"  
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

### 🟡 **MEDIUM: `user_profiles` table**

#### **Files Accessing:**
- `lib/2fa-service.ts` - Admin client ✅
- `app/api/2fa/route.ts` - Admin client ✅
- `components/AccountPage.tsx` - Client query ⚠️
- `components/AccountPageNew.tsx` - Client query ⚠️
- `components/SettingsModal.tsx` - Client query ⚠️
- `components/ThemeSelectorModal.tsx` - Client query ⚠️

#### **Pattern:**
```typescript
// API Routes: Use admin (correct for sensitive operations)
const { data } = await supabaseAdmin
  .from('user_profiles')
  .update({ two_factor_enabled: true })
  .eq('user_id', userId);

// Components: Should use authenticated client
const { data } = await supabase // ⚠️ Which supabase instance?
  .from('user_profiles')
  .select('*')
  .eq('user_id', userId)
  .single();
```

#### **Issue:**
Mixed usage. Some files import from `@/lib/supabase`, others use admin client.  
Need to audit which `supabase` instance is being used.

---

### 🟢 **GOOD: `trusted_devices` table**

#### **Files Accessing:**
- `lib/supabase-auth-strict.ts` - Client (anon + authenticated)
- `lib/device-fingerprint-pro.ts` - Client
- `app/api/verify-device-code/route.ts` - Admin
- `app/api/verify-device/route.ts` - Admin

#### **Pattern:**
```typescript
// ✅ GOOD: Special policy for anon users during verification
CREATE POLICY "Allow reading unverified devices for validation"
  ON trusted_devices FOR SELECT TO anon
  USING (
    verification_code IS NOT NULL 
    AND verified_at IS NULL 
    AND verification_expires_at > NOW()
  );

// ✅ GOOD: Authenticated users read own devices
CREATE POLICY "Users can read their own devices"
  ON trusted_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

#### **Status:** ✅ Well-designed, works correctly

---

### 🟡 **CONCERN: `address_book` table**

#### **Files Accessing:**
- `components/AddressBook.tsx` - Client
- `components/AddContactModal.tsx` - Client

#### **Current Policy (from migration):**
```sql
-- ⚠️ TOO PERMISSIVE!
CREATE POLICY "Users can view their own contacts"
  ON address_book FOR SELECT
  TO authenticated, anon
  USING (
    (auth.uid()::text = user_id) OR
    true  -- ⚠️ DANGER: Always returns true!
  );
```

#### **Issue:**
The `OR true` makes this policy completely open! Anyone can read ANY address book entry.

#### **Correct Policy:**
```sql
CREATE POLICY "Users can view their own contacts"
  ON address_book FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);
-- Remove anon access and "OR true"
```

---

### 🟢 **GOOD: `scheduled_transactions` table**

#### **Files Accessing:**
- `app/api/cron/execute-scheduled-txs/route.ts` - Admin ✅
- `app/api/smart-scheduler/*/route.ts` - Admin ✅
- Components - None (good!)

#### **Pattern:**
```typescript
// ✅ CORRECT: Only server-side with admin client
const { data } = await supabaseAdmin
  .from('scheduled_transactions')
  .select('*')
  .eq('user_id', userId);
```

#### **Status:** ✅ Proper separation (server-only, admin access)

---

### 🟡 **UNKNOWN: `onramp_transactions` table**

#### **Files Accessing:**
- `components/OnrampTransactionsPanel.tsx` - Client
- `app/api/moonpay/webhook/route.ts` - Admin
- `app/api/onramper/webhook/route.ts` - Admin

#### **Needs Investigation:**
- What RLS policies exist?
- Can client properly read user's own transactions?
- Are webhooks using correct auth?

---

## 🔧 ROOT CAUSE ANALYSIS

### **Problem 1: Multiple Supabase Clients**

```typescript
// File: lib/supabase.ts
export const supabase = createClient(url, anonKey);  // Anon client

// File: lib/supabase-admin.ts  
export const supabaseAdmin = createClient(url, serviceRoleKey);  // Admin client

// File: Various components
import { supabase } from '@/lib/supabase';  // Which one???
```

**Issue:** Not clear which client is authenticated vs anon.

---

### **Problem 2: Session Management**

```typescript
// After sign-in:
await supabase.auth.signInWithPassword({ email, password });

// Immediately query:
const { data } = await supabase.from('wallets').select('*');
// ❌ Fails! Session not yet propagated to client?
```

**Issue:** Timing problem or client instance issue.

---

### **Problem 3: Inconsistent Patterns**

| Operation | Some Files Use | Other Files Use |
|-----------|----------------|-----------------|
| Read own profile | Client (authenticated) | Server (admin) |
| Update settings | Client | Server endpoint |
| Read wallet | ❌ Fails on client | Server endpoint (workaround) |

**Issue:** No consistent architecture pattern.

---

## 💡 RECOMMENDED SOLUTIONS

### **Option A: Fix RLS + Use Authenticated Client (BEST)**

**Pattern:**
```typescript
// 1. Ensure supabase client is authenticated
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createClientComponentClient();

// 2. After sign-in, client is automatically authenticated
await supabase.auth.signInWithPassword({ email, password });

// 3. All queries now have auth context
const { data } = await supabase
  .from('wallets')
  .select('*')
  .eq('user_id', userId)
  .single();
// ✅ Works! RLS policy: auth.uid() = user_id
```

**Benefits:**
- ✅ Fast (no extra API calls)
- ✅ Secure (RLS enforced)
- ✅ Standard Supabase pattern
- ✅ Less server load

**Required:**
1. Ensure ALL tables have proper RLS policies
2. Use correct Supabase client (`createClientComponentClient`)
3. Verify session is set after sign-in

---

### **Option B: Server Endpoints + Admin (CURRENT)**

**Pattern:**
```typescript
// Client → API Route → Admin Query
const response = await fetch('/api/get-wallet', {
  method: 'POST',
  body: JSON.stringify({ userId })
});
```

**Benefits:**
- ✅ Works around RLS issues
- ✅ Server has full control

**Drawbacks:**
- ❌ Slower (extra API call)
- ❌ More code to maintain
- ❌ Higher server costs
- ❌ Not how Supabase is designed

---

### **Option C: Hybrid (PRAGMATIC)**

**Pattern:**
```typescript
// Sensitive operations: Server + Admin
- Wallet decryption
- 2FA setup/verification
- Device verification

// Regular reads: Client + RLS
- User profile
- Address book
- Transaction history
- Onramp transactions
```

**Benefits:**
- ✅ Security where needed
- ✅ Performance for regular ops
- ✅ Clear separation

---

## 🎯 ACTION ITEMS (PRIORITY ORDER)

### **🔴 CRITICAL - Must Fix Immediately:**

1. **Fix `wallets` table RLS**
   - [ ] Verify policies exist in production database
   - [ ] Run migration: `20260127130000_fix_wallets_rls_policy.sql`
   - [ ] Test client query works after sign-in

2. **Fix `address_book` overly permissive policy**
   - [ ] Remove `OR true` from policy
   - [ ] Remove `anon` role access
   - [ ] Test address book still works

### **🟡 HIGH PRIORITY - Fix This Sprint:**

3. **Audit Supabase client usage**
   - [ ] Document which files use which client
   - [ ] Ensure authenticated operations use authenticated client
   - [ ] Create helper functions for common queries

4. **Standardize session management**
   - [ ] Ensure session persists after sign-in
   - [ ] Add session refresh logic if needed
   - [ ] Test sign-in → immediate query flow

### **🟢 MEDIUM PRIORITY - Next Sprint:**

5. **Create RLS policy documentation**
   - [ ] Document all tables and their policies
   - [ ] Create developer guide for new queries
   - [ ] Add comments in migration files

6. **Refactor to consistent pattern**
   - [ ] Choose Option A, B, or C above
   - [ ] Update all files to follow pattern
   - [ ] Remove workarounds

---

## 📋 CHECKLIST: Is RLS Properly Used?

### **For EACH table, verify:**

- [ ] RLS is enabled (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`)
- [ ] Policies exist for all operations (SELECT, INSERT, UPDATE, DELETE)
- [ ] Policies use `auth.uid()` correctly
- [ ] Anon access is limited to necessary operations only
- [ ] Service role access is documented and intentional
- [ ] Client queries work without 400/403 errors
- [ ] No `OR true` bypass clauses

---

## 🔍 NEXT STEPS

1. **Verify current state in Supabase Dashboard:**
   ```sql
   -- Check wallets table
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'wallets';
   
   SELECT * FROM pg_policies 
   WHERE tablename = 'wallets';
   ```

2. **Test client queries in production:**
   - Sign in with test account
   - Open DevTools Console
   - Try direct Supabase queries
   - Check for 400/403 errors

3. **Make decision on architecture:**
   - Option A: Pure RLS (recommended)
   - Option B: Server endpoints (workaround)
   - Option C: Hybrid (pragmatic)

4. **Implement fixes based on findings**

---

## 🚨 SECURITY CONCERNS

### **Current Vulnerabilities:**

1. **`address_book` table:**
   - `OR true` policy allows anyone to read all contacts
   - **Severity:** HIGH
   - **Impact:** Data leak

2. **`wallets` table:**
   - Client queries fail, forcing server workaround
   - **Severity:** MEDIUM
   - **Impact:** Performance + complexity

3. **Inconsistent auth patterns:**
   - Mix of client/server makes auditing difficult
   - **Severity:** MEDIUM
   - **Impact:** Maintenance + future bugs

---

## ✅ CONCLUSION

**Bottom Line:** RLS policies EXIST but are NOT being used correctly.

**Immediate Action Required:**
1. Fix `wallets` RLS in production (run migration)
2. Fix `address_book` overly permissive policy
3. Choose consistent architecture pattern
4. Test and validate all fixes

**Time Estimate:** 2-4 hours to fix critical issues + proper testing

---

*End of Report*

