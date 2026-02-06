/**
 * API Route: Device Verification Code
 * Handles sending and validating verification codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';

// Configure route to allow POST without CSRF token
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create admin client for user lookup
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Rate limiting: Max 10 attempts per IP per 15 minutes
    const clientIP = getClientIP(request.headers);
    const rateLimit = checkRateLimit(`verify-code:${clientIP}`, 10, 15 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      logger.warn(`⚠️ Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json(
        { 
          error: 'Too many attempts',
          message: `Please try again in ${Math.ceil(rateLimit.resetIn / 60)} minutes`,
        },
        { status: 429 }
      );
    }
    
    // Handle resend request
    if (body.resend && body.deviceToken) {
      logger.log('🔄 Resending verification code...');
      
      // Get device by token
      const { data: device, error } = await supabaseAdmin
        .from('trusted_devices')
        .select('*')
        .eq('verification_token', body.deviceToken)
        .maybeSingle();
      
      if (error || !device) {
        return NextResponse.json(
          { error: 'Invalid device token' },
          { status: 400 }
        );
      }
      
      // Generate new code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      // Update device with new code
      await supabaseAdmin
        .from('trusted_devices')
        .update({
          verification_code: newCode,
          verification_expires_at: expiresAt.toISOString(),
        })
        .eq('id', device.id);
      
      // Get user email
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(device.user_id);
      
      if (!userData.user?.email) {
        return NextResponse.json(
          { error: 'User email not found' },
          { status: 400 }
        );
      }
      
      // Send new email
      const deviceInfo = device.device_metadata || {};
      await sendVerificationEmail(
        userData.user.email,
        newCode,
        {
          deviceName: device.device_name,
          location: deviceInfo.location ? `${deviceInfo.location.city}, ${deviceInfo.location.country}` : 'Unknown',
          ipAddress: device.ip_address,
          browser: device.browser || 'Unknown',
          os: device.os || 'Unknown',
        }
      );
      
      return NextResponse.json({ success: true });
    }
    
    // Handle code validation
    if (body.step === 'validate_code') {
      const { deviceToken, verificationCode } = body;
      
      if (!deviceToken || !verificationCode) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      logger.log('🔍 [DEBUG] Validating code:', {
        deviceToken: deviceToken?.substring(0, 16) + '...',
        verificationCode,
      });
      
      // First, check if device exists with this token
      const { data: deviceByToken, error: tokenError } = await supabaseAdmin
        .from('trusted_devices')
        .select('*')
        .eq('verification_token', deviceToken)
        .maybeSingle();
      
      if (tokenError) {
        logger.error('❌ Database error checking device:', tokenError);
        return NextResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
      }
      
      if (!deviceByToken) {
        logger.warn('❌ No device found with this token');
        return NextResponse.json(
          { error: 'Invalid device token' },
          { status: 401 }
        );
      }
      
      logger.log('✅ [DEBUG] Device found:', {
        id: deviceByToken.id,
        stored_code: deviceByToken.verification_code,
        input_code: verificationCode,
        codes_match: deviceByToken.verification_code === verificationCode,
        expires_at: deviceByToken.verification_expires_at,
      });
      
      // Now validate the code
      const { data: device, error } = await supabaseAdmin
        .from('trusted_devices')
        .select('*')
        .eq('verification_token', deviceToken)
        .eq('verification_code', verificationCode)
        .maybeSingle();
      
      if (error || !device) {
        logger.warn('❌ Invalid verification code attempt - code mismatch');
        logger.warn('Expected code in DB:', deviceByToken.verification_code);
        logger.warn('Received code:', verificationCode);
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 401 }
        );
      }
      
      // Check expiry
      if (new Date(device.verification_expires_at) < new Date()) {
        return NextResponse.json(
          { error: 'Verification code has expired' },
          { status: 401 }
        );
      }
      
      // ✅ MARK DEVICE AS VERIFIED!
      // This is CRITICAL - without this, device stays unverified!
      const crypto = await import('crypto');
      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      const { error: updateError } = await supabaseAdmin
        .from('trusted_devices')
        .update({
          verified_at: new Date().toISOString(), // ✅ Mark as verified
          is_current: true,
          session_token: sessionToken,
          last_verified_session_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
          verification_code: null, // Clear code after use
          verification_token: null, // Clear token after use
        })
        .eq('id', device.id);
      
      if (updateError) {
        logger.error('❌ Failed to mark device as verified:', updateError);
        return NextResponse.json(
          { error: 'Failed to verify device' },
          { status: 500 }
        );
      }
      
      logger.log('✅ Device marked as verified in database!');
      
      // Store device_id in localStorage for future use
      // Return it so client can store it
      
      // Check if user has 2FA enabled
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(device.user_id);
      const has2FA = userData?.user?.app_metadata?.two_factor_enabled === true;
      
      logger.log('✅ Verification code accepted', { has2FA, deviceId: device.device_id });
      return NextResponse.json({ 
        success: true,
        requires2FA: has2FA,
        deviceId: device.device_id, // Return device_id for client storage
        sessionToken, // Return session token for client storage
      });
    }
    
    // Handle initial email send
    const { email, code, deviceInfo } = body;
    
    if (!email || !code || !deviceInfo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    logger.log('📧 Sending verification code to:', email);
    
    await sendVerificationEmail(email, code, deviceInfo);
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    logger.error('❌ Device verification code error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Send verification code email
 */
