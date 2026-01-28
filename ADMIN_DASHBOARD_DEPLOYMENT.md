# 🚀 ADMIN DASHBOARD - DEPLOYMENT GUIDE

**URL**: `admin.blazewallet.io`  
**Status**: ✅ **READY TO DEPLOY**

---

## 📋 WHAT'S BEEN BUILT

### ✅ Backend (3 API Endpoints)
1. **`/api/admin/analytics/overview`** - Dashboard overview data
2. **`/api/admin/analytics/alerts`** - Alerts management (GET + PATCH)
3. **`/api/admin/analytics/cohorts`** - User cohorts data

### ✅ Frontend
- **`/app/admin/page.tsx`** - Complete admin dashboard UI
- Real-time metrics widgets
- User segmentation overview
- Critical alerts display
- Recent activity feed
- Auto-refresh every 30 seconds
- Responsive design

### 🔒 Security Features
- Email whitelist (only `ricks_@live.nl`)
- Supabase authentication required
- Service role API access
- Automatic redirect if unauthorized

---

## 🎯 DEPLOYMENT STEPS

### **Step 1: Run Database Migration** ⚠️ **DO THIS FIRST**

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy/paste: `supabase/migrations/20260128200000_user_analytics_system.sql`
4. Click **RUN**
5. Verify success message

**Verification**:
```sql
-- Check tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'transaction_events',
  'user_cohorts',
  'feature_usage_stats',
  'realtime_metrics',
  'admin_alerts'
);
```

Should return 5 rows.

---

### **Step 2: Setup Subdomain DNS**

**Option A: CNAME (Recommended)**
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
TTL: Auto
```

**Option B: A Record**
```
Type: A
Name: admin
Value: 76.76.21.21
TTL: Auto
```

**Where?** In your domain registrar (waar `blazewallet.io` geregistreerd is)

---

### **Step 3: Add Domain in Vercel**

1. Go to Vercel Dashboard
2. Project: **blaze-wallet** (or your project name)
3. Settings → **Domains**
4. Click **Add Domain**
5. Enter: `admin.blazewallet.io`
6. Click **Add**
7. Wait ~5-10 minutes for DNS propagation
8. Vercel configures SSL automatically ✅

---

### **Step 4: Deploy Code**

```bash
# Make sure you're in project root
cd "/Users/rickschlimback/Desktop/BLAZE Wallet 29-12"

# Add all files
git add .

# Commit
git commit -m "feat: Add admin analytics dashboard

- Add admin dashboard at /admin
- Add 3 admin API endpoints (overview, alerts, cohorts)
- Add real-time metrics widgets
- Add user segmentation view
- Email whitelist security
- Auto-refresh every 30 seconds"

# Push (triggers Vercel auto-deploy)
git push origin main
```

**Wait ~2-3 minutes** for Vercel to build & deploy.

---

### **Step 5: Verify Deployment**

1. **Check Vercel Deploy Status**:
   - Go to Vercel Dashboard → Deployments
   - Latest deployment should be "Ready"

2. **Access Admin Dashboard**:
   - Go to: `https://admin.blazewallet.io`
   - Log in with your Blaze Wallet account (`ricks_@live.nl`)
   - You should see the dashboard!

3. **Test API Endpoints**:
   ```bash
   # Get your auth token first
   # Then test:
   curl https://my.blazewallet.io/api/admin/analytics/overview \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

### **Step 6: Setup EasyCron** (For automated aggregations)

Follow: **`EASYCRON_ANALYTICS_SETUP.md`**

**Quick Setup**:
1. Login at easycron.com
2. Create new cron job
3. URL: `https://my.blazewallet.io/api/cron/aggregate-analytics`
4. Schedule: `0 * * * *` (hourly)
5. Add header: `Authorization: Bearer [YOUR_CRON_SECRET]`
6. Enable & Test

---

## 🧪 TESTING CHECKLIST

### Before Going Live
- [ ] Database migration successful (5 tables exist)
- [ ] DNS configured for `admin.blazewallet.io`
- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful
- [ ] Can access `https://admin.blazewallet.io`
- [ ] Login works (redirects if not authorized)
- [ ] Dashboard loads without errors
- [ ] Metrics display correctly
- [ ] Auto-refresh works

### After Going Live
- [ ] EasyCron job configured
- [ ] First cron run successful
- [ ] Metrics update after cron run
- [ ] Alerts appear if anomalies detected
- [ ] Main app (`my.blazewallet.io`) still works perfectly

---

## 🎨 WHAT THE DASHBOARD SHOWS

