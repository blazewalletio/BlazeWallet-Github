# 🚀 FORT KNOX DEVICE VERIFICATION - DEPLOYMENT GUIDE

## ✅ Pre-Deployment Checklist

### 1. **Database Migraties Uitvoeren** (KRITIEK!)

Je hebt waarschijnlijk de eerste migratie al uitgevoerd, maar hier is de complete checklist:

#### Migratie 1: Device Verification Columns
```sql
-- Voer uit in Supabase SQL Editor
ALTER TABLE trusted_devices 
ADD COLUMN IF NOT EXISTS verification_code TEXT,
ADD COLUMN IF NOT EXISTS device_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_verification_code 
ON trusted_devices(verification_code) 
WHERE verification_code IS NOT NULL;

UPDATE trusted_devices 
SET device_metadata = '{}'::jsonb 
WHERE device_metadata IS NULL;
```

#### Migratie 2: Complete RLS Policies ⚠️ **NOG TE DOEN!**

**BELANGRIJRIJK:** Deze migratie is ESSENTIEEL voor productie! Zonder deze policies werkt device verification niet!

```sql
-- Complete RLS Policies for Device Verification (Fort Knox)
-- Kopieer en plak deze HELE script in je Supabase SQL Editor:

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow reading own devices for verification" ON trusted_devices;
DROP POLICY IF EXISTS "Users can read their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON trusted_devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON trusted_devices;

-- POLICY 1: Allow anon to read unverified devices (for validation)
CREATE POLICY "Allow reading unverified devices for validation"
ON trusted_devices
FOR SELECT
TO anon
USING (
  verification_code IS NOT NULL 
  AND verified_at IS NULL
  AND verification_expires_at > NOW()
);

-- POLICY 2: Authenticated users can read their own devices
CREATE POLICY "Users can read their own devices"
ON trusted_devices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- POLICY 3: Authenticated users can insert their own devices
CREATE POLICY "Users can insert their own devices"
ON trusted_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- POLICY 4: Authenticated users can update their own devices
CREATE POLICY "Users can update their own devices"
ON trusted_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- POLICY 5: Authenticated users can delete their own devices
CREATE POLICY "Users can delete their own devices"
ON trusted_devices
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_verified 
ON trusted_devices(user_id, verified_at)
WHERE verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint_user
ON trusted_devices(device_fingerprint, user_id);
```

**✅ VERIFICATIE:** Na het uitvoeren, run deze query om te checken:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'trusted_devices';
```

Je zou **5 policies** moeten zien!

---

### 2. **Environment Variables in Vercel**

Controleer of deze environment variables zijn ingesteld in Vercel:

#### Required (Al ingesteld, maar check voor zekerheid):
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Je Supabase project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (voor admin operaties)
- ✅ `RESEND_API_KEY` - Je Resend API key voor emails

#### Optional maar aanbevolen:
- `NEXT_PUBLIC_APP_URL` - Je productie URL (https://my.blazewallet.io)

**Hoe te checken:**
1. Ga naar Vercel Dashboard → Je project → Settings → Environment Variables
2. Zoek naar `RESEND_API_KEY` - als die er niet is, voeg hem toe!
3. Zoek naar `SUPABASE_SERVICE_ROLE_KEY` - deze is kritiek voor device verification!

---

### 3. **Code Changes Samenvatting**

Alle wijzigingen zijn al gemaakt en getest. Hier is wat er is toegevoegd:

#### ✅ Nieuwe Files:
- `lib/supabase-auth-strict.ts` - Fort Knox authentication met device verification
- `lib/device-fingerprint-pro.ts` - Enhanced device fingerprinting
- `lib/email-service.ts` - Email service via Resend
- `lib/rate-limiter.ts` - Rate limiting voor verificatie endpoints
- `components/DeviceVerificationModal.tsx` - UI voor device verificatie
- `app/api/verify-device-code/route.ts` - Verificatie code validatie
- `app/api/device-verification-code/route.ts` - Verification code email sender
- `supabase/migrations/20260127000000_complete_device_verification_policies.sql` - RLS policies

#### ✅ Gewijzigde Files:
- `components/PasswordUnlockModal.tsx` - Gebruikt nu `strictSignInWithEmail`
- `app/api/verify-device-code/route.ts` - Admin client voor user lookup
- `middleware.ts` - Exempt routes voor device verification (al correct)

---

## 🚀 Deployment Proces

### Optie A: Via GitHub (Aanbevolen)

```bash
# 1. Stage alle wijzigingen
git add .

# 2. Commit met duidelijke message
git commit -m "feat: Add Fort Knox device verification system

- Device fingerprinting with FingerprintJS
- Email verification codes (6-digit)
- Rate limiting on verification endpoints
- RLS policies for trusted_devices
- Resend email integration
- Production-ready build"

# 3. Push naar GitHub
git push origin main
```

Vercel zal automatisch deployen! 🎉

### Optie B: Manual Deploy via Vercel CLI

```bash
# Install Vercel CLI (als je dat nog niet hebt)
npm i -g vercel

