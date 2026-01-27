# 🔐 2FA COMPLETE ANALYSE & VOORSTEL - BLAZE WALLET

**Datum:** 27 januari 2026  
**Status:** Productie Analyse  
**Prioriteit:** 🔴 KRITIEK - Beveiligingslek gevonden

---

## 📊 HUIDIGE IMPLEMENTATIE

### ✅ **Wat WERKT:**

#### 1. **2FA Setup Flow** ✅
- **Locatie:** `app/api/2fa/route.ts` + `components/TwoFactorModal.tsx`
- **Functionaliteit:**
  - Genereert TOTP secret met `otplib`
  - Creëert QR code voor authenticator apps
  - Slaat secret op in `user_profiles.two_factor_secret`
  - Verifieert code tijdens setup
  - Zet `user_profiles.two_factor_enabled = true`
  
#### 2. **2FA Database Schema** ✅
- **Tabel:** `user_profiles`
- **Velden:**
  - `two_factor_enabled: boolean`
  - `two_factor_secret: text` (encrypted)
  - `two_factor_method: text` ('authenticator')
- **Security Score:** +15 punten bij enabled

#### 3. **UI Components** ✅
- **TwoFactorModal:** Setup, verify, disable flow
- **AccountPage:** Toggle en management
- Mooi gestyled, volledig geïntegreerd

---

## 🔴 **WAT NIET WERKT (KRITIEK):**

### **PROBLEEM 1: 2FA WORDT NOOIT GEVERIFIEERD BIJ LOGIN!** 🚨

**Locatie:** `lib/supabase-auth-strict.ts` regel 333-342

```typescript
// 2. Verify 2FA code (placeholder - implement with actual 2FA service)
// TODO: Implement actual 2FA verification
if (twoFactorCode.length !== 6) {
  return { success: false, error: 'Invalid 2FA code format' };
}

logger.log('✅ [StrictAuth] 2FA verified (placeholder)');
```

**☠️ DIT IS EEN KRITIEK BEVEILIGINGSLEK!**

De code checkt **ALLEEN** de length, maar **NIET** of de code correct is!

**Betekent:**
- Een user met 2FA enabled kan inloggen met **ELKE** 6-digit code
- `123456` werkt, `000000` werkt, `999999` werkt
- 2FA biedt **NULA** bescherming

---

### **PROBLEEM 2: Inconsistente 2FA Check Locatie**

**Twee verschillende flows:**

1. **Device Verification Flow (Nieuw):**
   - Checkt `user.app_metadata.two_factor_enabled`
   - Gebruikt `verifyDeviceAndSignIn()` met 2FA code
   - **MAAR:** Verificatie is broken (zie Probleem 1)

2. **Normale Login Flow (Oud):**
   - `signInWithEmail()` in `lib/supabase-auth.ts`
   - **CHECKT HELEMAAL GEEN 2FA!**
   - Alleen email + password

**Betekent:**
- Oude wallets (zonder device verification) hebben **GEEN 2FA check**
- 2FA is **OPTIONEEL** terwijl het **VERPLICHT** zou moeten zijn

---

### **PROBLEEM 3: 2FA Secret Storage**

**Huidige situatie:**
- Secret wordt opgeslagen in `user_profiles.two_factor_secret`
- Als **plaintext** (niet encrypted!)
- Database admin kan secrets lezen
- Bij database breach zijn alle 2FA secrets gecompromitteerd

---

### **PROBLEEM 4: Geen Backup Codes**

**Als user:**
- Telefoon verliest
- Authenticator app verwijdert
- Nieuwe telefoon

**Dan:** Permanent locked out! Geen recovery mogelijk.

---

### **PROBLEEM 5: Geen Rate Limiting op 2FA**

**Huidige situatie:**
- Unlimited 2FA attempts mogelijk
- Brute force aanval kan in ~3 uur alle 1 miljoen codes proberen
- Geen lockout na foute pogingen

---

## 🎯 **ALLERBESTE VOORSTEL: COMPLETE 2FA FIX**

### **Fase 1: KRITIEKE FIXES (Nu implementeren)** 🔴

#### 1. **Implementeer Echte 2FA Verificatie**

```typescript
// In lib/supabase-auth-strict.ts
export async function verify2FACode(
  userId: string,
  code: string
): Promise<boolean> {
  try {
    // Get user's 2FA secret
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('two_factor_secret')
      .eq('user_id', userId)
      .single();
    
    if (!profile?.two_factor_secret) {
      return false;
    }
    
    // Verify TOTP code met otplib
    const isValid = authenticator.verify({
      token: code,
      secret: profile.two_factor_secret,
      window: 1, // Allow 1 step before/after (30 sec tolerance)
    });
    
    return isValid;
  } catch (error) {
    logger.error('2FA verification error:', error);
    return false;
  }
}
```

#### 2. **Forceer 2FA Check in Alle Login Flows**

**A. Device Verification Flow:**
```typescript
// In verifyDeviceAndSignIn()
if (has2FA) {
  const is2FAValid = await verify2FACode(device.user_id, twoFactorCode);
  if (!is2FAValid) {
    return { success: false, error: 'Invalid 2FA code' };
  }
}
```

**B. Normale Login Flow:**
```typescript
// In signInWithEmail() - na password check
const { data: profile } = await supabase
  .from('user_profiles')
  .select('two_factor_enabled')
  .eq('user_id', user.id)
  .single();

if (profile?.two_factor_enabled) {
  // Show 2FA modal BEFORE allowing access
  return {
    success: false,
    requires2FA: true,
    userId: user.id,
  };
}
```

#### 3. **Rate Limiting op 2FA**

