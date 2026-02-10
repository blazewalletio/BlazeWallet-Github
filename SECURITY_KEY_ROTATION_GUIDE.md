# 🔐 KEY ROTATION GUIDE - SCHEDULED_TX_ENCRYPTION_KEY

**Datum**: 29 december 2025  
**Status**: Documentatie compleet

---

## 📊 OVERZICHT

De `SCHEDULED_TX_ENCRYPTION_KEY` is een master key die gebruikt wordt om alle ephemeral keys te encrypten voor scheduled transactions.

**Huidige situatie**:
- Single master key voor alle transactions
- Key wordt opgeslagen in Vercel environment variables
- Als key wordt gelekt, kunnen alle transactions worden gedecrypt

---

## 🔄 KEY ROTATION PROCESS

### **STAP 1: Genereer nieuwe key**

```bash
# Genereer een nieuwe 32-byte base64 key
openssl rand -base64 32
```

**Output voorbeeld**: `5d99XVm2ulafGh6nlxYEMutPHQs1fYRZphJ5TtQNC5c=`

---

### **STAP 2: Update Vercel Environment Variable**

1. Ga naar: https://vercel.com/dashboard
2. Selecteer project: **Blaze Wallet**
3. Ga naar: **Settings** → **Environment Variables**
4. Zoek: `SCHEDULED_TX_ENCRYPTION_KEY`
5. **Update** met nieuwe key (of voeg toe als niet bestaat)

**Via CLI**:
```bash
vercel env add SCHEDULED_TX_ENCRYPTION_KEY production
# Paste nieuwe key wanneer gevraagd
```

---

### **STAP 3: Re-encrypt alle pending transactions**

**⚠️ BELANGRIJK**: Alle pending transactions moeten worden gere-encrypt met de nieuwe key.

**SQL Query om pending transactions te vinden**:
```sql
SELECT 
  id,
  user_id,
  chain,
  amount,
  token_symbol,
  status,
  created_at
FROM scheduled_transactions
WHERE status IN ('pending', 'executing')
  AND encrypted_mnemonic IS NOT NULL
  AND kms_encrypted_ephemeral_key IS NOT NULL
ORDER BY created_at DESC;
```

**Migration Script** (toekomst):
- Script dat alle pending transactions leest
- Decrypt met oude key
- Re-encrypt met nieuwe key
- Update database

---

### **STAP 4: Deploy nieuwe code**

```bash
git push origin main
# Vercel deployt automatisch
```

---

## ⚠️ RISICO'S

**Als key wordt gelekt**:
- Alle encrypted ephemeral keys kunnen worden gedecrypt
- Alle mnemonics kunnen worden gedecrypt
- Alle scheduled transactions kunnen worden uitgevoerd door aanvaller

**Mitigatie**:
- Key wordt alleen gebruikt op backend (Vercel serverless)
- Key wordt nooit in logs gelogd
- Key wordt nooit naar client gestuurd
- Keys worden verwijderd na execution

---

## 🔮 TOEKOMST: AUTOMATISCHE KEY ROTATION

**Geplande features**:
- Key versioning (meerdere keys tegelijk)
- Automatische re-encryption van pending transactions
- Key expiration dates
- Per-user encryption keys

---

**Laatste update**: 29 december 2025  
**Status**: Documentatie compleet


