# 🧪 FORT KNOX - TESTING GUIDE

## 🎯 Server Status
✅ **Dev Server**: Running on http://localhost:3001

---

## 📋 TEST SCENARIOS

### ✅ Scenario 1: New User Registration
**Expected Behavior**: First device should be automatically trusted

**Steps**:
1. Navigate to http://localhost:3001
2. Click "Create Account" or sign up
3. Complete registration with email + password
4. ✅ **Check**: Device should be added to `trusted_devices` with `verified_at` set
5. ✅ **Check**: User can immediately enable biometrics
6. ✅ **Check**: No verification code required

**Database Check**:
```sql
SELECT * FROM trusted_devices WHERE user_id = 'YOUR_USER_ID';
-- Should show: verified_at IS NOT NULL, is_current = true
```

---

### ✅ Scenario 2: Existing User - Same Trusted Device
**Expected Behavior**: Instant biometric unlock, no verification

**Steps**:
1. Log out of existing account
2. Clear session: `sessionStorage.clear()`
3. Refresh page
4. Click biometric unlock button (Fingerprint/Face ID)
5. ✅ **Check**: Wallet unlocks immediately
6. ✅ **Check**: No email code sent
7. ✅ **Check**: No 2FA required

**What Happens Behind the Scenes**:
- Device fingerprint generated
- Matched against `trusted_devices` table
- `verified_at` is NOT NULL → allow access
- `last_used_at` updated

---

### ✅ Scenario 3: Existing User - NEW Device (Normal Risk)
**Expected Behavior**: Verification code + 2FA required

**Steps**:
1. **Simulate new device**: Clear browser data or use incognito/private mode
2. Navigate to http://localhost:3001
3. Enter email + password for existing account
4. Click "Unlock"

**🚫 Login Blocked - Modal Appears**:
5. ✅ **Check**: `DeviceVerificationModal` appears
6. ✅ **Check**: Shows device info (name, location, IP)
7. ✅ **Check**: Email sent with 6-digit code (check console logs)

**Console Log Example**:
```
============================================================
📧 VERIFICATION EMAIL
============================================================
To: user@example.com
Code: 123-456
Device: Chrome on macOS
Location: Amsterdam, Netherlands
IP: 192.168.1.1
============================================================
```

8. Copy the 6-digit code from console
9. Enter code in modal (e.g., 1-2-3-4-5-6)
10. ✅ **Check**: Modal switches to 2FA step
11. Enter any 6-digit code for 2FA (e.g., 1-1-1-1-1-1)
12. Click "Verify & Unlock"
13. ✅ **Check**: Wallet unlocks successfully
14. ✅ **Check**: Device now trusted for future logins

**Database Check**:
```sql
SELECT * FROM trusted_devices WHERE device_fingerprint = 'NEW_FINGERPRINT';
-- Should show: verified_at IS NOT NULL after step 12
```

**Next Login from Same Device**:
15. Log out and log in again
16. ✅ **Check**: Should allow biometric unlock (no verification)

---

### ✅ Scenario 4: HIGH-RISK Device (TOR/VPN)
**Expected Behavior**: Login blocked immediately, security alert sent

**Steps**:
1. **Enable VPN or use TOR browser**
2. Navigate to http://localhost:3001
3. Enter email + password
4. Click "Unlock"

**🚨 BLOCKED**:
5. ✅ **Check**: Login fails with error message
6. ✅ **Check**: Error shows risk score (e.g., "Risk: 80/100")
7. ✅ **Check**: Session terminated (user signed out)
8. ✅ **Check**: Security alert email sent (check console)

**Console Log Example**:
```
🚨 [StrictAuth] HIGH RISK login blocked! Score: 80
============================================================
🚨 SECURITY ALERT
============================================================
To: user@example.com
Subject: 🚨 Suspicious Login Blocked - BLAZE Wallet
Device: Chrome on macOS
Location: Unknown, Unknown
Risk Score: 80/100
TOR: true, VPN: false
============================================================
```

**Database Check**:
```sql
SELECT * FROM user_activity_log 
WHERE user_id = 'YOUR_USER_ID' 
AND activity_type = 'device_verification_required';
-- Should show blocked login attempt
```