async function sendVerificationEmail(
  email: string,
  code: string,
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
    browser: string;
    os: string;
  }
) {
  try {
    // Format code with dash for readability (123-456)
    const formattedCode = `${code.slice(0, 3)}-${code.slice(3)}`;
    
    // Send email via Supabase Auth (if configured) or external service
    // For now, we'll use a placeholder - you should implement with your email service
    
    logger.log('📧 Verification email sent to:', email);
    logger.log('🔢 Code:', formattedCode);
    logger.log('📱 Device:', deviceInfo.deviceName);
    logger.log('🌍 Location:', deviceInfo.location);
    
    // TODO: Implement actual email sending
    // Example with Resend, SendGrid, or Supabase Auth:
    /*
    await resend.emails.send({
      from: 'BLAZE Wallet <noreply@blazewallet.io>',
      to: email,
      subject: '🔐 Verify Your New Device',
      html: getVerificationEmailHTML(formattedCode, deviceInfo),
    });
    */
    
    // For development, log to console
    console.log('='.repeat(60));
    console.log('📧 VERIFICATION EMAIL');
    console.log('='.repeat(60));
    console.log(`To: ${email}`);
    console.log(`Code: ${formattedCode}`);
    console.log(`Device: ${deviceInfo.deviceName}`);
    console.log(`Location: ${deviceInfo.location}`);
    console.log(`IP: ${deviceInfo.ipAddress}`);
    console.log('='.repeat(60));
    
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to send verification email:', error);
    throw error;
  }
}

/**
 * HTML email template for device verification
 */
function getVerificationEmailHTML(
  code: string,
  deviceInfo: {
    deviceName: string;
    location: string;
    ipAddress: string;
    browser: string;
    os: string;
  }
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Device - BLAZE Wallet</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: white;
      border-radius: 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #f97316 0%, #eab308 100%);
      padding: 40px 30px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
    }
    .code-box {
      background: linear-gradient(135deg, #f97316 0%, #eab308 100%);
      color: white;
      padding: 30px;
      border-radius: 16px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: 8px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    .device-info {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .device-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .device-row:last-child {
      border-bottom: none;
    }
    .device-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 100px;
    }
    .device-value {
      color: #111827;
    }
    .warning {
      background: #fef3c7;
      border: 2px solid #fbbf24;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .warning-title {
      font-weight: 700;
      color: #92400e;
      margin: 0 0 10px 0;
    }
    .warning-text {
      color: #92400e;
      margin: 0;
    }
    .footer {
      text-align: center;
      padding: 30px;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #f97316 0%, #eab308 100%);
      color: white;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>🔐 Verify Your Device</h1>
      </div>
      
      <div class="content">
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          We detected a login attempt from a new device. To keep your wallet secure, please verify this device with the code below:
        </p>
        
        <div class="code-box">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">Your Verification Code</div>
          <div class="code">${code}</div>
          <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">Valid for 15 minutes</div>
        </div>
        
        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          After entering this code, you'll be asked to provide your 2FA code from your authenticator app.
        </p>
        
        <div class="device-info">
          <div style="font-weight: 700; color: #111827; margin-bottom: 12px;">📱 Device Details</div>
          <div class="device-row">
            <div class="device-label">Device:</div>
            <div class="device-value">${deviceInfo.deviceName}</div>
          </div>
          <div class="device-row">
            <div class="device-label">Browser:</div>
            <div class="device-value">${deviceInfo.browser}</div>
          </div>
          <div class="device-row">
            <div class="device-label">OS:</div>
            <div class="device-value">${deviceInfo.os}</div>
          </div>
          <div class="device-row">
            <div class="device-label">Location:</div>
            <div class="device-value">${deviceInfo.location}</div>
          </div>
          <div class="device-row">
            <div class="device-label">IP Address:</div>
            <div class="device-value">${deviceInfo.ipAddress}</div>
          </div>
        </div>
        
        <div class="warning">
          <div class="warning-title">⚠️ Didn't try to log in?</div>
          <p class="warning-text">
            If you didn't attempt to access your wallet from this device, someone may be trying to access your account. Please change your password immediately and enable additional security measures.
          </p>
        </div>
      </div>
      
      <div class="footer">
        <p style="margin: 0 0 10px 0;">
          This is an automated security email from BLAZE Wallet.
        </p>
        <p style="margin: 0;">
          © ${new Date().getFullYear()} BLAZE Wallet. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

