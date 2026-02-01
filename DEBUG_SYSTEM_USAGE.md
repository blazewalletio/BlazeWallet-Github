# 🔧 DEBUG SYSTEM - HOW TO USE

## ⚡ QUICK START

### Step 1: Run Migration
1. Go to: https://supabase.com/dashboard/project/ldehmephukevxumwdbwt
2. SQL Editor → New query
3. Paste: `supabase/migrations/20260201100000_debug_logs_system.sql`
4. Run!

### Step 2: User Tests on Mobile
User opens wallet on iOS Safari or PWA app
→ Debug logs automatically sent to Supabase!

### Step 3: Query Logs
```sql
-- Get user's recent logs (replace with actual user_id)
SELECT 
  created_at,
  level,
  category,
  message,
  data,
  device_info
FROM debug_logs 
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC 
LIMIT 50;
```

---

## 📊 QUERY EXAMPLES

### 1. All Logs for a User (Last Hour)
```sql
SELECT * FROM debug_logs 
WHERE user_id = '5a39e19c-f663-4226-b5d5-26c032692865' -- Rick's user_id
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### 2. Device Verification Flow Only
```sql
SELECT 
  created_at,
  message,
  data->>'deviceId' as device_id,
  data->>'isNew' as is_new,
  data->>'result' as result
FROM debug_logs 
WHERE category = 'device_verification'
AND user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
ORDER BY created_at DESC
LIMIT 50;
```

### 3. localStorage Operations
```sql
SELECT 
  created_at,
  message,
  data->>'storageKey' as key,
  data->>'rawValue' as value,
  data->>'localStorageLength' as total_keys
FROM debug_logs 
WHERE category = 'localStorage'
AND user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
ORDER BY created_at DESC;
```

### 4. Database Queries (Performance)
```sql
SELECT 
  created_at,
  message,
  data->>'query' as query,
  (data->>'hasDevice')::boolean as device_found,
  data->>'errorMessage' as error
FROM debug_logs 
WHERE category = 'database'
AND user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
ORDER BY created_at DESC;
```

### 5. Only Errors
```sql
SELECT * FROM debug_logs 
WHERE level = 'error'
AND user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
ORDER BY created_at DESC;
```

### 6. By Session ID (Track One User Flow)
```sql
-- Get session_id from DebugIndicator on user's screen
SELECT * FROM debug_logs 
WHERE session_id = 'session_1738415400000_abc123'
ORDER BY created_at ASC; -- Chronological order
```

### 7. Using Helper Function
```sql
SELECT * FROM get_recent_debug_logs(
  p_user_id := '5a39e19c-f663-4226-b5d5-26c032692865',
  p_category := 'device_verification',
  p_level := NULL,
  p_limit := 100
);
```

---

## 🔍 WHAT TO LOOK FOR

### Issue: Device ID Not Persisting

**Query:**
```sql
SELECT 
  created_at,
  message,
  data->'deviceId' as device_id,
  data->'isNew' as is_new,
  data->'localStorageLength' as storage_size
FROM debug_logs 
WHERE category IN ('localStorage', 'device_verification')
AND user_id = 'USER_ID'
ORDER BY created_at ASC;
```

**Expected Pattern (WORKING):**
```
1. [localStorage] 🔍 READING localStorage for device_id
   → deviceId: "abc-123", isNew: false
2. [device_verification] [LAYER 1] Device ID: ✅ EXISTING
3. [database] [LAYER 1] Querying trusted_devices
   → hasDevice: true, verified_at: "2026-02-01..."
4. [device_verification] ✅ [LAYER 1] SUCCESS - DEVICE VERIFIED!
```

**Broken Pattern (NOT WORKING):**
```
1. [localStorage] 🔍 READING localStorage for device_id
   → deviceId: null, localStorageLength: 0  ❌ EMPTY!
2. [localStorage] 🆕 CREATING NEW device ID
   → newDeviceId: "xyz-789"
3. [device_verification] [LAYER 1] Device ID: 🆕 NEW
4. [database] [LAYER 1] Querying trusted_devices
   → hasDevice: false  ❌ NOT IN DATABASE!
5. [device_verification] ❌ ALL LAYERS FAILED
```

**Diagnosis:** localStorage is being cleared/empty on iOS!

---

### Issue: Database Query Failing

**Query:**
```sql
SELECT 
  created_at,
  message,
  data->>'hasError' as has_error,
  data->>'errorMessage' as error,
  data->>'hasDevice' as device_found
