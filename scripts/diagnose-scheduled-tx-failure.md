# 🔍 DIAGNOSE: Waarom faalt de scheduled transaction?

## ✅ Wat werkt:
- EasyCron cron job draait correct (11:35 UTC execution gezien)
- Cron endpoint wordt aangeroepen
- Transaction wordt gevonden en geprocessed

## ❌ Wat faalt:
- Transaction execution: `"failed":1`
- Transactie wordt niet uitgevoerd

---

## 🔍 MOGELIJKE OORZAKEN:

### 1. Missing Environment Variable: `SCHEDULED_TX_ENCRYPTION_KEY`
**Symptoom**: Error "SCHEDULED_TX_ENCRYPTION_KEY is missing" of decrypt error

**Check**:
```bash
vercel env ls production | grep SCHEDULED_TX_ENCRYPTION_KEY
```

**Fix**: Genereer en voeg toe:
```bash
# Genereer key
openssl rand -base64 32

# Voeg toe aan Vercel
vercel env add SCHEDULED_TX_ENCRYPTION_KEY production
# Plak de gegenereerde key
```

---

### 2. Missing Encrypted Keys in Database
**Symptoom**: Error "Missing encrypted mnemonic. Transaction cannot be executed automatically."

**Check in Supabase**:
```sql
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  error_message,
  encrypted_mnemonic IS NOT NULL as has_encrypted_mnemonic,
  kms_encrypted_ephemeral_key IS NOT NULL as has_kms_key
FROM scheduled_transactions
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 1;
```

**Fix**: Als keys ontbreken, is de transactie aangemaakt zonder encryptie. Dit moet via de frontend worden gefixed.

---

### 3. Decrypt Error
**Symptoom**: Error "Failed to decrypt mnemonic" of "Encrypted ephemeral key is too short"

**Mogelijke oorzaken**:
- `SCHEDULED_TX_ENCRYPTION_KEY` is incorrect
- Encrypted data is corrupt
- Keys zijn niet correct opgeslagen

**Check Vercel Logs**:
```bash
vercel logs --follow
```

Zoek naar:
- "❌ Failed to decrypt mnemonic"
- "SCHEDULED_TX_ENCRYPTION_KEY is missing"
- "Encrypted ephemeral key is too short"

---

### 4. Insufficient Balance
**Symptoom**: Transaction fails tijdens blockchain execution

**Check**: Balance op het from_address

---

### 5. Network/RPC Error
**Symptoom**: RPC call faalt

**Check**: RPC endpoint beschikbaarheid

---

## 📋 STAP-VOOR-STAP DIAGNOSE:

### Stap 1: Check Error Message in Database
```sql
SELECT 
  id,
  chain,
  amount,
  token_symbol,
  status,
  error_message,
  retry_count,
  encrypted_mnemonic IS NOT NULL as has_keys,
  updated_at
FROM scheduled_transactions
WHERE status = 'failed'
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC
LIMIT 1;
```

### Stap 2: Check Environment Variable
```bash
vercel env ls production | grep SCHEDULED_TX_ENCRYPTION_KEY
```

### Stap 3: Check Vercel Logs
```bash
vercel logs --follow | grep -i "decrypt\|error\|failed"
```

---

## 🎯 MEEST WAARSCHIJNLIJKE OORZAAK:

Gezien de error response (`"failed":1`), is de meest waarschijnlijke oorzaak:

**Missing `SCHEDULED_TX_ENCRYPTION_KEY` environment variable**

De decryptie faalt omdat de symmetric key ontbreekt in Vercel.

---

## ✅ QUICK FIX:

1. **Genereer key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Voeg toe aan Vercel**:
   ```bash
   vercel env add SCHEDULED_TX_ENCRYPTION_KEY production
   ```

3. **Redeploy** (of wacht tot volgende deployment)

4. **Test opnieuw** met een nieuwe scheduled transaction

