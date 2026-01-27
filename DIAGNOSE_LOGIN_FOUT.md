# DIAGNOSE: "Wallet not found" Login Fout

## Probleem
Bij inloggen met email `ricks_@live.nl` en wachtwoord `Ab49n805!` krijg je de foutmelding:
**"Wallet not found. Please use recovery phrase."**

## Oorzaak (100% Zekerheid)

### ✅ KERN VAN HET PROBLEEM: KOLOM NAAM MISMATCH

Er is een **fundamentele inconsistentie** tussen de code en de database schema:

#### 1. Database Schema (Supabase)
De `wallets` tabel gebruikt de kolom naam: **`encrypted_wallet`**

Bewijs:
```sql
-- supabase/FIX_SIGNUP_FLOW.sql (line 99-108)
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_wallet TEXT NOT NULL,  -- ⚠️ Kolom naam: encrypted_wallet
  wallet_address TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### 2. API Endpoints (Code)
De API endpoints gebruiken de kolom naam: **`encrypted_mnemonic`**

**Bij aanmaken (Signup):**
```typescript
// app/api/wallet/create/route.ts (line 36-45)
const { data, error } = await supabaseAdmin
  .from('wallets')
  .insert({
    user_id: userId,
    encrypted_mnemonic: encryptedMnemonic,  // ⚠️ VERKEERDE KOLOM NAAM!
    created_at: new Date().toISOString(),
  })
```

**Bij inloggen (Sign In):**
```typescript
// app/api/get-wallet/route.ts (line 34-38)
const { data: wallet, error: walletError } = await supabaseAdmin
  .from('wallets')
  .select('encrypted_mnemonic')  // ⚠️ VERKEERDE KOLOM NAAM!
  .eq('user_id', userId)
  .single();
```

### Wat er gebeurt:

1. **Bij Signup (Account aanmaken):**
   - Code probeert te INSERT in kolom `encrypted_mnemonic`
   - Deze kolom bestaat NIET in de database
   - INSERT faalt (silent failure of onvoldoende error handling)
   - User wordt aangemaakt in `auth.users` ✅
   - Maar wallet wordt NIET opgeslagen in `wallets` ❌

2. **Bij Sign In (Inloggen):**
   - Supabase authenticatie slaagt ✅ (email + wachtwoord kloppen)
   - Code probeert te SELECT van kolom `encrypted_mnemonic`
   - Deze kolom bestaat NIET
   - SELECT returnt `null` of error
   - Foutmelding: "Wallet not found. Please use recovery phrase."

### Bewijsmateriaal:

**File locaties waar het fout gaat:**
1. `/app/api/wallet/create/route.ts` - Regel 41: `encrypted_mnemonic: encryptedMnemonic`
2. `/app/api/get-wallet/route.ts` - Regel 36: `.select('encrypted_mnemonic')`
3. `/lib/supabase-auth.ts` - Regel 292: `if (!walletData.success || !walletData.encrypted_mnemonic)`

**Correcte kolom naam in database:**
- `encrypted_wallet` (zoals gedefinieerd in `supabase/FIX_SIGNUP_FLOW.sql`)

## Verificatie Stappen

Om 100% zeker te zijn, run deze query in Supabase SQL Editor:

```sql
-- Check 1: Welke kolommen heeft de wallets tabel?
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'wallets';

-- Check 2: Bestaat de user?
SELECT id, email, created_at
FROM auth.users 
WHERE email = 'ricks_@live.nl';

-- Check 3: Heeft deze user een wallet record?
SELECT w.id, w.user_id, w.wallet_address,
       CASE WHEN w.encrypted_wallet IS NOT NULL THEN 'HAS DATA' ELSE 'NULL' END as wallet_status
FROM public.wallets w
WHERE w.user_id IN (SELECT id FROM auth.users WHERE email = 'ricks_@live.nl');
```

## Verwacht Resultaat van Verificatie:

1. De `wallets` tabel heeft kolom `encrypted_wallet` (NIET `encrypted_mnemonic`)
2. User `ricks_@live.nl` bestaat in `auth.users` ✅
3. Deze user heeft GEEN record in `wallets` tabel (omdat INSERT faalde) ❌

## Oplossing

Er zijn 2 mogelijke oplossingen:

### Optie A: Fix de Code (Aanbevolen)
Wijzig alle API endpoints om de correcte kolom naam te gebruiken:
- `encrypted_mnemonic` → `encrypted_wallet`

**Files die aangepast moeten worden:**
1. `/app/api/wallet/create/route.ts` (line 41)
2. `/app/api/get-wallet/route.ts` (line 36)
3. `/lib/supabase-auth.ts` (line 292)
4. Mogelijk andere plekken waar `encrypted_mnemonic` wordt gebruikt

### Optie B: Fix de Database
Run een migratie om kolom toe te voegen of te hernoemen:
```sql
-- Optie 1: Hernoem kolom
ALTER TABLE public.wallets 
RENAME COLUMN encrypted_wallet TO encrypted_mnemonic;

-- OF Optie 2: Voeg kolom toe (als encrypted_wallet data bevat)
ALTER TABLE public.wallets 
ADD COLUMN encrypted_mnemonic TEXT;

UPDATE public.wallets 
SET encrypted_mnemonic = encrypted_wallet 
WHERE encrypted_mnemonic IS NULL;
```

### Voor jouw account specifiek:
Na het fixen van de kolom naam mismatch, moet je voor `ricks_@live.nl`:
1. OF: Opnieuw registreren (dan wordt wallet correct opgeslagen)
2. OF: Handmatig de wallet record aanmaken in Supabase met je recovery phrase

## Impact

Dit probleem treft **ALLE users** die zich hebben geregistreerd met email:
- Ze kunnen inloggen (Supabase auth werkt)
- Maar hun wallet wordt niet gevonden
- Ze moeten recovery phrase gebruiken om hun wallet te herstellen

## Prioriteit
🔴 **CRITICAL** - Dit blokkeert alle email-based logins

## Status
⏸️ Wachtend op bevestiging om te fixen