---

### ✅ Scenario 5: Code Expiry (15 Minutes)
**Expected Behavior**: Expired code should be rejected

**Steps**:
1. Trigger new device login (Scenario 3, steps 1-7)
2. **Wait 15+ minutes** (or manually update DB for testing):
```sql
UPDATE trusted_devices 
SET verification_expires_at = NOW() - INTERVAL '1 minute'
WHERE verification_code = 'YOUR_CODE';
```
3. Try to enter the code
4. ✅ **Check**: Error message: "Verification code has expired"
5. Click "Resend code"
6. ✅ **Check**: New code generated and sent
7. ✅ **Check**: Old code no longer works
8. ✅ **Check**: New code works

---

### ✅ Scenario 6: Resend Code Feature
**Expected Behavior**: Can request new code after 60s countdown

**Steps**:
1. Trigger new device login (Scenario 3, steps 1-7)
2. ✅ **Check**: "Resend code in 60s" displayed
3. Wait for countdown to reach 0
4. ✅ **Check**: "Resend code" button appears
5. Click "Resend code"
6. ✅ **Check**: Loading spinner shown
7. ✅ **Check**: Success message: "Code sent!"
8. ✅ **Check**: Timer resets to 60s
9. ✅ **Check**: New code sent to email (console log)
10. ✅ **Check**: Old code invalidated

**Database Check**:
```sql
SELECT verification_code, verification_expires_at 
FROM trusted_devices 
WHERE device_fingerprint = 'YOUR_FINGERPRINT'
ORDER BY created_at DESC LIMIT 1;
-- Code should be different after resend
```

---

### ✅ Scenario 7: Code Paste Support
**Expected Behavior**: Can paste 6-digit code from email/clipboard

**Steps**:
1. Trigger new device login
2. Copy code from console: `123456` (without dash)
3. Click first input box
4. Paste (Cmd+V / Ctrl+V)
5. ✅ **Check**: All 6 digits fill in automatically
6. ✅ **Check**: Focus moves to last input

**Alternative**:
7. Copy with dash: `123-456`
8. Paste
9. ✅ **Check**: Dash removed, only digits filled

---

### ✅ Scenario 8: Invalid Code Attempts
**Expected Behavior**: Error message for wrong codes

**Steps**:
1. Trigger new device login
2. Enter incorrect 6-digit code
3. Click "Continue"
4. ✅ **Check**: Error message: "Invalid verification code"
5. ✅ **Check**: Input fields remain editable
6. Enter correct code
7. ✅ **Check**: Proceeds to 2FA step

---

### ✅ Scenario 9: Cancel Verification
**Expected Behavior**: Can cancel and return to login

**Steps**:
1. Trigger new device login
2. Modal appears with verification code
3. Click "Cancel" button
4. ✅ **Check**: Modal closes
5. ✅ **Check**: Back at password unlock screen
6. ✅ **Check**: Error message: "Device verification cancelled"
7. ✅ **Check**: User still signed out

---

### ✅ Scenario 10: Mobile Responsive Design
**Expected Behavior**: Works perfectly on mobile devices

**Steps**:
1. Open Chrome DevTools (F12)
2. Click "Toggle device toolbar" (Cmd+Shift+M)
3. Select "iPhone 14 Pro" or "Pixel 5"
4. Test all scenarios above on mobile view
5. ✅ **Check**: Modal fits screen
6. ✅ **Check**: Input boxes are tappable
7. ✅ **Check**: Buttons are easily clickable
8. ✅ **Check**: No horizontal scroll
9. ✅ **Check**: Text is readable
10. ✅ **Check**: Gradient looks good

---

## 🔍 DEBUGGING TIPS

### Check Console Logs
Look for these log messages:
- `🔐 [StrictAuth] Starting strict sign-in`
- `📱 [StrictAuth] Generating device fingerprint...`
- `✅ [StrictAuth] Fingerprint generated`
- `🚫 [StrictAuth] NEW/UNVERIFIED device - blocking login`
- `🚨 [StrictAuth] HIGH RISK login blocked!`
- `✅ [StrictAuth] TRUSTED device detected`

