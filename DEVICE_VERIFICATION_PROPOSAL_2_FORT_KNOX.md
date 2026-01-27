# 🏰 VOORSTEL 2: "Fort Knox"
## Maximum Security + Mandatory Verification

**Filosofie:** Security first, trust maar verify ALTIJD.

---

## 🎯 CORE CONCEPT

**"Zero Trust Architecture - Verify Everything"**

- Nieuwe devices worden **GEBLOKKEERD** tot verificatie
- Multi-factor approach: Email + 2FA + Biometric
- Trusted devices krijgen shortcuts
- Coinbase/Kraken level security
- Compliance-ready

---

## 📱 USER FLOW

### Scenario 1: Eerste Login (New User)
```
User creates account
         ↓
   [Email + Password]
         ↓
   ✅ Device fingerprint gegenereerd
         ↓
   📧 Email verification REQUIRED
   "Verify your email to continue"
         ↓
   [User clicks link in email]
         ↓
   ✅ Email verified
         ↓
   🔐 2FA Setup (MANDATORY)
   "Protect your wallet with 2FA"
   [Setup Authenticator App]
         ↓
   ✅ 2FA enabled
         ↓
   📱 Biometric Setup (MANDATORY on mobile)
   "Enable Face ID for quick access"
         ↓
   ✅ First device auto-trusted
   "This device is now trusted"
         ↓
   [Dashboard]
```

**UX:** More steps, maar maximum security vanaf dag 1

---

### Scenario 2: Login Van Nieuwe Device (CRITICAL)
```
User opent app op nieuwe iPhone
         ↓
   [Email + Password invoeren]
         ↓
   📱 Device fingerprint check
   "New device detected"
         ↓
   🚫 LOGIN BLOCKED
   ╔══════════════════════════════╗
   ║  🔐 Device Verification      ║
   ║     Required                  ║
   ║                               ║
   ║  For your security, verify   ║
   ║  this new device.            ║
   ║                               ║
   ║  We've sent a verification   ║
   ║  code to your email.         ║
   ╚══════════════════════════════╝
         ↓
   📧 Email sent IMMEDIATELY:
   "New device login attempt"
   "Code: 123-456"
   "Location: Amsterdam, NL"
   "Device: iPhone 16 Pro"
   [Approve This Device] [Not Me]
         ↓
   User enters code: [___-___]
         ↓
   ✅ Code correct
         ↓
   🔐 2FA Prompt (REQUIRED)
   "Enter your 2FA code"
   [______]
         ↓
   ✅ 2FA verified
         ↓
   💡 Optional naming:
   "Name this device (optional)"
   [Rick's iPhone] [Skip]
         ↓
   ✅ Device now trusted
   "Welcome! This device is verified"
         ↓
   [Dashboard - full access]
```

**Key Points:**
- ❌ Login GEBLOKKEERD tot verificatie
- ✅ Email code + 2FA (double verification)
- ✅ Geolocation shown voor awareness
- ✅ "Not me" button voor instant account lock

---

### Scenario 3: Login Van Trusted Device
```
User opent app op trusted iPhone
         ↓
   [Biometric (Face ID) only]
   NO password needed!
         ↓
   📱 Device fingerprint check
   "Trusted device detected"
         ↓
   ✅ Instant unlock
   [Dashboard]
```

**UX:** Super fast voor trusted devices - beloning voor setup!

---

### Scenario 4: Suspicious Activity Detected
```
Login attempt from:
- New country (Russia)
- TOR network
- Blacklisted IP
         ↓
   ⚠️ Risk score: CRITICAL (90+)
         ↓
   🚫 LOGIN IMMEDIATELY BLOCKED
         ↓
   📧 Email: "SECURITY ALERT"
   "Suspicious login blocked"
   "From: Moscow, Russia"
   "Device: Unknown Windows PC"
   [Was This You?] [Secure Account]
         ↓
   IF user clicks "Secure Account":
         ↓
   🔒 Account temporarily locked
   "Your account is now locked"
         ↓
   🔐 Full verification required:
   1. Email verification
   2. 2FA code
   3. Answer security question
   4. Optionally: video selfie
         ↓
   ✅ Account unlocked
         ↓
   📧 All devices notified:
   "Your account was secured"
```

**Escalation:** Automatic threat response

---

## 🔧 TECHNICAL IMPLEMENTATION

