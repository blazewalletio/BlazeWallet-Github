#!/bin/bash

# Fix ALL variables that still have \n using printf to ensure clean values

echo "🔧 Fixing ALL remaining newlines with printf..."
echo ""

# Download current state
vercel env pull .env.temp --environment=production --yes > /dev/null 2>&1

# Parse and fix each variable
while IFS= read -r line; do
  # Skip empty lines and comments
  if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
    continue
  fi
  
  # Extract variable name and value (handle quoted values)
  if [[ "$line" =~ ^([^=]+)=\"(.*)\"$ ]]; then
    var_name="${BASH_REMATCH[1]}"
    var_value="${BASH_REMATCH[2]}"
    
    # Check if value has \n at the end
    if [[ "$var_value" =~ \\n$ ]]; then
      # Remove the \n
      clean_value="${var_value%\\n}"
      
      echo "🔄 Fixing: $var_name"
      
      # Remove old variable
      vercel env rm "$var_name" production --yes > /dev/null 2>&1
      
      # Add clean variable using printf (no newlines!)
      printf '%s' "$clean_value" | vercel env add "$var_name" production > /dev/null 2>&1
      
      echo "✅ Fixed!"
    fi
  fi
done < .env.temp

rm -f .env.temp

echo ""
echo "✨ Done!"

