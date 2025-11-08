#!/bin/bash

# Script to add kms:Decrypt permission to blaze-wallet-kms-user
# Run this with admin AWS credentials

echo "🔍 Checking current user..."
aws sts get-caller-identity

echo ""
echo "📋 Listing inline policies for blaze-wallet-kms-user..."
POLICY_NAME=$(aws iam list-user-policies --user-name blaze-wallet-kms-user --query 'PolicyNames[0]' --output text)

if [ "$POLICY_NAME" = "None" ] || [ -z "$POLICY_NAME" ]; then
    echo "❌ No inline policy found. Checking attached policies..."
    aws iam list-attached-user-policies --user-name blaze-wallet-kms-user
    echo ""
    echo "ℹ️  Please identify your policy name and run:"
    echo "   aws iam get-user-policy --user-name blaze-wallet-kms-user --policy-name YOUR_POLICY_NAME"
    exit 1
fi

echo "✅ Found inline policy: $POLICY_NAME"
echo ""
echo "📄 Current policy document:"
aws iam get-user-policy --user-name blaze-wallet-kms-user --policy-name "$POLICY_NAME" --query 'PolicyDocument' --output json

echo ""
echo "🔧 Creating updated policy with kms:Decrypt..."

# Create the updated policy document
cat > /tmp/kms-policy-updated.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:GetPublicKey",
        "kms:Encrypt",
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:us-east-1:730335187618:key/5c6e2816-ce71-4e0a-85cd-70f8c03e3f8e"
    }
  ]
}
EOF

echo "📤 Uploading updated policy..."
aws iam put-user-policy \
  --user-name blaze-wallet-kms-user \
  --policy-name "$POLICY_NAME" \
  --policy-document file:///tmp/kms-policy-updated.json

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Policy updated with kms:Decrypt permission"
    echo ""
    echo "📄 New policy document:"
    aws iam get-user-policy --user-name blaze-wallet-kms-user --policy-name "$POLICY_NAME" --query 'PolicyDocument' --output json
    echo ""
    echo "🎉 Your scheduled transactions should now execute successfully!"
    echo "⏰ Next cron run will attempt execution (every 5 minutes)"
else
    echo ""
    echo "❌ Failed to update policy. Check error message above."
    exit 1
fi

# Cleanup
rm /tmp/kms-policy-updated.json

