# 🔐 AWS KMS SETUP GUIDE - BLAZE WALLET

**Datum:** 6 november 2025  
**Purpose:** Setup AWS KMS voor Ephemeral Key Encryption (Scheduled Transactions)

---

## 📋 PREREQUISITES

1. AWS Account with billing enabled
2. AWS CLI installed: `brew install awscli` (macOS)
3. IAM user with KMS permissions

---

## 🔑 STEP 1: CREATE IAM USER

```bash
# Log in to AWS Console
# Navigate to: IAM → Users → Add User

# User details:
Name: blaze-wallet-kms-user
Access type: ☑️ Programmatic access

# Permissions:
Attach policy: AWSKeyManagementServicePowerUser

# Save credentials:
Access Key ID: AKIAXXXXXXXXXXXXXXXX
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ⚙️ STEP 2: CONFIGURE AWS CLI

```bash
# Configure AWS CLI
aws configure

# Enter:
AWS Access Key ID: <YOUR_ACCESS_KEY_ID>
AWS Secret Access Key: <YOUR_SECRET_ACCESS_KEY>
Default region name: us-east-1
Default output format: json

# Verify configuration
aws sts get-caller-identity
```

**Expected output:**
```json
{
  "UserId": "AIDAXXXXXXXXXXXXXXXXX",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/blaze-wallet-kms-user"
}
```

---

## 🔐 STEP 3: CREATE KMS KEY

```bash
# Create RSA-4096 KMS key for encryption
aws kms create-key \
  --description "BLAZE Wallet Scheduled Transaction Encryption Key" \
  --key-usage ENCRYPT_DECRYPT \
  --customer-master-key-spec RSA_4096 \
  --origin AWS_KMS \
  --region us-east-1

# Save the KeyId from output:
# Example: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
```

**Expected output:**
```json
{
  "KeyMetadata": {
    "AWSAccountId": "123456789012",
    "KeyId": "12345678-1234-1234-1234-123456789012",
    "Arn": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
    "CreationDate": "2025-11-06T...",
    "Enabled": true,
    "Description": "BLAZE Wallet Scheduled Transaction Encryption Key",
    "KeyUsage": "ENCRYPT_DECRYPT",
    "KeyState": "Enabled",
    "Origin": "AWS_KMS",
    "KeyManager": "CUSTOMER",
    "CustomerMasterKeySpec": "RSA_4096",
    "EncryptionAlgorithms": [
      "RSAES_OAEP_SHA_256"
    ]
  }
}
```

**⚠️ SAVE THIS ARN - You'll need it for environment variables!**

---

## 🏷️ STEP 4: CREATE KEY ALIAS

```bash
# Create friendly alias
aws kms create-alias \
  --alias-name alias/blaze-scheduled-tx \
  --target-key-id 12345678-1234-1234-1234-123456789012 \
  --region us-east-1

# Verify alias
aws kms list-aliases --region us-east-1 | grep blaze
```

**Expected output:**
```json
{
  "AliasName": "alias/blaze-scheduled-tx",
  "AliasArn": "arn:aws:kms:us-east-1:123456789012:alias/blaze-scheduled-tx",
  "TargetKeyId": "12345678-1234-1234-1234-123456789012"
}
```

---

## 🔓 STEP 5: GET PUBLIC KEY

```bash
# Retrieve public key for client-side encryption
aws kms get-public-key \
  --key-id alias/blaze-scheduled-tx \
  --region us-east-1 \
  --output json > kms-public-key.json

# View public key
cat kms-public-key.json
```

**Expected output:**
```json
{
  "KeyId": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
  "PublicKey": "MIICIjANBgkqhkiG9w0BAQ...", // Base64 encoded
  "KeyUsage": "ENCRYPT_DECRYPT",
  "KeySpec": "RSA_4096",
  "EncryptionAlgorithms": [
    "RSAES_OAEP_SHA_256"
  ]
}
```

✅ **Public key successfully retrieved!**

---

## 🔄 STEP 6: ENABLE KEY ROTATION (OPTIONAL BUT RECOMMENDED)

```bash
# Enable automatic key rotation (every 365 days)
aws kms enable-key-rotation \
  --key-id alias/blaze-scheduled-tx \
  --region us-east-1

# Verify rotation is enabled
aws kms get-key-rotation-status \
  --key-id alias/blaze-scheduled-tx \
  --region us-east-1
```

**Expected output:**
```json
{
  "KeyRotationEnabled": true
}
```

---

## 📊 STEP 7: ENABLE CLOUDTRAIL LOGGING (RECOMMENDED)

```bash
# Navigate to: AWS CloudTrail → Trails → Create Trail

# Trail name: blaze-kms-audit
# Apply to all regions: Yes
# Management events: All (Read/Write)

# Event selectors:
☑️ Log AWS KMS events
```

✅ **All KMS operations will now be logged for security audit**

---

## 🔐 STEP 8: SET KEY POLICY (SECURITY)

```bash
# Create policy file
cat > kms-key-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Enable IAM User Permissions",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/blaze-wallet-kms-user"
      },
      "Action": [
        "kms:Decrypt",
        "kms:GetPublicKey"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Allow CloudTrail Logs",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "kms:GenerateDataKey",
      "Resource": "*"
    }
  ]
}
EOF

