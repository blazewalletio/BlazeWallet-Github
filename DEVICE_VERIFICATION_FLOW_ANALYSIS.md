# 🔍 DEVICE VERIFICATION FLOW - COMPLETE ANALYSE

## 📊 HUIDIGE FLOW (100% Accurate)

### 🎯 **STAP 1: USER LOGIN (Email + Password)**
**File**: `lib/supabase-auth-strict.ts` → `strictSignInWithEmail()`

1. ✅ Supabase auth: `signInWithPassword(email, password)`
2. ✅ **Device ID ophalen**: `DeviceIdManager.getOrCreateDeviceId()`
   - **localStorage check**: `blaze_device_id`
   - Als **NIET** bestaat → **NIEUWE UUID genereren** → Opslaan in localStorage
   - Als **WEL** bestaat → **Bestaande UUID gebruiken**
3. ✅ **Fingerprint genereren**: `generateEnhancedFingerprint()`
   - Browser fingerprint (canvas, fonts, WebGL, etc.)
   - IP-adres, locatie, timezone, browser, OS
   - Risk score berekenen (Tor/VPN detection, suspicious patterns)
4. ✅ **Risk check**: Als `riskScore >= 70` → **BLOCK** + security alert email
5. ✅ **Database lookup**: Query `trusted_devices` WHERE `user_id = X` AND `device_id = Y`
   - Als **GEVONDEN** + `verified_at` ≠ null → **TRUSTED DEVICE** → Wallet decrypt → **SUCCESS**
   - Als **NIET GEVONDEN** → **NEW DEVICE** → Stap 2

---

### 🚨 **STAP 2: NEW DEVICE DETECTED**
**File**: `lib/supabase-auth-strict.ts` (regel 294-481)

1. ✅ **6-digit code genereren**: `Math.floor(100000 + Math.random() * 900000)`
2. ✅ **Device token genereren**: `crypto.randomBytes(32).toString('hex')`
3. ✅ **Database check**: Query `trusted_devices` WHERE `user_id = X` AND `device_id = Y`
   - Als **GEVONDEN** (maar niet verified) → **UPDATE** record met nieuwe code
   - Als **NIET GEVONDEN** → **INSERT** new record
4. ✅ **Email versturen**: Via `/api/device-verification-code` → 6-digit code naar email
5. ✅ **Sign out user**: `supabase.auth.signOut()` (voor security)
6. ✅ **Return**: `requiresDeviceVerification: true` + `deviceVerificationToken`

---

### 📧 **STAP 3: USER ENTERS 6-DIGIT CODE**
**Component**: `components/DeviceVerificationModal.tsx`

1. ✅ User typt 6-digit code in
2. ✅ **Validate code**: POST `/api/verify-device-code`
   - Query: `trusted_devices` WHERE `verification_token = X` AND `verification_code = Y`
   - Als **INVALID** → Error
   - Als **EXPIRED** → Error
   - Als **VALID** → Check 2FA status
3. ✅ **Als 2FA enabled** → Stap 4
4. ✅ **Als GEEN 2FA** → Direct naar Stap 5

---

### 🔐 **STAP 4: 2FA VERIFICATION (Optional)**
**Component**: `components/DeviceVerificationModal.tsx` (regel 182-224)

1. ✅ User typt 6-digit 2FA code in
2. ✅ **Verify 2FA**: `verify2FACode(user_id, code)`
3. ✅ Als **INVALID** → Error
4. ✅ Als **VALID** → Stap 5

---

### ✅ **STAP 5: DEVICE VERIFICATION COMPLETE**
**File**: `lib/supabase-auth-strict.ts` → `verifyDeviceAndSignIn()` (regel 549-580)

1. ✅ **Mark device as verified**:
   ```sql
   UPDATE trusted_devices SET
     verified_at = NOW(),
     is_current = true,
     session_token = <new_random_token>,
     last_verified_session_at = NOW()
   WHERE id = <device_id>
   ```
2. ✅ **Store session token**: `sessionStorage.setItem('blaze_session_token', token)`
3. ✅ **Sign in again**: `supabase.auth.signInWithPassword(email, password)`
4. ✅ **Decrypt wallet**: Fetch encrypted mnemonic + decrypt with password
5. ✅ **SUCCESS** → User is logged in!

---

## 🔄 **DEVICE VERIFICATION CHECK (On Every Page Load)**
**File**: `lib/device-verification-check-v2.ts` → `isDeviceVerified()`

### **LAYER 1: PERSISTENT DEVICE ID** (Primary Check)
```typescript
const { deviceId, isNew } = DeviceIdManager.getOrCreateDeviceId();
```
- **localStorage check**: `blaze_device_id`
- Als **NIET EXISTS** → `isNew = true` → **SKIP DATABASE CHECK** → Go to Layer 4
- Als **EXISTS** → `isNew = false` → Query database:
  ```sql
  SELECT * FROM trusted_devices 
  WHERE user_id = X AND device_id = Y
  ```
  - Als **GEVONDEN** + `verified_at` ≠ null → **✅ VERIFIED**
  - Als **NIET GEVONDEN** → Go to Layer 4

### **LAYER 4: TRUSTED SESSION** (Grace Period)
```typescript
const sessionToken = sessionStorage.getItem('blaze_session_token');
```
- Als **EXISTS** → Query database:
  ```sql
  SELECT * FROM trusted_devices 
  WHERE user_id = X AND session_token = Y
  ```
  - Check `last_verified_session_at` < 1 hour ago
  - Als **VALID** → **Restore device_id** to localStorage → **✅ VERIFIED**
  - Als **EXPIRED** → Go to Layer 2

