#!/bin/bash

# 🔥 BLAZE Wallet - First Time Setup Script

echo "🔥 BLAZE Wallet - Development Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Run this script from the project root directory"
  exit 1
fi

echo "1️⃣  Installing dependencies for main wallet..."
npm install

echo ""
echo "2️⃣  Installing dependencies for admin dashboard..."
cd apps/admin && npm install && cd ../..

echo ""
echo "3️⃣  Setting up environment variables..."

# Check if main .env.local exists
if [ ! -f ".env.local" ]; then
  echo "⚠️  Main .env.local not found. Creating template..."
  cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Add other environment variables here
EOF
  echo "   ⚠️  Please edit .env.local with your Supabase credentials"
else
  echo "   ✅ Main .env.local found"
fi

# Copy to admin app
if [ -f ".env.local" ]; then
  echo "   📋 Copying environment variables to admin app..."
  cp .env.local apps/admin/.env.local
  echo "   ✅ Admin .env.local created"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Make sure .env.local has your Supabase credentials"
echo "2. Run: npm run dev:all"
echo "3. Open: http://localhost:3000 (wallet)"
echo "4. Open: http://localhost:3002 (admin)"
echo ""
echo "📖 For more info, see: DEV_GUIDE.md"
echo ""

