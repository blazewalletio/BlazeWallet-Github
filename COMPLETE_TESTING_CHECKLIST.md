# ✅ BLAZE WALLET - COMPLETE TESTING CHECKLIST
**Date:** 2026-01-27  
**Version:** Hybrid (Optie C) Implementation  
**Status:** 🔴 READY FOR TESTING (After DB Migrations)

---

## 📋 PRE-TESTING: Database Migrations

### ✅ **STAP 1: Run Migrations in Supabase**

**Go to:** https://supabase.com/dashboard → Your Project → SQL Editor

#### **Migration 1: Fix address_book RLS (CRITICAL!)**
```sql
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.address_book;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.address_book;

-- Create proper, secure RLS policies
CREATE POLICY "Users can view their own contacts"
  ON public.address_book FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON public.address_book FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.address_book FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.address_book FOR DELETE TO authenticated
  USING (auth.uid()::text = user_id);

ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;
```

#### **Migration 2: Verify onramp_transactions RLS**
```sql
DROP POLICY IF EXISTS "Users can read their own transactions" ON public.onramp_transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.onramp_transactions;

CREATE POLICY "Users can read their own transactions"
  ON public.onramp_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
  ON public.onramp_transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.onramp_transactions ENABLE ROW LEVEL SECURITY;
```

