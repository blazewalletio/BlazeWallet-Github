# 🔍 DIAGNOSE RESULTAAT - Scheduled Transaction Failure

## ✅ Wat werkt:
- **EasyCron cron job**: Draait correct (11:35 UTC execution gezien)
- **Cron endpoint**: Wordt aangeroepen (`/api/cron/execute-scheduled-txs`)
- **Response**: `{"success":true,"executed":0,"failed":1,"skipped":0,"total":1}`

## ❌ Wat faalt:
- **Transaction execution**: `"failed":1`
- **Transactie wordt niet uitgevoerd**

---

## 🔍 Meest Waarschijnlijke Oorzaak:

### **Missing `SCHEDULED_TX_ENCRYPTION_KEY` Environment Variable**

De decryptie flow:
1. `executeTransaction()` → Check encrypted keys ✅
2. `getPrivateKeyFromEncrypted()` → Decrypt ephemeral key
3. `decryptEphemeralKeySymmetric()` → **Gebruikt `SCHEDULED_TX_ENCRYPTION_KEY`**
4. Als key ontbreekt → **Decryptie faalt** → Transaction faalt

**Error die je waarschijnlijk ziet:**
- `"SCHEDULED_TX_ENCRYPTION_KEY is missing"`
- `"Failed to decrypt mnemonic"`
- `"Missing encrypted mnemonic"`

---

## 📋 CHECK & FIX STAPPEN:

### **STAP 1: Check Error in Supabase**

Ga naar: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/sql/new

Run deze query:
```sql
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  error_message,
  retry_count,
  encrypted_mnemonic IS NOT NULL as has_encrypted_mnemonic,
  kms_encrypted_ephemeral_key IS NOT NULL as has_kms_key,
  scheduled_for,
  updated_at
FROM scheduled_transactions
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 1;
```

**Dit toont de exacte `error_message`.**

---

### **STAP 2: Check Environment Variable in Vercel**

**Via Dashboard:**
1. Ga naar: https://vercel.com/dashboard
2. Selecteer project: **Blaze Wallet**
3. **Settings** → **Environment Variables**
4. Zoek: `SCHEDULED_TX_ENCRYPTION_KEY`

**Via CLI (als project gelinkt is):**
```bash
vercel env ls production | grep SCHEDULED_TX_ENCRYPTION_KEY
```

---

### **STAP 3: Fix - Voeg Key Toe (Als Die Ontbreekt)**

**Genereerde key:**
```
5d99XVm2ulafGh6nlxYEMutPHQs1fYRZphJ5TtQNC5c=
```

**Voeg toe via Vercel Dashboard:**
1. Ga naar: https://vercel.com/dashboard
2. Project → Settings → Environment Variables
3. Klik "Add New"
4. **Name**: `SCHEDULED_TX_ENCRYPTION_KEY`
5. **Value**: `5d99XVm2ulafGh6nlxYEMutPHQs1fYRZphJ5TtQNC5c=`
6. **Environment**: Production (en Preview/Development als nodig)
7. Klik "Save"

**Of via CLI:**
```bash
vercel env add SCHEDULED_TX_ENCRYPTION_KEY production
# Plak: 5d99XVm2ulafGh6nlxYEMutPHQs1fYRZphJ5TtQNC5c=
```

---

### **STAP 4: Redeploy**

Na het toevoegen van de key:
- **Automatisch**: Volgende deployment pakt de nieuwe env var op
- **Handmatig**: Trigger een nieuwe deployment

---

### **STAP 5: Test Opnieuw**

1. Maak een nieuwe scheduled transaction aan
2. Wacht tot de volgende EasyCron run (elke 5 minuten)
3. Check of de transactie wordt uitgevoerd

---

## 🔍 Andere Mogelijke Oorzaken:

### **1. Missing Encrypted Keys in Database**
**Symptoom**: `error_message = "Missing encrypted mnemonic. Transaction cannot be executed automatically."`

**Check**:
```sql
SELECT 
  id,
  encrypted_mnemonic IS NOT NULL as has_encrypted_mnemonic,
  kms_encrypted_ephemeral_key IS NOT NULL as has_kms_key
FROM scheduled_transactions
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 1;
```

**Fix**: Als keys ontbreken, is de transactie aangemaakt zonder encryptie. Dit moet via de frontend worden gefixed.

---

### **2. Decrypt Error**
**Symptoom**: `error_message = "Failed to decrypt mnemonic"` of `"Encrypted ephemeral key is too short"`

**Mogelijke oorzaken**:
- `SCHEDULED_TX_ENCRYPTION_KEY` is incorrect
- Encrypted data is corrupt
- Keys zijn niet correct opgeslagen

---

### **3. Insufficient Balance**
**Symptoom**: Transaction fails tijdens blockchain execution

**Check**: Balance op het `from_address` voor de chain

---

### **4. Network/RPC Error**
**Symptoom**: RPC call faalt

**Check**: RPC endpoint beschikbaarheid

---

## 📊 Vercel Logs Checken:

**Via Dashboard:**
1. Ga naar: https://vercel.com/dashboard
2. Selecteer project
3. **Deployments** → **Latest**
4. Klik op **"Functions"** tab
5. Zoek: `/api/cron/execute-scheduled-txs`
6. Check logs voor errors rond **11:35 UTC**

**Zoek naar:**
- `"❌ Failed to decrypt mnemonic"`
- `"SCHEDULED_TX_ENCRYPTION_KEY is missing"`
- `"Encrypted ephemeral key is too short"`
- `"Missing encrypted mnemonic"`

---

## ✅ Quick Fix Checklist:

- [ ] Check `error_message` in Supabase (Stap 1)
- [ ] Check `SCHEDULED_TX_ENCRYPTION_KEY` in Vercel (Stap 2)
- [ ] Voeg key toe als die ontbreekt (Stap 3)
- [ ] Redeploy (Stap 4)
- [ ] Test met nieuwe transaction (Stap 5)

---

**Laatste update**: 29 december 2025, 11:40 UTC
**Status**: Wacht op error_message check en environment variable verificatie

