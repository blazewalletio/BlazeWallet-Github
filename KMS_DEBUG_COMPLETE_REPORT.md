# 🔍 COMPLETE DEBUG REPORT - SMART SCHEDULER

## 🎯 PROBLEEM
Scheduled transactions worden **NIET uitgevoerd** met error: **"Failed to decrypt mnemonic"**

---

## 🕵️ DEBUG PROCESS

### Step 1: Transaction Status Check ✅
```bash
Transaction 1: pending (scheduled 11:25 CET)
Transaction 2: pending (scheduled 11:23 CET)
Both: Error = "Failed to decrypt mnemonic"
```

### Step 2: Timezone Bug Check ✅ FIXED
**Issue:** Input 12:23 CET → Database 10:23 UTC (2 uur verschil!)  
**Fix:** Expliciete Date constructor in plaats van string parsing  
**Status:** ✅ Deployed to production (commit `7711204f`)

### Step 3: Web Crypto API Check ✅ FIXED
**Issue:** `globalThis.crypto` mogelijk niet beschikbaar in Vercel  
**Fix:** Robustere getCrypto() met fallback naar require('crypto').webcrypto  
**Status:** ✅ Deployed to production (commit `35ad8e65`)

### Step 4: Cron Job Status Check ✅
```bash
curl https://blaze-wallet.vercel.app/api/cron/execute-scheduled-txs
Result: { executed: 0, failed: 2, skipped: 0 }
```
✅ Cron job draait wel, maar transacties falen

### Step 5: AWS Credentials Check ✅
```bash
aws sts get-caller-identity
User: blaze-wallet-kms-user
Account: 945695383591
```
✅ AWS credentials werken

### Step 6: KMS Key Status Check ✅
```bash
KMS Key ID: arn:aws:kms:us-east-1:945695383591:key/566e43d3-7816-4cb7-beea-64849e8cabd6
KeyState: Enabled
KeyUsage: ENCRYPT_DECRYPT
```
✅ KMS key is enabled en functioneel

### Step 7: KMS Decrypt Test ❌ ROOT CAUSE FOUND!
```bash
aws kms decrypt --key-id ... --ciphertext-blob ...
Error: AccessDeniedException - User is not authorized to perform: kms:Decrypt
```

**🎯 ROOT CAUSE: AWS KMS PERMISSIONS ONTBREKEN!**

---

## 🔴 ROOT CAUSE ANALYSE

### De Issue
De AWS IAM user `blaze-wallet-kms-user` heeft **GEEN `kms:Decrypt` permission** op de KMS key.

### Wat werkt WEL:
- ✅ KMS key bestaat en is enabled
- ✅ User kan `kms:GetPublicKey` doen (gebruikt voor encryption tijdens scheduling)
- ✅ Encrypted data is correct opgeslagen in database
- ✅ Cron job draait elke 5 minuten
- ✅ Code logic is correct

### Wat werkt NIET:
- ❌ User kan **GEEN `kms:Decrypt`** doen
- ❌ Zonder decrypt kunnen we de mnemonic niet decrypten
- ❌ Zonder mnemonic kunnen we de transaction niet uitvoeren

### Waarom is dit gebeurd?
De KMS key policy heeft alleen permissions voor `root`:

```json
{
  "Principal": { "AWS": "arn:aws:iam::945695383591:root" },
  "Action": "kms:*",
  "Resource": "*"
}
```

De `blaze-wallet-kms-user` is **NIET expliciet toegevoegd** met decrypt rechten.

---

## ✅ OPLOSSING

### Stap 1: Update KMS Key Policy
Voeg deze statement toe aan de KMS key policy:

```json
{
  "Sid": "Allow Blaze Wallet KMS User",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::945695383591:user/blaze-wallet-kms-user"
  },
  "Action": [
    "kms:Decrypt",
    "kms:GetPublicKey",
    "kms:DescribeKey"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:EncryptionAlgorithm": "RSAES_OAEP_SHA_256"
    }
  }
}
```

### Stap 2: Via AWS Console
1. Open: https://console.aws.amazon.com/kms/home?region=us-east-1
2. Find key: `566e43d3-7816-4cb7-beea-64849e8cabd6`
3. Tab: "Key policy"
4. Click: "Edit"
5. Add statement boven
6. Save

### Stap 3: Test
```bash
aws kms decrypt \
  --key-id "arn:aws:kms:us-east-1:945695383591:key/566e43d3-7816-4cb7-beea-64849e8cabd6" \
  --ciphertext-blob fileb:///tmp/encrypted_key.bin \
  --encryption-algorithm RSAES_OAEP_SHA_256
```

Als dit werkt zonder error → **PROBLEEM OPGELOST!** ✅

### Stap 4: Trigger Cron
Na policy update:
```bash
curl "https://blaze-wallet.vercel.app/api/cron/execute-scheduled-txs" \
  -H "User-Agent: vercel-cron/1.0"
```

Expected result:
```json
{ "executed": 2, "failed": 0, "skipped": 0, "total": 2 }
```

---

## 📊 TIMELINE VAN FIXES

1. ✅ **Timezone Bug** (commit `7711204f`)
   - Problem: Date parsing ambiguity
   - Fix: Expliciete Date constructor
   - Deployed: 11:23 CET

2. ✅ **Web Crypto API** (commit `35ad8e65`)
   - Problem: globalThis.crypto niet beschikbaar
   - Fix: Robustere getCrypto() helper
   - Deployed: 11:30 CET

3. ⏳ **KMS Permissions** (pending user action)
   - Problem: No kms:Decrypt permission
   - Fix: Update KMS key policy
   - Status: **WAITING FOR USER**

---

## 🎯 VERWACHT RESULTAAT

Na KMS policy update:
- ✅ Cron job kan mnemonic decrypten
- ✅ Transactions worden succesvol uitgevoerd
- ✅ Solana transactions verschijnen on-chain
- ✅ Database status update naar "completed"
- ✅ Transaction hash wordt opgeslagen

---

## 📁 FILES CREATED

- `KMS_FIX_INSTRUCTIONS.md` - Detailed instructions voor de user
- `kms-policy-updated.json` - Ready-to-use policy file
- `KMS_DEBUG_COMPLETE_REPORT.md` - Dit document
- `/tmp/encrypted_key.bin` - Test encrypted key voor verificatie

---

## 🔐 SECURITY NOTES

De nieuwe permissions zijn veilig omdat:
1. **Specifieke user:** Alleen `blaze-wallet-kms-user`
2. **Specifiek algoritme:** Alleen `RSAES_OAEP_SHA_256`
3. **Encrypted storage:** Keys blijven encrypted in database (RLS protected)
4. **Auto-cleanup:** Keys worden verwijderd na successful execution
5. **Triple-layer encryption:** AES-256-GCM + KMS RSA-4096 + Supabase RLS

---

**STATUS:** ✅ Root cause identified - Waiting for user to apply KMS policy fix

**NEXT ACTION:** User moet KMS policy updaten via AWS Console (instructies in KMS_FIX_INSTRUCTIONS.md)