# Apply policy
aws kms put-key-policy \
  --key-id alias/blaze-scheduled-tx \
  --policy-name default \
  --policy file://kms-key-policy.json \
  --region us-east-1
```

⚠️ **IMPORTANT:** Replace `123456789012` with your actual AWS Account ID!

---

## 🌍 STEP 9: ADD ENVIRONMENT VARIABLES

### **Local (.env.local):**

```bash
# Create/update .env.local
cat >> .env.local << 'EOF'

# AWS KMS Configuration
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
AWS_KMS_KEY_ALIAS=alias/blaze-scheduled-tx
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
EOF
```

### **Vercel (Production):**

```bash
# Add to Vercel via CLI or Dashboard

# Option 1: Via CLI
vercel env add AWS_KMS_KEY_ID production
# Paste: arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012

vercel env add AWS_KMS_KEY_ALIAS production
# Paste: alias/blaze-scheduled-tx

vercel env add AWS_ACCESS_KEY_ID production
# Paste: AKIAXXXXXXXXXXXXXXXX

vercel env add AWS_SECRET_ACCESS_KEY production
# Paste: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

vercel env add AWS_REGION production
# Paste: us-east-1

# Option 2: Via Dashboard
# 1. Go to: https://vercel.com/blazewalletio/blaze-wallet-21-10/settings/environment-variables
# 2. Add each variable above
# 3. Select: ☑️ Production ☑️ Preview ☑️ Development
```

---

## ✅ STEP 10: VERIFY SETUP

```bash
# Test KMS connectivity
aws kms describe-key \
  --key-id alias/blaze-scheduled-tx \
  --region us-east-1

# Test encryption (dummy data)
echo "test-data" | base64 > test.txt
aws kms encrypt \
  --key-id alias/blaze-scheduled-tx \
  --plaintext fileb://test.txt \
  --encryption-algorithm RSAES_OAEP_SHA_256 \
  --region us-east-1 \
  --output json > encrypted.json

# Test decryption
aws kms decrypt \
  --key-id alias/blaze-scheduled-tx \
  --ciphertext-blob fileb://<(cat encrypted.json | jq -r .CiphertextBlob | base64 -d) \
  --encryption-algorithm RSAES_OAEP_SHA_256 \
  --region us-east-1

# Cleanup
rm test.txt encrypted.json
```

✅ **If both commands succeed, KMS is working!**

---

## 📊 COST ESTIMATE

**AWS KMS Pricing (us-east-1):**
- Customer managed keys: $1.00/month
- API requests: $0.03 per 10,000 requests
- Free tier: 20,000 requests/month

**Expected cost for Blaze Wallet:**
- Base cost: $1.00/month
- Requests: ~5,000/month (schedule + execute)
- **Total: ~$1.00/month** 💰

---

## 🔒 SECURITY BEST PRACTICES

1. ✅ **Never commit AWS credentials to git**
2. ✅ **Rotate credentials every 90 days**
3. ✅ **Enable CloudTrail logging**
4. ✅ **Use IAM roles instead of keys (if possible)**
5. ✅ **Monitor KMS usage in CloudWatch**
6. ✅ **Set billing alerts ($5/month threshold)**
7. ✅ **Enable MFA for AWS Console access**

---

## 🆘 TROUBLESHOOTING

### **Error: "AccessDeniedException"**
```bash
# Check IAM permissions
aws iam get-user-policy \
  --user-name blaze-wallet-kms-user \
  --policy-name KMSAccess

# Re-attach policy if needed
aws iam attach-user-policy \
  --user-name blaze-wallet-kms-user \
  --policy-arn arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser
```

### **Error: "Key not found"**
```bash
# List all keys
aws kms list-keys --region us-east-1

# Check if key is enabled
aws kms describe-key --key-id <KEY_ID> --region us-east-1
```

### **Error: "Region not found"**
```bash
# Check AWS CLI config
cat ~/.aws/config

# Set region explicitly
export AWS_DEFAULT_REGION=us-east-1
```

---

## ✅ CHECKLIST

Before proceeding to Phase 1.2, verify:

- [ ] AWS CLI configured and working
- [ ] KMS key created with RSA_4096
- [ ] Key alias created: `alias/blaze-scheduled-tx`
- [ ] Public key retrieved successfully
- [ ] Key policy applied (least privilege)
- [ ] CloudTrail logging enabled
- [ ] Environment variables added to .env.local
- [ ] Environment variables added to Vercel
- [ ] Test encryption/decryption successful
- [ ] Billing alert configured ($5 threshold)

---

## 📚 REFERENCES

- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/kms/)
- [KMS Pricing](https://aws.amazon.com/kms/pricing/)
- [Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)

---

**Next Step:** Proceed to Phase 1.2 - Create `lib/kms-service.ts` 🚀