### 1. Enhanced Device Fingerprinting
**File:** `lib/device-fingerprint-pro.ts`

```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { geolocate } from '@/lib/geolocation';

export interface EnhancedDeviceInfo {
  fingerprint: string;
  deviceName: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  userAgent: string;
  ipAddress: string;
  location: {
    country: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  timezone: string;
  language: string;
  languages: string[];
  screenResolution: string;
  colorDepth: number;
  pixelRatio: number;
  hardwareConcurrency: number; // CPU cores
  deviceMemory?: number; // GB RAM
  connection: {
    effectiveType: string; // '4g', '3g', etc.
    downlink: number;
    rtt: number;
  };
  plugins: string[];
  fonts: string[];
  canvas: string; // Canvas fingerprint
  webgl: string; // WebGL fingerprint
  audio: string; // Audio fingerprint
  touchSupport: boolean;
  vendor: string; // Browser vendor
  isIncognito: boolean;
  isTor: boolean;
  isVPN: boolean;
  riskScore: number; // 0-100
}

/**
 * Enhanced device fingerprinting with risk analysis
 */
export async function generateEnhancedFingerprint(): Promise<EnhancedDeviceInfo> {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  
  // Get IP and geolocation
  const ipData = await fetch('/api/ip-info').then(r => r.json());
  
  // Device naming
  const getDetailedDeviceName = (): string => {
    const ua = navigator.userAgent;
    
    // iOS devices
    if (/iPhone/.test(ua)) {
      const match = ua.match(/iPhone OS (\d+_\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `iPhone (iOS ${version})`;
    }
    
    if (/iPad/.test(ua)) {
      const match = ua.match(/OS (\d+_\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `iPad (iPadOS ${version})`;
    }
    
    // Android
    if (/Android/.test(ua)) {
      const match = ua.match(/Android (\d+\.?\d*)/);
      const version = match ? match[1] : 'Unknown';
      return `Android Device (${version})`;
    }
    
    // Desktop
    if (/Mac/.test(ua)) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/);
      const version = match ? match[1].replace('_', '.') : 'Unknown';
      return `Mac (macOS ${version})`;
    }
    
    if (/Windows NT/.test(ua)) {
      const match = ua.match(/Windows NT (\d+\.\d+)/);
      const version = match ? match[1] : 'Unknown';
      return `Windows PC (${version})`;
    }
    
    if (/Linux/.test(ua)) return 'Linux PC';
    
    return 'Unknown Device';
  };
  
  // TOR detection
  const detectTor = (): boolean => {
    return ipData.isTor || 
           navigator.userAgent.includes('Tor') ||
           ipData.hostname?.includes('.onion');
  };
  
  // VPN detection (basic)
  const detectVPN = async (): Promise<boolean> => {
    // Check against known VPN IP ranges
    const vpnCheck = await fetch(`/api/vpn-check?ip=${ipData.ip}`)
      .then(r => r.json())
      .catch(() => ({ isVPN: false }));
    
    return vpnCheck.isVPN;
  };
  
  // Incognito detection
  const detectIncognito = (): boolean => {
    return result.components.incognito || false;
  };
  
  // Connection info
  const getConnection = () => {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return {
      effectiveType: conn?.effectiveType || 'unknown',
      downlink: conn?.downlink || 0,
      rtt: conn?.rtt || 0,
    };
  };
  
  const isTor = detectTor();
  const isVPN = await detectVPN();
  const isIncognito = detectIncognito();
  
  // Calculate risk score
  const calculateRisk = (): number => {
    let score = 0;
    
    if (isTor) score += 40; // TOR is high risk
    if (isVPN) score += 20; // VPN is moderate risk
    if (isIncognito) score += 10; // Incognito is low risk
    if (ipData.blacklisted) score += 30; // Blacklisted IP
    
    // New country (requires historical data)
    // if (differentCountry) score += 15;
    
    // Unusual hours
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) score += 10;
    
    // No touch support on mobile claim
    if (/Mobile|Android|iOS/.test(navigator.userAgent) && !('ontouchstart' in window)) {
      score += 15; // Suspicious - mobile without touch
    }
    
    return Math.min(score, 100);
  };
  
  return {
    fingerprint: result.visitorId,
    deviceName: getDetailedDeviceName(),
    browser: result.components.browser.name,
    browserVersion: result.components.browser.version,
    os: result.components.os.name,
    osVersion: result.components.os.version,
    userAgent: navigator.userAgent,
    ipAddress: ipData.ip,
    location: {
      country: ipData.country,
      city: ipData.city,
      latitude: ipData.latitude,
      longitude: ipData.longitude,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    languages: navigator.languages as string[],
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    connection: getConnection(),
    plugins: result.components.plugins.map((p: any) => p.name),
    fonts: result.components.fonts || [],
    canvas: result.components.canvas?.value || '',
    webgl: result.components.webgl?.value || '',
    audio: result.components.audio?.value || '',
    touchSupport: 'ontouchstart' in window,
    vendor: navigator.vendor,
    isIncognito,
    isTor,
    isVPN,
    riskScore: calculateRisk(),
  };
}
```

