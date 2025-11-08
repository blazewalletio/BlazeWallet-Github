# Quick Fix Guide: Execute Your Scheduled Transaction

## Issue Found ✅

Your scheduled transaction at 15:41 did NOT execute due to **two issues**:

1. ✅ **FIXED**: CRON_SECRET had a trailing newline - I've corrected this in Vercel
2. ⚠️ **YOUR ACTION NEEDED**: AWS KMS IAM user is missing the `kms:Decrypt` permission

---

## Fix the KMS Permission (5 minutes)

### AWS Console Method (Easiest)

1. Open AWS IAM: https://console.aws.amazon.com/iam/
2. Go to **Users** → Find `blaze-wallet-kms-user`
3. Click **Permissions** tab
4. Find the attached policy (likely `blaze-wallet-kms-policy`)
5. Click **Edit policy**
6. Replace with this (or add `kms:Decrypt` if missing):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:GetPublicKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:945695383591:key/566e43d3-7816-4cb7-beea-64849e8cabd6"
    }
  ]
}
```

7. Save the policy

---

## Test Immediately After Fix

Once you've added the permission, test right away:

```bash
# Navigate to project
cd "/Users/rickschlimback/Desktop/BlazeWallet 21-10"

# Get the correct secret
vercel env pull .env.vercel.production --environment=production
CLEAN_SECRET=$(grep CRON_SECRET .env.vercel.production | cut -d '=' -f2 | tr -d '"' | tr -d "'" | sed 's/\\n$//' | xargs)

# Trigger cron manually to execute pending transactions
curl -X GET "https://my.blazewallet.io/api/cron/execute-scheduled-txs?CRON_SECRET=$CLEAN_SECRET" \
  -H "Content-Type: application/json" | jq .
```

**Success looks like:**
```json
{
  "success": true,
  "executed": 1,    // Your transaction executed!
  "failed": 0,
  "skipped": 0,
  "total": 1
}
```

---

## If You See Failed Transactions

If the test shows `"failed": 1` or more, check the logs:

```bash
vercel logs my.blazewallet.io
```

Look for any errors. The most common issues after KMS fix:
- Insufficient balance
- Invalid recipient address
- Network/RPC errors

---

## About Your Original Transaction

The transaction you scheduled for 15:41 may have expired (transactions have a 24-hour expiration). To check:

### Option 1: In Supabase SQL Editor
```sql
SELECT 
  id,
  status,
  scheduled_for,
  expires_at,
  amount,
  token_symbol,
  to_address,
  encrypted_mnemonic IS NOT NULL as can_execute
FROM scheduled_transactions
WHERE user_id = 'ricks_@live.nl'
  AND DATE(scheduled_for) = '2025-11-07'
ORDER BY created_at DESC;
```

### Option 2: Direct API Call
The cron job will automatically execute it if:
- Status is `pending`
- `scheduled_for` time has passed
- `expires_at` time has NOT passed
- `encrypted_mnemonic` exists

If expired, you'll need to reschedule it in the app.

---

## Verify Automatic Cron is Working

After fixing KMS:

1. Check Vercel Dashboard: https://vercel.com/blaze-wallets-projects/blaze-wallet
2. Go to **Settings** → **Crons**
3. Verify you see:
   - `/api/cron/execute-scheduled-txs` (every 5 minutes)
   - `/api/smart-scheduler/execute` (every 5 minutes)

If not listed → You need to redeploy:
```bash
git commit --allow-empty -m "Activate cron jobs"
git push origin main
```

---

## Questions?

- **KMS permission not working?** → Check IAM user name is exact: `blaze-wallet-kms-user`
- **Transaction still failing?** → Share the Vercel logs and I'll help debug
- **Want to reschedule?** → Just create a new scheduled transaction in the app

See `CRON_ISSUE_COMPLETE_ANALYSIS.md` for the full technical details.

---

**Status**: Ready for you to fix KMS permissions, then test! 🚀

