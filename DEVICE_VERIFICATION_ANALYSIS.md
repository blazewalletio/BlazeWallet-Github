# 🔍 GRONDIGE ANALYSE: Device Verification Flow

## ✅ WAT IS HET VERSCHIL?

### **Email Verificatie** (Account Signup)
- **Wanneer:** Bij het aanmaken van een nieuw account
- **Tabel:** `email_verification_tokens`
- **API:** `/api/send-welcome-email` → `/api/auth/verify-email`
- **Doel:** Bevestigen dat het email adres echt is
- **Methode:** Link in email (token-based)

### **Device Verificatie** (Login Security)
- **Wanneer:** Bij inloggen op een nieuw/onbekend device
- **Tabel:** `trusted_devices` (kolom: `verification_code`)
- **API:** `/api/device-verification-code` → `/api/verify-device-code`
- **Doel:** Bevestigen dat het device legitiem is
- **Methode:** 6-digit code in email

## 🐛 PROBLEMEN GEVONDEN

### **PROBLEEM 1: API Mismatch in strictSignInWithEmail**
**Locatie:** `lib/supabase-auth-strict.ts` regel 469-485

**Wat er gebeurt:**
```typescript
// Code wordt al gegenereerd en opgeslagen in DB (regel 342, 382, 425)
const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

// Maar dan wordt er een fetch gedaan die VERKEERDE data stuurt:
const emailResponse = await fetch('/api/device-verification-code', {
  body: JSON.stringify({
    email: data.user.email,  // ❌ Mist userId!
    code: verificationCode,  // ❌ API genereert zelf een nieuwe code!
    deviceInfo: {
      deviceName: deviceInfo.deviceName,
      // ❌ Mist fingerprint! (belangrijkste veld)
      location: `${deviceInfo.location.city}, ${deviceInfo.location.country}`,
      ipAddress: deviceInfo.ipAddress,
      browser: `${deviceInfo.browser} ${deviceInfo.browserVersion}`,
      os: `${deviceInfo.os} ${deviceInfo.osVersion}`,
    },
  }),
});
```

**Wat de API verwacht:**
```typescript
// app/api/device-verification-code/route.ts regel 84
const { userId, email, deviceInfo } = await request.json();

// deviceInfo moet fingerprint bevatten!
```

**Gevolg:**
- ❌ API mist `userId` → faalt
- ❌ API mist `deviceInfo.fingerprint` → kan device niet vinden/updaten
- ❌ API genereert nieuwe code → code in DB komt niet overeen met code in email

### **PROBLEEM 2: Kolom naam mismatch**
**Locatie:** Database schema

**Wat er is:**
- `verification_expires_at` (voor verification_token - link-based verificatie)
- `verification_code_expires_at` (voor verification_code - 6-digit code)

**In strictSignInWithEmail:**
- Gebruikt `verification_expires_at` (regel 383, 426) ❌

**In device-verification-code API:**
- Gebruikt `verification_code_expires_at` (regel 110) ✅

**Gevolg:**
- Code wordt opgeslagen met verkeerde expiry kolom
- verify-device-code API kan expiry niet checken

### **PROBLEEM 3: RLS Policies**
**Status:** ✅ GEEN PROBLEEM
- API endpoints gebruiken `supabaseAdmin` (service_role)
- Service role bypassed RLS automatisch
- Policies zijn correct ingesteld voor authenticated users

### **PROBLEEM 4: Email wordt niet verstuurd**
**Oorzaak:** 
- API call faalt door missing `userId` en `fingerprint`
- Email wordt nooit verstuurd omdat API 400/500 error geeft

## ✅ WAT WERKT WEL?

1. ✅ RLS Policies zijn correct
2. ✅ Email service werkt (Resend API)
3. ✅ Database schema heeft alle benodigde kolommen
4. ✅ DeviceVerificationCodeModal component is goed
5. ✅ verify-device-code API logica is correct

## 🔧 WAT MOET GEFIXT WORDEN?

1. **Fix API call in strictSignInWithEmail:**
   - Voeg `userId` toe
   - Voeg `deviceInfo.fingerprint` toe
   - Verwijder `code` (laat API zelf genereren OF gebruik de code die al in DB staat)

2. **Fix kolom naam:**
   - Gebruik `verification_code_expires_at` in plaats van `verification_expires_at`

3. **Optie 1 implementeren:**
   - Verwijder medium confidence (40-59%)
   - Direct email verificatie bij score < 60%
   - Verwijder DeviceConfirmationModal