### **LAYER 2: FINGERPRINT** (Fallback)
```typescript
const fingerprint = await getCachedOrGenerateFingerprint();
```
- Query database:
  ```sql
  SELECT * FROM trusted_devices 
  WHERE user_id = X AND device_fingerprint = Y
  ```
  - Als **EXACT MATCH** + `verified_at` ≠ null → **Restore device_id** → **✅ VERIFIED**
  - Als **NO MATCH** → Go to Layer 3

### **LAYER 3: SMART HEURISTIC MATCHING** (Last Resort)
```typescript
const match = await findBestDeviceMatch(user_id, fingerprint, deviceInfo);
```
- **Score-based matching** (max 170 points):
  - Browser match: +25 points
  - OS match: +20 points
  - Screen resolution match: +15 points
  - Language match: +10 points
  - Timezone match: +10 points
  - Fingerprint similarity: +50 points (max)
  - IP proximity: +20 points (max)
  - Time-based decay: -5 points per 30 days
- Als **Score ≥ 120** → **Auto-recover** → Update fingerprint → **✅ VERIFIED**
- Als **Score 80-119** → **Medium confidence** → User confirmation needed
- Als **Score < 80** → **❌ ALL LAYERS FAILED** → Email verification required

---

## 🔥 **HET PROBLEEM**

### **ROOT CAUSE 1: localStorage Wipe**
**iOS/Safari behavior**:
- Na 7 dagen inactivity → localStorage cleared
- **Result**: `blaze_device_id` = `null`
- `DeviceIdManager.getOrCreateDeviceId()` → **NIEUWE UUID** → `isNew = true`
- **LAYER 1 SKIPPED** (regel 203-208 in `device-verification-check-v2.ts`)
- **LAYER 4 FAILS** (geen `sessionStorage` token na browser restart)
- **LAYER 2 FAILS** (fingerprint veranderd door iOS update)
- **LAYER 3 FAILS** (score te laag door tijd + fingerprint change)
- **RESULT**: 🚫 "Device not recognized"

### **ROOT CAUSE 2: Fingerprint Volatility**
**iOS Safari fingerprint changes**:
- iOS update → Canvas fingerprint changed
- Safari update → WebGL fingerprint changed
- Privacy mode → Fonts list limited
- **Result**: `device_fingerprint` ≠ stored fingerprint
- **LAYER 2 FAILS** (no exact match)
- **LAYER 3 MAY FAIL** (similarity score too low)

### **ROOT CAUSE 3: LAYER 1 Logic Flaw**
**Code**: `device-verification-check-v2.ts` regel 203-208
```typescript
if (!isNew) {
  // Check database
} else {
  logger.log('🆕 [Layer 1] NEW device ID generated (first time on this device)');
  // SKIP DATABASE CHECK! ← BUG!
}
```
**Probleem**: Als localStorage cleared → SKIP database check → Geen recovery mogelijk!

---

## 🚨 **WAAROM DIT ZO SLECHT IS**

### ❌ **Security vs UX Conflict**
- **Security**: Moet new devices blocken
- **UX**: Mag trusted devices niet blocken
- **Current**: Blokkeert trusted devices omdat localStorage unreliable is

### ❌ **Over-reliance on localStorage**
- **LAYER 1**: Depends on `localStorage.blaze_device_id`
- **LAYER 4**: Depends on `sessionStorage.blaze_session_token`
- **Both clear** after 7 days / browser restart → **BEIDE FALEN**

### ❌ **Fingerprint Instability**
- **iOS**: Fingerprint changes frequently
- **Safari**: Privacy features intentionally break fingerprinting
- **Result**: LAYER 2 & 3 fail too often

### ❌ **No Persistent Server-Side Recovery**
- **Current**: 4 layers, ALL depend on client-side storage or fingerprint
- **Missing**: Server-side persistent identifier (like device UUID in database)

---

## 💡 **WAT ANDERE WALLETS DOEN**

### 🏆 **MetaMask** (Best Practice)
- **Device ID**: Persistent in database (UUID)
- **Recovery**: Email link → "This is me" → Re-authorize device
- **No localStorage dependency**: Device ID stored in Supabase, not localStorage

### 🏆 **Coinbase Wallet**
- **Device ID**: Server-side stored
- **Recovery**: SMS code → Re-verify device
- **Biometric**: Face ID/Touch ID as primary auth

### 🏆 **Trust Wallet**
- **Device ID**: Hardware-based (iOS: identifierForVendor, Android: Android ID)
- **No fingerprinting**: Uses OS-provided stable IDs
- **Backup**: Cloud backup (iCloud/Google Drive)

---

## 🎯 **CONCLUSIE**

**Huidige flow is:**
1. ✅ **Veilig** (blocks new devices correctly)
2. ❌ **Onbetrouwbaar** (blocks trusted devices te vaak)
3. ❌ **Over-complex** (4 layers, none fully reliable)
4. ❌ **Client-side dependent** (localStorage = single point of failure)
5. ❌ **Fingerprint-dependent** (iOS Safari breaks this constantly)

**Wat het echt is:**
- Een **Fort Knox** die zijn eigen sleutels verliest 🔑🚪
- Een **Castle** zonder valbridge (no fallback recovery) 🏰

---

## 🚀 **VOLGENDE STAP: 3 BETERE VOORSTELLEN**

Zie `DEVICE_VERIFICATION_PROPOSALS.md` →