FROM debug_logs 
WHERE category = 'database'
AND user_id = 'USER_ID'
ORDER BY created_at DESC;
```

**Look for:**
- `has_error: true` → Database error
- `device_found: false` → Device not in database (expected for new devices)

---

### Issue: Layer 1 Passes, But Still Fails

**Query:**
```sql
SELECT 
  created_at,
  message,
  data->'layer1' as layer1,
  data->'layer2' as layer2,
  data->'layer3' as layer3,
  data->'layer4' as layer4,
  data->'result' as result
FROM debug_logs 
WHERE category = 'device_verification'
AND message LIKE '%LAYER%'
ORDER BY created_at ASC;
```

---

## 🎯 DEBUG WORKFLOW

### Scenario: User Reports "Device Not Verified"

**Step 1: Get User ID**
```sql
-- Find user by email
SELECT id, email FROM auth.users 
WHERE email = 'ricks_@live.nl';
-- Result: 5a39e19c-f663-4226-b5d5-26c032692865
```

**Step 2: Get Recent Logs**
```sql
SELECT * FROM debug_logs 
WHERE user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at ASC;
```

**Step 3: Filter by Category**
```sql
-- Focus on device_verification
SELECT * FROM debug_logs 
WHERE user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
AND category = 'device_verification'
ORDER BY created_at ASC;
```

**Step 4: Check localStorage**
```sql
-- Is localStorage empty?
SELECT 
  created_at,
  message,
  data->'localStorageLength' as keys,
  data->'allKeys' as all_keys
FROM debug_logs 
WHERE user_id = '5a39e19c-f663-4226-b5d5-26c032692865'
AND category = 'localStorage'
ORDER BY created_at ASC;
```

**Step 5: Identify Issue**
- localStorage empty → iOS clearing storage
- Device ID exists but not in DB → Device not verified yet
- Database error → RLS or permissions issue

**Step 6: Fix & Deploy!**

---

## 📱 USER SIDE

User will see:
- 🔵 Blue/purple floating icon (bottom right)
- Tap → See session ID
- Knows logging is active

No action needed from user!

---

## 🧪 TEST QUERIES

### Check if System is Working
```sql
-- Should see recent logs
SELECT COUNT(*) as total_logs,
       MAX(created_at) as latest_log
FROM debug_logs 
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

### Check User's Device Info
```sql
SELECT DISTINCT
  device_info->>'userAgent' as user_agent,
  device_info->>'platform' as platform,
  device_info->>'screenWidth' as screen_width
FROM debug_logs 
WHERE user_id = '5a39e19c-f663-4226-b5d5-26c032692865';
```

---

## 🚀 NEXT STEPS

1. ✅ Run migration (`20260201100000_debug_logs_system.sql`)
2. ✅ Deploy to Vercel (already pushed)
3. ⏳ User tests on mobile
4. ⏳ Query logs in Supabase
5. ⏳ Identify exact issue
6. ⏳ Fix & redeploy!

---

## 💡 TIPS

- Use `session_id` to track one user flow (from start to finish)
- `created_at ASC` for chronological order (see exact flow)
- `created_at DESC` for most recent first
- Filter by `level = 'error'` to see failures only
- Filter by `category` to focus on specific area
- Check `device_info` for device-specific issues (iOS vs Android)

---

## 🔐 SECURITY

- RLS enabled: Users can only insert & read own logs
- Service role has full access (for developer queries)
- Auto-cleanup after 7 days (keeps database clean)
- No sensitive data logged (passwords, mnemonics, etc.)

---

## 📝 LOG STRUCTURE

```json
{
  "id": 123,
  "created_at": "2026-02-01T10:30:00Z",
  "user_id": "5a39e19c-...",
  "session_id": "session_1738415400000_abc123",
  "level": "info",
  "category": "device_verification",
  "message": "✅ [LAYER 1] SUCCESS - DEVICE VERIFIED!",
  "data": {
    "deviceId": "abc-123",
    "deviceName": "iPhone (iOS 17.0)",
    "verifiedAt": "2026-02-01T09:00:00Z",
    "result": "VERIFIED"
  },
  "device_info": {
    "userAgent": "Mozilla/5.0 ...",
    "platform": "iPhone",
    "screenWidth": 430,
    "screenHeight": 932
  },
  "url": "https://my.blazewallet.io/",
  "user_agent": "Mozilla/5.0 ..."
}
```

---

## ✅ READY TO DEBUG!

User tests → Logs flow to Supabase → Query → Fix → Deploy! 🎉

