#!/bin/bash

# Fix all environment variables with newlines in Vercel
# This script removes \n, \r, and trailing quotes issues

echo "🔧 Fixing all Vercel environment variables with newlines..."
echo ""

# Read the .env.production file and fix each variable
while IFS= read -r line; do
  # Skip empty lines and comments
  if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
    continue
  fi
  
  # Extract variable name and value
  if [[ "$line" =~ ^([^=]+)=\"(.*)\"$ ]]; then
    var_name="${BASH_REMATCH[1]}"
    var_value="${BASH_REMATCH[2]}"
    
    # Check if value has \n at the end
    if [[ "$var_value" =~ \\n$ ]]; then
      # Remove the \n
      clean_value="${var_value%\\n}"
      
      echo "🔄 Fixing: $var_name"
      echo "   Old: ${var_value:0:50}..."
      echo "   New: ${clean_value:0:50}..."
      
      # Remove old variable
      vercel env rm "$var_name" production --yes 2>/dev/null
      
      # Add clean variable
      echo "$clean_value" | vercel env add "$var_name" production 2>&1 | grep -v "Vercel CLI"
      
      echo "✅ Fixed!"
      echo ""
    fi
  fi
done < .env.production

echo ""
echo "✨ All environment variables with newlines have been fixed!"