### Check Network Tab
- **POST** `/api/verify-device-code` - Code validation
- **POST** `/api/security-alert` - Security alerts
- **GET** `/api/ip-info` - IP geolocation

### Check Database
```sql
-- View all trusted devices for user
SELECT 
  device_name,
  device_fingerprint,
  verified_at,
  is_current,
  device_metadata->>'riskScore' as risk_score,
  last_used_at
FROM trusted_devices 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY last_used_at DESC;

-- View user activity logs
SELECT 
  activity_type,
  description,
  ip_address,
  created_at
FROM user_activity_log
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;

-- View security scores
SELECT * FROM user_security_scores 
WHERE user_id = 'YOUR_USER_ID';
```

### Common Issues

#### Issue: "Device fingerprint not generated"
**Solution**: Check browser compatibility, ensure JavaScript enabled

#### Issue: "Invalid verification code" (but code is correct)
**Solution**: Check if code expired, try resend

#### Issue: "Failed to send email"
**Solution**: This is expected in development (emails log to console)

#### Issue: Modal doesn't appear
**Solution**: Check console for errors, ensure all imports correct

#### Issue: Biometric not available
**Solution**: Only works on production domain (`my.blazewallet.io`)

---

## 📊 TEST RESULTS CHECKLIST

Use this to track your testing progress:

### Core Functionality
- [ ] New user registration auto-trusts device
- [ ] Existing user on trusted device = instant access
- [ ] New device blocks and sends verification code
- [ ] High-risk device blocks immediately
- [ ] Verification code validates correctly
- [ ] 2FA step works after code validation
- [ ] Device marked as trusted after verification
- [ ] Subsequent logins on verified device work instantly

### UI/UX
- [ ] Modal appears correctly
- [ ] Device info displays properly
- [ ] 6-digit code input works
- [ ] Auto-focus between inputs
- [ ] Paste support works
- [ ] Resend button appears after countdown
- [ ] Loading states show correctly
- [ ] Error messages clear and helpful
- [ ] Success states show
- [ ] Cancel button works

### Security
- [ ] Risk scoring works (TOR/VPN detection)
- [ ] High-risk logins blocked
- [ ] Security alerts sent
- [ ] Codes expire after 15 minutes
- [ ] Old codes invalidated on resend
- [ ] Session terminated for unverified devices
- [ ] Device fingerprint unique per device

### Responsive Design
- [ ] Works on desktop (1920x1080)
- [ ] Works on laptop (1366x768)
- [ ] Works on tablet (768x1024)
- [ ] Works on mobile (375x667)
- [ ] No horizontal scroll
- [ ] Text readable on all sizes
- [ ] Buttons easily clickable

### Edge Cases
- [ ] Multiple resend requests handled
- [ ] Expired codes rejected
- [ ] Invalid codes show error
- [ ] Network errors handled gracefully
- [ ] Concurrent login attempts handled
- [ ] Browser back button doesn't break flow

---

## 🚀 PERFORMANCE BENCHMARKS

Expected timings:
- **Device fingerprint generation**: < 500ms
- **Risk score calculation**: < 100ms
- **Database lookup**: < 200ms
- **Email send**: < 1s (in production)
- **Code validation**: < 100ms
- **Total verification flow**: 30-60 seconds (user dependent)

---

## 📝 NOTES FOR QA TEAM

### Test Environment Setup
1. Use incognito/private browsing for "new device" tests
2. Use VPN/TOR for high-risk tests
3. Use Chrome DevTools for mobile tests
4. Keep console open to see verification codes
5. Use Supabase dashboard to check database state

### Known Limitations (Development)
- Emails log to console (not sent)
- 2FA accepts any 6-digit code
- FingerprintJS free version (less accurate)

### Production Considerations
- Email service must be configured
- 2FA service must be integrated
- Database migration must be run
- FingerprintJS Pro recommended

---

**Test Status**: ⚪ Ready for Manual Testing
**Last Updated**: January 27, 2026
**Server**: http://localhost:3001