### Real-Time Metrics (Top Row)
- **Active Users (24h)**: Unique users with activity
- **Transactions (24h)**: Total successful transactions
- **Volume (24h)**: Total USD volume
- **Failed Rate**: % of failed transactions

### User Segments
- **New**: Just signed up, no transactions yet
- **Active**: 1+ transaction in last 7 days
- **Power Users**: 20+ transactions in last 7 days
- **Dormant**: No activity in 8-30 days
- **Churned**: No activity in 30+ days

### Alerts
- **Critical**: Urgent issues (>50 failed txs/hour, etc.)
- **Warning**: Monitor closely (high volume users, etc.)
- **Info**: Good news (growth spikes, etc.)

### Recent Activity
- Last 10 transaction events (24h)
- Shows: type, chain, token, value, status

---

## 🔐 SECURITY NOTES

### Who Can Access?
**ONLY** emails in whitelist:
```typescript
const ALLOWED_ADMINS = [
  'ricks_@live.nl',
  // Add team members here
];
```

### How to Add Team Members?
1. Edit: `app/api/admin/analytics/overview/route.ts` (line 14)
2. Add email to `ALLOWED_ADMINS` array
3. Same for `alerts/route.ts` and `cohorts/route.ts`
4. Commit & push

### Rate Limiting?
Not implemented yet, but can add:
- Vercel Edge Config for IP whitelist
- Upstash Redis for rate limiting
- Cloudflare WAF rules

---

## 📊 WHAT DATA IS COLLECTED?

### ✅ What We Track
- Transaction events (send, swap, onramp)
- USD values only (no exact amounts)
- Chain & token symbols
- Event status (pending, success, failed)
- Feature usage (which features users click)

### ❌ What We DON'T Track
- ❌ Wallet addresses (ever!)
- ❌ Private keys (obviously!)
- ❌ Exact token amounts
- ❌ Transaction hashes (only SHA-256 hashes)
- ❌ IP addresses
- ❌ Device fingerprints

### 🔒 Privacy Features
- All references are hashed (SHA-256)
- RLS policies protect user data
- Users can opt-out (coming soon: consent modal)
- Data auto-expires (realtime metrics: 24h TTL)

---

## 🆘 TROUBLESHOOTING

### "Page Not Found" on `admin.blazewallet.io`
- ✅ Check DNS propagation: `dig admin.blazewallet.io`
- ✅ Wait 10-15 minutes after DNS changes
- ✅ Clear browser cache (Cmd+Shift+R)
- ✅ Check Vercel domain is added & verified

### "Unauthorized" Error
- ✅ Make sure you're logged in to Blaze Wallet
- ✅ Check your email is in `ALLOWED_ADMINS` list
- ✅ Try logging out & back in
- ✅ Check browser console for errors

### Dashboard Shows "0" for Everything
- ✅ Database migration might have failed
- ✅ EasyCron not running yet (metrics populate hourly)
- ✅ No user activity yet (need some transactions first)
- ✅ Check Vercel function logs for errors

### API Returns 500 Error
- ✅ Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- ✅ Check database tables exist
- ✅ Check Vercel function logs for stack trace
- ✅ Test API endpoint with curl

---

## 📞 NEXT STEPS

### Immediate (After Deployment)
1. ✅ Verify dashboard loads
2. ✅ Setup EasyCron
3. ✅ Wait for first data to populate (1-2 hours)
4. ✅ Monitor for errors

### Short-term (This Week)
1. Add GDPR consent modal for users
2. Add more team members to whitelist
3. Setup email alerts for critical issues
4. Add more charts/visualizations

### Long-term (Future)
1. Add detailed user drill-down
2. Add export to CSV functionality
3. Add custom date ranges
4. Add A/B testing tracking
5. Separate admin app (if team grows)

---

## ✅ SUCCESS CRITERIA

You'll know it's working when:
- ✅ Can access `admin.blazewallet.io`
- ✅ Dashboard shows metrics (after 1-2 hours of data)
- ✅ Auto-refresh works (watch timestamp update)
- ✅ Alerts appear when anomalies occur
- ✅ Main app still works perfectly (zero impact)

---

## 🎉 YOU'RE DONE!

The admin dashboard is **complete** and **production-ready**!

**URL**: https://admin.blazewallet.io

**Features**:
- ✅ Real-time metrics
- ✅ User segmentation
- ✅ Automated alerts
- ✅ Recent activity feed
- ✅ Auto-refresh (30s)
- ✅ Secure (email whitelist)
- ✅ Professional UI

**Next**: Follow deployment steps above and you're live! 🚀

