# 🔥 BLAZE Wallet - Local Development Guide

## 🚀 Quick Start

### **Option 1: Run Everything at Once** (Recommended)
```bash
npm run dev:all
```

Dit start:
- 🌐 **Main Wallet** op `http://localhost:3000`
- 👨‍💼 **Admin Dashboard** op `http://localhost:3002`

Beide apps draaien naast elkaar met duidelijke logs!

### **Option 2: Run Apps Separately**

**Terminal 1 - Main Wallet:**
```bash
npm run dev
# Runs on http://localhost:3000
```

**Terminal 2 - Admin Dashboard:**
```bash
npm run dev:admin
# Runs on http://localhost:3002
```

---

## 📁 Project Structure

```
BLAZE Wallet 29-12/
├── app/                    # Main wallet app
│   ├── api/               # API routes
│   └── ...
├── apps/
│   └── admin/             # Admin dashboard
│       ├── app/
│       ├── api/
│       └── ...
├── components/            # Shared components
├── lib/                   # Shared libraries
└── supabase/             # Database migrations
```

---

## 🧪 Local Testing Workflow

### 1. **Start Development Servers**
```bash
npm run dev:all
```

### 2. **Test Main Wallet** (`localhost:3000`)
- ✅ Login/signup flows
- ✅ Send transactions
- ✅ Swap transactions  
- ✅ Onramp purchases
- ✅ Receive transactions

### 3. **Test Admin Dashboard** (`localhost:3002`)
- ✅ Login with admin credentials
- ✅ Check analytics overview
- ✅ View user cohorts
- ✅ Monitor alerts

### 4. **Check Logs**
Beide apps loggen naar dezelfde terminal met kleuren:
- **🔵 WALLET** (cyan) - Main app logs
- **🟣 ADMIN** (magenta) - Admin app logs

### 5. **Verify Analytics**
Na acties in de wallet (`localhost:3000`):
1. Bekijk de wallet console logs (browser DevTools)
2. Check admin dashboard analytics (`localhost:3002`)
3. Verifieer database updates in Supabase

---

## 🏗️ Build & Deploy Workflow

### **Step 1: Test Locally** ✅
```bash
# Start both apps
npm run dev:all

# Test all features thoroughly
# Check console logs for errors
# Verify analytics tracking
```

### **Step 2: Build Locally** ✅
```bash
# Build main wallet
npm run build

# Build admin dashboard
npm run build:admin

# Or build both at once
npm run build:all
```

### **Step 3: Verify Builds** ✅
```bash
# Check for TypeScript errors
# Check for build warnings
# Verify bundle sizes
```

### **Step 4: Commit & Push** ✅
```bash
git add -A
git commit -m "feat: your feature description"
git push origin main
```

### **Step 5: Deploy** ✅
```bash
# Deploy main wallet
vercel --prod

# Deploy admin dashboard
cd apps/admin && vercel --prod
```

---

## 🔧 Common Development Tasks

### **Install Dependencies**
```bash
# Main app
npm install

# Admin app
cd apps/admin && npm install
```

### **Add Analytics Event**
```typescript
import { trackEvent } from '@/lib/analytics';

// Track custom event
await trackEvent(userId, 'event_name', {
  property1: 'value1',
  property2: 'value2',
});
```

### **Test Admin API Routes**
```bash
# Admin API runs on localhost:3002
curl http://localhost:3002/api/admin/analytics/overview \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### **View Supabase Logs**
```bash
# Check if analytics are being tracked
# Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
# Navigate to: Logs & Analytics
```

---

## 🐛 Debugging

### **Main Wallet Logs**
```bash
# Browser console (F12)
# Shows client-side logs, API calls, analytics events
```

### **Admin Dashboard Logs**
```bash
# Browser console (F12)
# Shows admin actions, API responses, auth status
```

### **Server Logs (Terminal)**
```bash
# When running npm run dev:all
# All server-side logs appear in terminal
# Color-coded: WALLET (cyan) vs ADMIN (magenta)
```

### **API Route Debugging**
```typescript
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  logger.log('📥 API called:', { ... });
  // Your code
  logger.log('✅ API success:', { ... });
}
```

---

## 📊 Analytics Testing Checklist

Before deploying, test these scenarios locally:

### **User Actions**
- [ ] User signup → Check `login_success` event
- [ ] User login → Check `login_success` event
- [ ] Send transaction → Check `send_initiated`, `send_confirmed`
- [ ] Receive transaction → Check `receive_detected`
- [ ] Swap tokens → Check `swap_initiated`, `swap_confirmed`
- [ ] Buy crypto (onramp) → Check `onramp_purchase_*` events

### **Admin Dashboard**
- [ ] Login works
- [ ] Analytics overview loads
- [ ] User cohorts display correctly
- [ ] Alerts show up
- [ ] No 401 errors

---

## 🔐 Environment Variables

### **Main Wallet (`.env.local`)**
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
# ... other vars
```

### **Admin Dashboard (`apps/admin/.env.local`)**
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

---

## 🎯 Benefits of Local Testing

✅ **Instant Feedback** - See changes immediately  
✅ **Detailed Logs** - Console logs show everything  
✅ **No Deploy Delays** - Test instantly without waiting for Vercel  
✅ **Easy Debugging** - Use browser DevTools  
✅ **Safe Experimentation** - Break things without affecting production  
✅ **Cost Effective** - No unnecessary deployments  

---

## 📝 Notes

- Main wallet uses port **3000**
- Admin dashboard uses port **3002**
- Both apps connect to the same Supabase database
- Analytics are tracked in real-time
- Use `npm run dev:all` for the best development experience

---

**Happy Coding! 🔥**

