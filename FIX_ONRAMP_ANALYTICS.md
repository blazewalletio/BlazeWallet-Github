# 🚨 URGENT FIX NEEDED: Onramp Analytics Not Working

## ❌ Root Cause
The `user_events` table and `track_user_event()` RPC function **do not exist** in your Supabase database!

This means:
- ✅ Code is tracking events correctly
- ❌ Database has nowhere to store them
- ❌ Admin dashboard shows 0 for all onramp events

## ✅ Quick Fix (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt/
2. Click **"SQL Editor"** in left sidebar
3. Click **"New Query"** button

### Step 2: Run Migration SQL
1. Open file: `QUICK_FIX_USER_EVENTS.sql` (in project root)
2. Copy ALL the SQL
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or press `Cmd+Enter`)

### Step 3: Verify Success
You should see:
```
✅ Success. No rows returned
```

Or check the Table Editor:
- Left sidebar → "Table Editor"
- You should now see `user_events` table

### Step 4: Test Again
1. Go to wallet: http://localhost:3000
2. Initiate a new onramp purchase (Buy → Continue to Onramper)
3. Wait 10 seconds
4. Go to admin: http://localhost:3002
5. Click **Refresh** button
6. Go to **Onramp** tab
7. You should now see: **"Initiated: 1"** ✅

---

## 📊 What Gets Tracked

### After this fix, the following will work:

**Onramp Events** (stored in `user_events`):
- ✅ onramp_purchase_initiated - When user clicks "Continue to Onramper"
- ✅ onramp_purchase_pending - Webhook from Onramper
- ✅ onramp_purchase_processing - Webhook from Onramper
- ✅ onramp_purchase_completed - Webhook from Onramper
- ✅ onramp_purchase_failed - Webhook from Onramper
- ✅ onramp_purchase_refunded - Webhook from Onramper
- ✅ onramp_purchase_cancelled - Webhook from Onramper

**Transaction Events** (already working, stored in `transaction_events`):
- ✅ Send transactions
- ✅ Swap transactions
- ✅ Receive transactions

---

## 🔍 Why This Happened

The analytics system was designed with TWO separate tracking methods:

1. **Old System** (`lib/analytics-tracker.ts`)
   - Uses `/api/analytics/batch-log` endpoint
   - Stores in `transaction_events` table
   - Used for: Send, Swap, Receive
   - ✅ Already working

2. **New System** (`lib/analytics.ts`)
   - Uses `track_user_event()` RPC function
   - Stores in `user_events` table
   - Used for: Onramp, Auth, Feature usage
   - ❌ Missing database setup

The migration for the new system was created (`20260128230000_user_events_table.sql`) but **never applied** to the production database.

---

## 🚀 After Fix

Once you run the SQL migration:
- All new onramp purchases will be tracked
- Admin dashboard will show real-time data
- No code changes needed
- Existing transaction tracking continues to work

**Need help?** Let me know if the SQL migration fails!