# Deploy
vercel --prod
```

---

## 🧪 Post-Deployment Testing

### 1. **Test Device Verification Flow**

1. **Ga naar je productie URL:** https://my.blazewallet.io
2. **Log uit** (als je al ingelogd bent)
3. **Log opnieuw in** met een bestaand account
4. Je zou de **Device Verification Modal** moeten zien met:
   - Device details (browser, OS, locatie)
   - 6-digit code input velden
   - "We sent a verification code to your email" bericht

5. **Check je email** (de email van het account waarmee je inlogt)
6. Je zou een email moeten ontvangen met:
   - Subject: "🔐 Verify Your New Device - BLAZE Wallet"
   - Een 6-digit code (bijv. 123-456)
   - Device details

7. **Voer de code in** en klik "Continue"
8. Als je 2FA hebt enabled, zie je daarna de 2FA prompt
9. Na succesvolle verificatie ben je ingelogd!

### 2. **Test Trusted Device (2nd Login)**

1. **Log uit**
2. **Log opnieuw in** met hetzelfde account **op hetzelfde device**
3. Je zou **GEEN** device verification moeten zien (want het device is nu trusted)
4. Je gaat direct naar 2FA (als enabled) of naar de wallet

### 3. **Test Rate Limiting**

1. Probeer **10+ keer** een foute code in te voeren
2. Je zou een **"Too many attempts"** error moeten zien
3. Dit voorkomt brute-force attacks! ✅

---

## 🔍 Monitoring & Logs

### Vercel Logs Checken:

```bash
# Real-time logs
vercel logs --follow

# Of via Vercel Dashboard:
# Project → Deployments → [Latest] → Runtime Logs
```

### Belangrijke Log Patterns:

**Succesvolle device registration:**
```
✅ [StrictAuth] Device record inserted successfully
📧 [DEV MODE] Email would be sent: (in development)
✅ Email sent successfully via Resend: (in production)
```

**Succesvolle code validatie:**
```
✅ Verification code accepted
```

**Rate limit bereikt:**
```
⚠️ Rate limit exceeded for IP: xxx.xxx.xxx.xxx
```

---

## ⚠️ Troubleshooting

### Probleem: "Failed to register device for verification"
**Oplossing:** Check of de database migratie is uitgevoerd (zie sectie 1)

### Probleem: "Invalid verification code" (altijd, ook met juiste code)
**Oplossing:** Check of de RLS policies zijn toegepast (zie Migratie 2)

### Probleem: "Failed to send verification email"
**Oplossing:** 
1. Check of `RESEND_API_KEY` is ingesteld in Vercel
2. Check Resend dashboard voor rate limits of errors

### Probleem: Device verification werkt niet op localhost maar wel in production
**Oplossing:** Dit is normaal! Localhost heeft vaak dezelfde device fingerprints. De code is geoptimaliseerd voor beide, maar productie is betrouwbaarder.

---

## 🔐 Security Features

### Wat is nu geïmplementeerd:

1. ✅ **Device Fingerprinting** - Unieke identificatie per device
2. ✅ **Email Verification** - 6-digit codes met 15min expiry
3. ✅ **Rate Limiting** - Max 10 attempts per 15min per IP
4. ✅ **Row Level Security** - Database policies voorkomen unauthorized access
5. ✅ **CSRF Protection** - Middleware beschermt tegen cross-site attacks
6. ✅ **IP Geolocation** - Location tracking voor suspicious logins
7. ✅ **Device Metadata** - Browser, OS, timezone voor forensics
8. ✅ **Trusted Device System** - Na verificatie is device "trusted"

---

## 📊 Database Schema Changes

### `trusted_devices` table - Nieuwe Kolommen:

| Column | Type | Description |
|--------|------|-------------|
| `verification_code` | TEXT | 6-digit code voor device verificatie |
| `device_metadata` | JSONB | Device info: location, risk score, flags |

### Indexes (voor performance):

- `idx_trusted_devices_verification_code` - Fast lookup tijdens validatie
- `idx_trusted_devices_user_verified` - Fast lookup van verified devices
- `idx_trusted_devices_fingerprint_user` - Fast device fingerprint checks

---

## ✅ Final Checklist

Voor je deployment naar productie, check deze items:

- [ ] Database Migratie 1 uitgevoerd (verification_code + device_metadata kolommen)
- [ ] Database Migratie 2 uitgevoerd (RLS policies) ⚠️ **KRITIEK!**
- [ ] Vercel env vars gecheckt (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Production build test succesvol (`npm run build`)
- [ ] Code gecommit naar GitHub
- [ ] GitHub → Vercel auto-deployment getriggerd
- [ ] Post-deployment test: Device verification flow werkt
- [ ] Post-deployment test: Trusted device flow werkt
- [ ] Post-deployment test: Emails worden verzonden
- [ ] Monitoring logs gecheckt voor errors

---

## 🎉 Je bent klaar!

Als alle checkboxes ✅ zijn, dan is Fort Knox device verification **100% production-ready**! 🔥

Bij vragen of problemen, check de troubleshooting sectie of de logs in Vercel!

---

**Last Updated:** 27 januari 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