**New API Endpoint Needed:**
```typescript
// app/api/ip-info/route.ts
export async function GET() {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  // Use ipapi.co or similar for geolocation
  const data = await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json());
  
  return NextResponse.json({
    ip: data.ip,
    country: data.country_name,
    city: data.city,
    latitude: data.latitude,
    longitude: data.longitude,
    isTor: data.threat?.is_tor || false,
    blacklisted: data.threat?.is_proxy || data.threat?.is_threat || false,
  });
}
```

---

### 2. Strict Auth Flow with Blocking
**File:** `lib/supabase-auth-strict.ts`

```typescript
import { generateEnhancedFingerprint } from './device-fingerprint-pro';

export interface StrictSignInResult {
  success: boolean;
  error?: string;
  requiresDeviceVerification?: boolean;
  requires2FA?: boolean;
  deviceVerificationToken?: string;
  user?: any;
  mnemonic?: string;
}

export async function strictSignInWithEmail(
  email: string,
  password: string
): Promise<StrictSignInResult> {
  try {
    // 1. Basic authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    if (!data.user) throw new Error('No user returned');
    
    // 2. Generate enhanced fingerprint
    const deviceInfo = await generateEnhancedFingerprint();
    
    // 3. Check risk score
    if (deviceInfo.riskScore > 70) {
      // HIGH RISK - block immediately and alert user
      logger.warn(`🚨 HIGH RISK login blocked: score=${deviceInfo.riskScore}`);
      
      // Send security alert email
      await fetch('/api/security-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user.id,
          email: data.user.email,
          deviceInfo,
          alertType: 'suspicious_login_blocked',
        }),
      });
      
      // Log out immediately
      await supabase.auth.signOut();
      
      return {
        success: false,
        error: `Suspicious activity detected. We've sent a security alert to your email. If this was you, please contact support.`,
      };
    }
    
    // 4. Check if device is trusted
    const { data: existingDevice } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('device_fingerprint', deviceInfo.fingerprint)
      .single();
    
    if (existingDevice && existingDevice.verified_at) {
      // ✅ TRUSTED DEVICE - allow login
      logger.log('✅ Login from trusted device');
      
      // Update last_used_at
      await supabase
        .from('trusted_devices')
        .update({ 
          last_used_at: new Date().toISOString(),
          is_current: true 
        })
        .eq('id', existingDevice.id);
      
      // Decrypt wallet and return
      const { data: wallet } = await supabase
        .from('wallets')
        .select('encrypted_mnemonic')
        .eq('user_id', data.user.id)
        .single();
      
      const decryptedMnemonic = await decryptMnemonic(
        wallet.encrypted_mnemonic,
        password
      );
      
      return {
        success: true,
        user: data.user,
        mnemonic: decryptedMnemonic,
      };
    }
    
    // 🆕 NEW OR UNVERIFIED DEVICE - BLOCK LOGIN
    logger.warn('🚫 New device detected - blocking login');
    
    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate device verification token
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry
    
    // Store device with pending verification
    await supabase
      .from('trusted_devices')
      .upsert({
        user_id: data.user.id,
        device_name: deviceInfo.deviceName,
        device_fingerprint: deviceInfo.fingerprint,
        ip_address: deviceInfo.ipAddress,
        user_agent: deviceInfo.userAgent,
        browser: `${deviceInfo.browser} ${deviceInfo.browserVersion}`,
        os: `${deviceInfo.os} ${deviceInfo.osVersion}`,
        is_current: false,
        verification_token: deviceToken,
        verification_code: verificationCode, // Store for validation
        verification_expires_at: expiresAt.toISOString(),
        device_metadata: JSON.stringify({
          location: deviceInfo.location,
          riskScore: deviceInfo.riskScore,
          isTor: deviceInfo.isTor,
          isVPN: deviceInfo.isVPN,
        }),
      }, {
        onConflict: 'user_id,device_fingerprint'
      });
    
    // Send verification code email
    await fetch('/api/device-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.user.email,
        code: verificationCode,
        deviceInfo,
      }),
    });
    
    // Log security event
    await supabase.rpc('log_user_activity', {
      p_user_id: data.user.id,
      p_activity_type: 'device_verification_required',
      p_description: `New device login blocked: ${deviceInfo.deviceName}`,
      p_ip_address: deviceInfo.ipAddress,
      p_device_info: JSON.stringify(deviceInfo),
    });
    
    // Sign out user (don't keep session for unverified device)
    await supabase.auth.signOut();
    
    return {
      success: false,
      requiresDeviceVerification: true,
      deviceVerificationToken: deviceToken,
      error: 'Device verification required',
    };
    
  } catch (error: any) {
    logger.error('Login error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

---

### 3. Device Verification Modal (BLOCKING)
**File:** `components/DeviceVerificationModal.tsx`

```typescript
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, Loader, CheckCircle, Globe, Monitor } from 'lucide-react';

interface DeviceVerificationModalProps {
  isOpen: boolean;
  deviceToken: string;
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function DeviceVerificationModal({
  isOpen,
  deviceToken,
  deviceInfo,
  onSuccess,
  onCancel,
}: DeviceVerificationModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'code' | '2fa' | 'success'>('code');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  const handleVerifyCode = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/verify-device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: deviceToken,
          code: code.replace('-', ''),
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Move to 2FA step
        setStep('2fa');
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerify2FA = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: deviceToken,
          code: twoFactorCode,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStep('success');
        setTimeout(() => onSuccess(), 2000);
      } else {
        setError(data.error || 'Invalid 2FA code');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
      >
        {/* STEP 1: Email Code */}
        {step === 'code' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Device Verification Required
              </h2>
              
              <p className="text-gray-600 text-sm">
                We detected a login from a new device
              </p>
            </div>
            
            {/* Device Info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Monitor className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{deviceInfo.deviceName}</p>
                  <p className="text-xs text-gray-500">New Device</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{deviceInfo.location}</p>
                  <p className="text-xs text-gray-500">{deviceInfo.ipAddress}</p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              We've sent a 6-digit code to your email. Enter it below to continue.
            </p>
            
            <input
              type="text"
              value={code}
              onChange={(e) => {
                let value = e.target.value.replace(/\D/g, ''); // Only digits
                if (value.length > 3) {
                  value = value.slice(0, 3) + '-' + value.slice(3, 6);
                }
                setCode(value);
              }}
              maxLength={7}
              placeholder="000-000"
              className="w-full text-center text-2xl font-bold tracking-wider bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-4 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <button
              onClick={handleVerifyCode}
              disabled={loading || code.length < 7}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold py-4 px-6 rounded-xl hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all mb-3"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Verify Code'
              )}
            </button>
            
            <button
              onClick={onCancel}
              className="w-full text-gray-600 hover:text-gray-900 text-sm font-medium py-2"
            >
              Cancel Login
            </button>
          </>
        )}
        
        {/* STEP 2: 2FA */}
        {step === '2fa' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Two-Factor Authentication
              </h2>
              
              <p className="text-gray-600 text-sm">
                Enter your 6-digit code from your authenticator app
              </p>
            </div>
            
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              className="w-full text-center text-2xl font-bold tracking-widest bg-gray-50 border-2 border-gray-300 rounded-xl px-4 py-4 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <button
              onClick={handleVerify2FA}
              disabled={loading || twoFactorCode.length < 6}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Verify'
              )}
            </button>
          </>
        )}
        
        {/* STEP 3: Success */}
        {step === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Device Verified!
            </h2>
            
            <p className="text-gray-600 text-sm">
              This device is now trusted. Redirecting...
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
```

---

### 4. Updated Login Flow
**File:** `components/PasswordUnlockModal.tsx` (UPDATED)

```typescript
// Add device verification handling
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setIsLoading(true);
  
  try {
    // Use strict auth
    const result = await strictSignInWithEmail(pendingNewEmail || email, password);
    
    if (result.requiresDeviceVerification) {
      // Show device verification modal
      setShowDeviceVerification(true);
      setDeviceVerificationToken(result.deviceVerificationToken!);
      return;
    }
    
    if (result.success) {
      // Existing logic
      onComplete();
    } else {
      throw new Error(result.error);
    }
    
  } catch (error: any) {
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

---

### 5. Email Template (Verification Code)
**File:** `lib/email-templates.ts` (ADD)

```typescript
export function generateDeviceVerificationCodeEmail(
  code: string,
  deviceInfo: any
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Device Verification Code - BLAZE Wallet</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #f6921e 0%, #f6d365 100%); padding: 40px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold;">🔐 Device Verification</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px;">
      <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 24px;">New Device Login Detected</h2>
      
      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px;">
        We detected a login attempt from a new device:
      </p>
      
      <!-- Device Info Box -->
      <div style="background: #f7fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; margin: 0 0 30px;">
        <div style="margin-bottom: 12px;">
          <strong style="color: #2d3748;">Device:</strong>
          <span style="color: #4a5568;">${deviceInfo.deviceName}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #2d3748;">Location:</strong>
          <span style="color: #4a5568;">${deviceInfo.location.city}, ${deviceInfo.location.country}</span>
        </div>
        <div>
          <strong style="color: #2d3748;">IP Address:</strong>
          <span style="color: #4a5568;">${deviceInfo.ipAddress}</span>
        </div>
      </div>
      
      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px;">
        Your verification code is:
      </p>
      
      <!-- Verification Code -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; text-align: center; margin: 0 0 30px;">
        <div style="color: white; font-size: 48px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
          ${code.slice(0, 3)}-${code.slice(3)}
        </div>
        <p style="margin: 10px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
          Valid for 15 minutes
        </p>
      </div>
      
      <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px;">
        Enter this code in the BLAZE Wallet app to verify your device.
      </p>
      
      <!-- Warning Box -->
      <div style="background: #fff5f5; border-left: 4px solid #f56565; padding: 16px; margin: 0 0 20px; border-radius: 8px;">
        <p style="margin: 0; color: #c53030; font-size: 14px; font-weight: bold;">
          ⚠️ Wasn't you?
        </p>
        <p style="margin: 8px 0 0; color: #742a2a; font-size: 14px;">
          If you didn't try to log in, someone may have your password. Change it immediately and enable 2FA.
        </p>
      </div>
      
      <!-- Button -->
      <div style="text-align: center; margin: 30px 0 0;">
        <a href="mailto:support@blazewallet.io" style="display: inline-block; background: linear-gradient(135deg, #f6921e 0%, #f6d365 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; font-size: 16px;">
          Contact Support
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #718096; font-size: 14px;">
        This is an automated security notification from BLAZE Wallet.
      </p>
      <p style="margin: 10px 0 0; color: #a0aec0; font-size: 12px;">
        © 2026 BLAZE Wallet. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
`.trim();
}
```

---

## 📊 FEATURES

### ✅ Core Features (Mandatory)
- [x] Enhanced device fingerprinting (FingerprintJS Pro)
- [x] **LOGIN BLOCKING** for new devices
- [x] Email verification code (15min expiry)
- [x] **MANDATORY 2FA** after device verification
- [x] Geolocation tracking (country, city)
- [x] Risk scoring (TOR/VPN/Blacklist detection)
- [x] Automatic high-risk blocking
- [x] Security alert emails
- [x] Device metadata storage
- [x] Trusted device shortcuts (biometric only)

### ✅ UX Features
- [x] Multi-step verification modal
- [x] Device naming (optional)
- [x] "Not me" quick action
- [x] Detailed device info display
- [x] Success/error states
- [x] Auto-redirect after verification

### ✅ Security Features
- [x] Zero trust architecture
- [x] Multi-factor authentication
- [x] TOR/VPN detection
- [x] IP blacklist checking
- [x] Risk-based blocking
- [x] Account lockdown capability
- [x] All devices notification
- [x] Security question fallback (optional)

---

## 📈 IMPLEMENTATION TIMELINE

### Phase 1: Enhanced Foundation (Week 1-2)
- [ ] Install FingerprintJS Pro
- [ ] Build `lib/device-fingerprint-pro.ts`
- [ ] Implement IP geolocation API
- [ ] Implement VPN/TOR detection
- [ ] Build risk scoring algorithm

### Phase 2: Blocking Auth Flow (Week 3-4)
- [ ] Build `lib/supabase-auth-strict.ts`
- [ ] Update database schema (add verification_code)
- [ ] Build `DeviceVerificationModal.tsx`
- [ ] Implement code generation & validation
- [ ] Integrate 2FA requirement

### Phase 3: Email & Alerts (Week 5)
- [ ] Build verification code email template
- [ ] Build security alert email templates
- [ ] Implement email delivery
- [ ] Test email deliverability

### Phase 4: Testing & Hardening (Week 6-7)
- [ ] Test on multiple devices
- [ ] Test TOR/VPN blocking
- [ ] Test 2FA flow
- [ ] Penetration testing
- [ ] Load testing

### Phase 5: Production & Monitoring (Week 8)
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production
- [ ] Setup monitoring & alerts
- [ ] Document runbooks

**Total:** ~8 weeks, 2-3 developers

---

## 💰 COST

### Development
- **Time:** 8 weeks × 2.5 devs = 20 developer-weeks
- **FingerprintJS Pro:** $500/month (250K identifications)
- **IP Geolocation API:** $50/month (100K lookups)
- **VPN/Proxy Detection:** $100/month
- **Email:** Existing (Resend.com)

### Infrastructure
- **Supabase:** +$50/month (more DB writes)
- **Monitoring:** +$50/month (alerting)

### Total: ~$750/month operational cost

---

## 👍 PROS

1. **Maximum Security**
   - Zero trust by default
   - Multi-layer verification
   - Compliance-ready (SOC 2, ISO 27001)

2. **Threat Prevention**
   - Blocks TOR/VPN/suspicious IPs
   - Risk-based authentication
   - Real-time alerts

3. **User Trust**
   - Professional security posture
   - Transparent about threats
   - Emulates Coinbase/Kraken

4. **Audit Trail**
   - Complete device history
   - All logins logged
   - Forensics-ready

5. **Scalable**
   - Ready for enterprise clients
   - Compliance certifications easier
   - Insurance-friendly

---

## 👎 CONS

1. **High Friction**
   - Login takes 2-3 minutes voor new devices
   - Multiple steps required
   - Users may abandon

2. **Support Burden**
   - More "I can't log in" tickets
   - Edge cases (travel, VPN users)
   - Email deliverability issues

3. **Development Cost**
   - 8 weeks vs 4 weeks
   - More complex codebase
   - Higher operational costs

4. **False Positives**
   - Legitimate VPN users blocked
   - Travel triggers alerts
   - Over-cautious UX

5. **Dependency Risk**
   - Relies on external APIs (IP, VPN detection)
   - Email delivery critical path
   - More points of failure

---

## 🎯 BEST FOR

- **Enterprise customers** die compliance eisen hebben
- **High-value** wallet users (whales)
- **Regulated markets** (EU, US financial services)
- **Security-first** company cultures
- **Post-breach** recovery (if you've been hacked)

---

## 📊 METRICS TO TRACK

1. **Verification Success Rate**
   - % users die verification completen (target: >85%)

2. **False Positive Rate**
   - % legitimate logins geblokkeerd (target: <5%)

3. **Support Ticket Volume**
   - # tickets re: device verification (monitor trend)

4. **Abandonment Rate**
   - % users die opgeven during verification (target: <10%)

5. **Risk Score Distribution**
   - Distribution of risk scores (validate algorithm)

6. **High-Risk Blocks**
   - # logins blocked due to high risk (effectiveness metric)

---

## ⚠️ IMPORTANT CONSIDERATIONS

### 1. **Email Deliverability is CRITICAL**
- Without email, users can't verify devices
- Need backup: SMS fallback? Support override?

### 2. **Legitimate VPN Users**
- Many users use VPN for privacy
- Don't block all VPNs automatically
- Risk score, don't hard block

### 3. **International Travel**
- Users traveling trigger "new country" alerts
- Don't block, just require verification
- Consider "travel mode" feature

### 4. **Support Escalation Path**
- Users locked out need manual review
- 24/7 support? At least email support
- Clear documentation

### 5. **Gradual Rollout**
- Don't launch to 100% immediately
- A/B test: 10% → 50% → 100%
- Monitor metrics at each stage

---

**Status:** Voorstel 2 compleet ✅  
**Recommendation:** See comparison document 📊