#### **Migration 3: Verify wallets RLS**
```sql
-- Check if policies exist:
SELECT * FROM pg_policies WHERE tablename = 'wallets';

-- If empty, run:
DROP POLICY IF EXISTS "Users can read their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Service role can manage wallets" ON public.wallets;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own wallet"
  ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"  
  ON public.wallets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet"
  ON public.wallets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage wallets"
  ON public.wallets FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

## 🧪 TESTING SUITE

### **TEST GROUP 1: Wallet Operations (Server-Side) 🔐**

#### **Test 1.1: Sign Up with Email**
- [ ] Go to https://blazewallet.app
- [ ] Click "Sign Up"
- [ ] Enter email: `test+hybrid@blazewallet.app`
- [ ] Enter password: `TestPassword123!`
- [ ] Submit
- [ ] **Expected:** Account created, wallet created via `/api/wallet/create`
- [ ] **Check console:** Should see `✅ [CreateWallet] Wallet created successfully`
- [ ] **Verify:** Can see mnemonic backup phrase
- [ ] **Check:** No 400/403 errors in console

#### **Test 1.2: Sign In with Email**
- [ ] Log out
- [ ] Sign in with same credentials
- [ ] **Expected:** Wallet fetched via `/api/get-wallet`
- [ ] **Check console:** Should see `✅ [GetWallet] Wallet found successfully`
- [ ] **Verify:** Wallet unlocks, balances load
- [ ] **Check:** No 400/403 errors

#### **Test 1.3: Import Existing Wallet**
- [ ] Sign up with new email: `test+import@blazewallet.app`
- [ ] Choose "Import Wallet"
- [ ] Enter a test mnemonic
- [ ] Set password
- [ ] **Expected:** Wallet imported via `/api/wallet/create`
- [ ] **Verify:** Wallet created successfully
- [ ] **Check console:** No errors

#### **Test 1.4: Wallet Backup/Update**
- [ ] Sign in
- [ ] Go to Settings → Backup Wallet
- [ ] Change password (if feature exists)
- [ ] **Expected:** Wallet updated via `/api/wallet/update`
- [ ] **Verify:** New encrypted wallet saved

**✅ PASS CRITERIA:** All wallet operations use server endpoints, no client 400 errors

---

### **TEST GROUP 2: User Profile (Client-Side RLS) ⚡**

#### **Test 2.1: Theme Settings**
- [ ] Sign in
- [ ] Go to Account → Theme
- [ ] Change theme (Light/Dark/Auto)
- [ ] **Expected:** UPDATE to `user_profiles` via client RLS
- [ ] **Check console:** No 400/403 errors
- [ ] **Verify:** Theme persists after page refresh

#### **Test 2.2: Notification Settings**
- [ ] Go to Settings → Notifications
- [ ] Toggle notification preferences
- [ ] **Expected:** UPDATE to `user_profiles` via client RLS
- [ ] **Verify:** Settings saved correctly

#### **Test 2.3: Display Name**
- [ ] Go to Account → Profile
- [ ] Change display name
- [ ] **Expected:** UPDATE to `user_profiles` via client RLS
- [ ] **Verify:** Name updated successfully

#### **Test 2.4: Balance Visibility Toggle**
- [ ] Go to Dashboard
- [ ] Toggle "Hide Balance" button
- [ ] **Expected:** UPDATE to `user_profiles.balance_visible` via client RLS
- [ ] **Verify:** Balance shows/hides correctly

**✅ PASS CRITERIA:** All profile updates work via client RLS, fast response time

---

### **TEST GROUP 3: Address Book (Client-Side RLS) 📇**

#### **Test 3.1: Add Contact**
- [ ] Sign in
- [ ] Go to Address Book
- [ ] Click "Add Contact"
- [ ] Enter name: "Test Contact"
- [ ] Enter address: `0x1234...`
- [ ] Save
- [ ] **Expected:** INSERT to `address_book` via client RLS
- [ ] **Check console:** Should see `📝 [AddContactModal]` logs
- [ ] **Verify:** Contact appears in list

#### **Test 3.2: Edit Contact**
- [ ] Click Edit on a contact
- [ ] Change name
- [ ] Save
- [ ] **Expected:** UPDATE to `address_book` via client RLS
- [ ] **Verify:** Changes saved

#### **Test 3.3: Delete Contact**
- [ ] Click Delete on a contact
- [ ] Confirm deletion
- [ ] **Expected:** DELETE from `address_book` via client RLS
- [ ] **Verify:** Contact removed

#### **Test 3.4: Security Check (IMPORTANT!)**
- [ ] Open DevTools Console
- [ ] Try to query all contacts:
  ```javascript
  const { data } = await supabase.from('address_book').select('*');
  console.log(data);
  ```
- [ ] **Expected:** Should ONLY return current user's contacts
- [ ] **Verify:** Cannot see other users' contacts (RLS working!)

**✅ PASS CRITERIA:** Address book CRUD works, security enforced (no other users' data visible)

---

### **TEST GROUP 4: Transaction History (Client-Side RLS) 💸**

#### **Test 4.1: View Onramp Transactions**
- [ ] Sign in
- [ ] Go to Buy/Sell → Transaction History
- [ ] **Expected:** SELECT from `onramp_transactions` via client RLS
- [ ] **Verify:** Only current user's transactions shown
- [ ] **Check:** No 400/403 errors

#### **Test 4.2: Filter Transactions**
- [ ] Apply date filter
- [ ] Apply status filter
- [ ] **Expected:** Filtered queries work via client RLS
- [ ] **Verify:** Correct transactions displayed

**✅ PASS CRITERIA:** Transaction history loads correctly, only user's own transactions

---

### **TEST GROUP 5: Smart Schedule (Already Server-Side) 🔄**

#### **Test 5.1: Create Scheduled Transaction**
- [ ] Sign in
- [ ] Go to Smart Send
- [ ] Create a scheduled transaction:
  - To: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
  - Amount: `0.01 ETH`
  - Schedule: Tomorrow 10:00 AM
- [ ] Submit
- [ ] **Expected:** INSERT to `scheduled_transactions` via admin client
- [ ] **Check console:** Should see success message
- [ ] **Verify:** Transaction appears in "Scheduled" list

#### **Test 5.2: List Scheduled Transactions**
- [ ] Go to Smart Send → View Scheduled
- [ ] **Expected:** SELECT from `scheduled_transactions` via admin client
- [ ] **Verify:** All user's scheduled transactions shown
- [ ] **Check:** Correct status (pending/completed/failed)

#### **Test 5.3: Cancel Scheduled Transaction**
- [ ] Click "Cancel" on a pending transaction
- [ ] Confirm cancellation
- [ ] **Expected:** UPDATE to `scheduled_transactions` via admin client
- [ ] **Verify:** Status changed to "cancelled"

#### **Test 5.4: View Transaction History**
- [ ] Go to Smart Send → History
- [ ] **Expected:** SELECT completed/failed transactions
- [ ] **Verify:** Shows executed transactions only

**✅ PASS CRITERIA:** Smart schedule fully functional (already using admin client, not affected by our changes)

---

### **TEST GROUP 6: 2FA & Device Verification (Already Server-Side) 🔐**

#### **Test 6.1: Enable 2FA**
- [ ] Sign in
- [ ] Go to Account → Security → 2FA
- [ ] Click "Enable 2FA"
- [ ] Scan QR code in authenticator app
- [ ] Enter 6-digit code
- [ ] **Expected:** Uses admin client (already correct)
- [ ] **Verify:** 8 backup codes displayed
- [ ] **Check:** 2FA enabled successfully

#### **Test 6.2: Sign In with 2FA**
- [ ] Log out
- [ ] Sign in with email/password
- [ ] Enter device verification code (from email)
- [ ] Enter 2FA code (from authenticator app)
- [ ] **Expected:** Uses admin client for verification
- [ ] **Verify:** Successfully signed in

#### **Test 6.3: Device Verification**
- [ ] Log out
- [ ] Sign in from "new device" (clear localStorage or use incognito)
- [ ] **Expected:** Receive verification email
- [ ] Enter 6-digit code from email
- [ ] **Verify:** Device verified, signed in

**✅ PASS CRITERIA:** 2FA and device verification work (already using server endpoints)

---

### **TEST GROUP 7: Edge Cases & Security 🔒**

#### **Test 7.1: Unauthorized Access (Security)**
- [ ] Open DevTools Console
- [ ] Try to access another user's wallet:
  ```javascript
  const response = await fetch('/api/get-wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'other-user-id' })
  });
  console.log(await response.json());
  ```
- [ ] **Expected:** Should fail with 401 Unauthorized (if we add session validation)
- [ ] **Or:** Returns empty/error (admin can access but shouldn't expose to client)
- [ ] **Note:** Consider adding session validation to wallet endpoints!

#### **Test 7.2: RLS Bypass Attempt**
- [ ] Open DevTools Console
- [ ] Try to query all wallets:
  ```javascript
  const { data } = await supabase.from('wallets').select('*');
  console.log(data);
  ```
- [ ] **Expected:** Should return EMPTY (client queries blocked by RLS)
- [ ] **Verify:** Cannot access wallets via client queries

#### **Test 7.3: Address Book Cross-User Access**
- [ ] Create contact for User A
- [ ] Sign in as User B
- [ ] Try to query User A's contacts:
  ```javascript
  const { data } = await supabase
    .from('address_book')
    .select('*')
    .eq('user_id', 'user-a-id');
  console.log(data);
  ```
- [ ] **Expected:** Should return EMPTY (RLS blocks cross-user access)

**✅ PASS CRITERIA:** Security enforced, no unauthorized data access

---

### **TEST GROUP 8: Performance & Console Checks 🚀**

#### **Test 8.1: Wallet Operation Latency**
- [ ] Time sign-in operation
- [ ] **Acceptable:** < 500ms for wallet fetch (server endpoint)
- [ ] **Note:** Slight increase from client query acceptable for security

#### **Test 8.2: Profile Update Latency**
- [ ] Time theme change
- [ ] **Expected:** < 200ms (fast client RLS query)
- [ ] **Verify:** No noticeable lag

#### **Test 8.3: Console Error Check**
- [ ] Navigate through entire app
- [ ] **Check console for:**
  - ❌ No 400 Bad Request errors
  - ❌ No 403 Forbidden errors
  - ❌ No "policy violated" errors
  - ❌ No "auth.uid() is null" warnings

**✅ PASS CRITERIA:** Good performance, clean console

---

## 🎯 OVERALL SUCCESS CRITERIA

### **✅ Must Pass:**
- [ ] All wallet operations work (signup, signin, import)
- [ ] Profile settings save correctly (theme, notifications)
- [ ] Address book CRUD fully functional
- [ ] Transaction history loads
- [ ] Smart schedule still works
- [ ] 2FA/device verification functional
- [ ] NO 400/403 errors in console
- [ ] Users can ONLY access their own data
- [ ] Address book RLS fixed (no data leak)

### **🔧 Nice to Have (Future Improvements):**
- [ ] Add session validation to wallet endpoints (prevent userId spoofing)
- [ ] Add rate limiting to sensitive endpoints
- [ ] Add server-side logging for audit trail
- [ ] Monitor performance metrics

---

## 📊 TEST RESULTS TRACKING

### **Date:** _______  
### **Tester:** _______  
### **Environment:** Production / Staging

| Test Group | Status | Notes |
|------------|--------|-------|
| 1. Wallet Ops | ⬜ | |
| 2. User Profile | ⬜ | |
| 3. Address Book | ⬜ | |
| 4. Transactions | ⬜ | |
| 5. Smart Schedule | ⬜ | |
| 6. 2FA/Device | ⬜ | |
| 7. Security | ⬜ | |
| 8. Performance | ⬜ | |

**Legend:** ✅ Pass | ❌ Fail | ⚠️ Issues | ⬜ Not Tested

---

## 🐛 ISSUES FOUND (If Any)

### **Issue #1:**
- **Description:**
- **Severity:** Critical / High / Medium / Low
- **Steps to Reproduce:**
- **Expected:**
- **Actual:**
- **Fix:**

---

## ✅ SIGN-OFF

- [ ] All critical tests passed
- [ ] No security vulnerabilities found
- [ ] Performance acceptable
- [ ] Ready for production

**Tested by:** _________________  
**Date:** _________________  
**Approved by:** _________________

---

*End of Testing Checklist*

