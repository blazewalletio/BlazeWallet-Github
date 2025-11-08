# 🔧 KMS PERMISSIONS FIX - INSTRUCTIES

## ❌ PROBLEEM GEVONDEN!
De scheduled transactions falen met "Failed to decrypt mnemonic" omdat de AWS user `blaze-wallet-kms-user` **geen `kms:Decrypt` permission** heeft op de KMS key.

## ✅ OPLOSSING

Je moet de KMS key policy updaten om decrypt permissions toe te staan. Er zijn 2 manieren:

---

### OPTIE A: Via AWS Console (Makkelijkst)

1. **Open AWS Console:** https://console.aws.amazon.com/kms/
   - Log in met een account dat admin rechten heeft (niet blaze-wallet-kms-user)

2. **Navigeer naar de KMS key:**
   - Region: `us-east-1`
   - Key ID: `566e43d3-7816-4cb7-beea-64849e8cabd6`
   - Of klik direct: https://console.aws.amazon.com/kms/home?region=us-east-1#/kms/keys/566e43d3-7816-4cb7-beea-64849e8cabd6

3. **Update Key Policy:**
   - Klik op tab "Key policy"
   - Klik op "Edit"
   - Voeg deze statement toe aan de "Statement" array:

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

4. **Save de policy**

---

### OPTIE B: Via AWS CLI (Met admin credentials)

Als je AWS credentials hebt met admin rechten, run dit commando:

```bash
aws kms put-key-policy \
  --key-id "arn:aws:kms:us-east-1:945695383591:key/566e43d3-7816-4cb7-beea-64849e8cabd6" \
  --policy-name default \
  --policy file://kms-policy-updated.json
```

De file `kms-policy-updated.json` staat al klaar in de project root.

---

## 🧪 VERIFICATIE

Na het toepassen van de policy, run dit commando om te testen:

```bash
KMS_KEY_ID="arn:aws:kms:us-east-1:945695383591:key/566e43d3-7816-4cb7-beea-64849e8cabd6"

# Test decrypt permission
aws kms decrypt \
  --key-id "$KMS_KEY_ID" \
  --ciphertext-blob fileb:///tmp/encrypted_key.bin \
  --encryption-algorithm RSAES_OAEP_SHA_256 \
  --query 'Plaintext' \
  --output text
```

Als dit werkt (geen AccessDeniedException meer), dan is het probleem opgelost!

---

## 📊 IMPACT

Na deze fix:
- ✅ Scheduled transactions zullen succesvol worden uitgevoerd
- ✅ Mnemonic decryptie zal werken in Vercel production
- ✅ De cron job kan transacties automatisch uitvoeren

---

## 🔐 SECURITY NOTE

Deze permissions zijn **veilig** omdat:
1. Alleen `blaze-wallet-kms-user` krijgt decrypt rechten
2. Alleen met algoritme `RSAES_OAEP_SHA_256` (via Condition)
3. De encrypted keys zijn al veilig opgeslagen in Supabase (RLS protected)
4. Na executie worden de encrypted keys verwijderd uit de database

---

## 📁 FILES

- `kms-policy-updated.json` - De nieuwe policy (ready to use)
- `/tmp/encrypted_key.bin` - Test encrypted key voor verificatie

---

**Zodra je de policy hebt toegepast, laat me weten en ik test meteen of de transacties werken!** 🚀