```typescript
// In rate-limiter.ts
export function check2FARateLimit(userId: string): RateLimitResult {
  return checkRateLimit(
    `2fa:${userId}`,
    5, // Max 5 attempts
    15 * 60 * 1000 // 15 minuten lockout
  );
}
```

#### 4. **2FA Secret Encryption**

```typescript
// Encrypt secret voor database storage
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY!;

export function encrypt2FASecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  });
}

export function decrypt2FASecret(encryptedData: string): string {
  const { encrypted, iv, authTag } = JSON.parse(encryptedData);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

### **Fase 2: BACKUP & RECOVERY (Daarna)** 🟡

#### 5. **Backup Codes Genereren**

```typescript
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code.match(/.{1,4}/g)!.join('-')); // Format: XXXX-XXXX
  }
  
  return codes;
}

// Store hashed in database
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
```

**Database schema toevoeging:**
```sql
ALTER TABLE user_profiles 
ADD COLUMN two_factor_backup_codes JSONB DEFAULT '[]';

COMMENT ON COLUMN user_profiles.two_factor_backup_codes IS 
'Hashed backup codes for 2FA recovery (SHA-256)';
```

#### 6. **2FA Recovery Flow**

```typescript
// Nieuwe modal: TwoFactorRecoveryModal
// - User kan backup code invoeren
// - Code wordt gehashed en vergeleken
// - Bij match: 2FA disabled + nieuwe setup vereist
// - Code wordt verwijderd na gebruik (one-time)
```

---

### **Fase 3: ADVANCED FEATURES (Optioneel)** 🟢

#### 7. **SMS 2FA (Fallback)**

- Integratie met Twilio
- SMS backup code als authenticator niet werkt
- Kost ~€0.05 per SMS

#### 8. **Trusted Locations**

- Sla IP ranges op van trusted locations
- Skip 2FA als login van trusted locatie
- Extra convenience zonder security loss

#### 9. **Remember This Device (30 dagen)**

- Na succesvolle 2FA: optie "Trust this device for 30 days"
- Cookie met encrypted token
- Reduced friction voor dagelijks gebruik

---

## 📋 **IMPLEMENTATIE CHECKLIST**

### **🔴 KRITIEK (Nu doen):**

- [ ] Implementeer `verify2FACode()` met echte otplib verificatie
- [ ] Fix `verifyDeviceAndSignIn()` om echte 2FA check te doen
- [ ] Fix `signInWithEmail()` om 2FA te vereisen
- [ ] Implementeer rate limiting (5 attempts / 15 min)
- [ ] Encrypt 2FA secrets in database
- [ ] Add `TWO_FACTOR_ENCRYPTION_KEY` env var
- [ ] Test end-to-end: setup → login → verify

### **🟡 BELANGRIJK (Deze week):**

- [ ] Genereer backup codes bij 2FA setup
- [ ] Toon backup codes aan user (print/download)
- [ ] Implementeer backup code verificatie
- [ ] Add database column voor backup codes
- [ ] Migreer bestaande users (re-encrypt secrets)

### **🟢 NICE TO HAVE (Later):**

- [ ] SMS fallback via Twilio
- [ ] Trusted locations feature
- [ ] "Remember device" cookie
- [ ] 2FA enforcement voor high-value transactions

---

## 🎯 **WAAROM DIT VOORSTEL HET BESTE IS:**

1. **✅ Lost Kritiek Beveiligingslek Op**
   - 2FA werkt nu echt, niet als placebo

2. **✅ Backward Compatible**
   - Bestaande 2FA users blijven werken
   - Nieuwe encryption laag is opt-in

3. **✅ Industry Standard**
   - TOTP (RFC 6238) is proven technology
   - Backup codes zijn best practice (Google, GitHub, etc.)

4. **✅ User Friendly**
   - Rate limiting voorkomt spam
   - Backup codes voorkomen lockouts
   - Remember device reduceert friction

5. **✅ Compliance Ready**
   - GDPR: Encrypted storage ✅
   - PSD2: Strong authentication ✅
   - SOC 2: Audit logging ✅

---

## 💰 **KOSTEN & TIJD**

### **Fase 1 (Kritiek):**
- **Tijd:** 4-6 uur development
- **Kosten:** €0 (alleen code changes)
- **Impact:** ⭐⭐⭐⭐⭐ KRITIEK

### **Fase 2 (Backup):**
- **Tijd:** 3-4 uur development
- **Kosten:** €0
- **Impact:** ⭐⭐⭐⭐ HOOG

### **Fase 3 (Advanced):**
- **Tijd:** 8-10 uur development
- **Kosten:** ~€50/maand voor Twilio (optioneel)
- **Impact:** ⭐⭐⭐ MEDIUM

---

## ⚠️ **RISICO'S ALS WE NIETS DOEN:**

1. **🔴 KRITIEK:** Users denken dat ze 2FA hebben, maar het werkt niet
2. **🔴 KRITIEK:** Account takeovers mogelijk met alleen password
3. **🟡 HOOG:** Database breach = alle 2FA secrets gelekt
4. **🟡 HOOG:** Users locked out zonder recovery optie
5. **🟢 MEDIUM:** Brute force 2FA codes mogelijk

---

## 🚀 **AANBEVELING:**

**Implementeer Fase 1 (Kritiek) NU - vandaag nog!**

Dit is een **kritiek beveiligingslek** dat binnen 4-6 uur gefixed kan worden. De huidige 2FA implementatie geeft valse security en moet zo snel mogelijk worden gerepareerd.

**Ik kan dit voor je implementeren als je zegt: "Ja, fix dit nu!"**

---

**Klaar voor productie? Laat het me weten!** 🔥

