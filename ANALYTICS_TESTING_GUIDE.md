# 🧪 BLAZE Analytics Testing Guide

## ✅ Quick Test Checklist

### 1. Test Send Transaction
```
1. Open http://localhost:3000
2. Login met je wallet account
3. Ga naar Send tab
4. Voer een send transaction uit
5. Check Admin Dashboard → Transactions tab
   → Should see "Send: Initiated +1"
```

### 2. Test Swap Transaction
```
1. Ga naar Swap tab in wallet
2. Voer een swap uit (LiFi)
3. Check Admin Dashboard → Transactions tab
   → Should see "Swap: Initiated +1"
```

### 3. Test Onramp Purchase
```
1. Ga naar Buy tab in wallet
2. Klik "Buy Crypto"
3. Start een Onramper transaction
4. Check Admin Dashboard → Onramp tab
   → Should see "Initiated +1"
```

### 4. Test Receive Detection
```
1. Send crypto to je wallet address
2. Wait voor detection (gebeurt automatisch)
3. Check Admin Dashboard → Transactions tab
   → Should see "Receive: Detected +1"
```

### 5. Test User Cohorts
```
1. Check Admin Dashboard → Overview tab
2. Should see user counts in cohorts:
   - New Users
   - Active
   - Power Users
   - Dormant
   - Churned
```

## 🔍 Debug Commands

### Check transaction_events table
```sql
SELECT 
  event_type, 
  COUNT(*) as count 
FROM transaction_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

### Check user_events table (onramp)
```sql
SELECT 
  event_name, 
  COUNT(*) as count 
FROM user_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_name
ORDER BY count DESC;
```

### Check if analytics tracker is running
Open browser console and type:
```javascript
localStorage.getItem('analytics_enabled')
// Should return "true" or null (which defaults to enabled)
```

### Force flush analytics queue
```javascript
// In browser console
await fetch('/api/analytics/batch-log', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${YOUR_AUTH_TOKEN}`
  },
  body: JSON.stringify({ events: [] })
})
```

## 📊 What Gets Tracked

### ✅ Automatically Tracked
- ✅ Login/Signup (auth events)
- ✅ Send transactions (initiated/confirmed/failed)
- ✅ Swap transactions (initiated/confirmed/failed)
- ✅ Receive transactions (detected)
- ✅ Onramp purchases (7 lifecycle stages)
- ✅ User cohort updates (automatic triggers)

### ⏱️ Tracking Frequency
- **Events batched**: Every 5 seconds OR when 10 events in queue
- **Admin refresh**: Every 30 seconds automatically
- **Cohort updates**: Real-time via database triggers

## 🎯 Expected Behavior

1. **Immediate**: Events added to client-side queue
2. **5 seconds**: Events flushed to API
3. **Real-time**: Database updated
4. **30 seconds**: Admin dashboard refreshes

## 🚨 Troubleshooting

### Analytics not showing in admin?
1. Check browser console for errors
2. Verify `localStorage.getItem('analytics_enabled')` is true
3. Check Network tab for `/api/analytics/batch-log` calls
4. Verify user is logged in (auth token present)

### Admin shows 0 for everything?
1. No data yet - perform some transactions first
2. Database might not have data - check Supabase directly
3. RLS policies might be blocking - check Supabase logs

### Onramp not tracked?
1. Check `/api/onramper/webhook` receives events
2. Verify webhook is configured in Onramper dashboard
3. Check `user_events` table in Supabase

## 🔥 Live Test Results

After performing tests, check:
- ✅ Transaction count increases
- ✅ Volume changes
- ✅ User cohorts update
- ✅ No errors in console
- ✅ Admin shows real data

