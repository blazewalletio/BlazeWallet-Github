#!/bin/bash

# Script to add Onramper environment variables to Vercel
# Usage: ./scripts/add-onramper-env.sh

echo "🔑 Adding Onramper Environment Variables to Vercel"
echo ""

# Check if API key is provided as argument
if [ -z "$1" ]; then
  echo "Please provide your Onramper API key:"
  read -s ONRAMPER_API_KEY
  echo ""
else
  ONRAMPER_API_KEY=$1
fi

if [ -z "$ONRAMPER_API_KEY" ]; then
  echo "❌ Error: API key is required"
  exit 1
fi

# Ask for environment
echo "Select environment:"
echo "1) Production"
echo "2) Preview"
echo "3) Development"
echo "4) All (Production, Preview, Development)"
read -p "Enter choice [1-4] (default: 4): " env_choice
env_choice=${env_choice:-4}

# Add API key
echo ""
echo "Adding ONRAMPER_API_KEY..."

case $env_choice in
  1)
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY production
    ;;
  2)
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY preview
    ;;
  3)
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY development
    ;;
  4)
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY production
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY preview
    echo "$ONRAMPER_API_KEY" | vercel env add ONRAMPER_API_KEY development
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

# Ask for environment setting
echo ""
echo "Set ONRAMPER_ENVIRONMENT (sandbox or production):"
read -p "Enter environment [sandbox/production] (default: production): " onramper_env
onramper_env=${onramper_env:-production}

case $env_choice in
  1)
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT production
    ;;
  2)
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT preview
    ;;
  3)
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT development
    ;;
  4)
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT production
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT preview
    echo "$onramper_env" | vercel env add ONRAMPER_ENVIRONMENT development
    ;;
esac

echo ""
echo "✅ Environment variables added successfully!"
echo ""
echo "To verify, run: vercel env ls | grep ONRAMPER"

