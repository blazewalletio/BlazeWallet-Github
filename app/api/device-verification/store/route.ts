/**
 * API Route: Store Device Verification
 * Server-side device verification storage (Industry Best Practice)
 * 
 * Why server-side?
 * - Security: Client code can be manipulated
 * - RLS: Service role bypasses RLS correctly (not hacky)
 * - Validation: Server can verify session + add fraud detection
 * - Standard: How Auth0, Clerk, Firebase, Stripe do it
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// Bypass CSRF protection (we use Bearer token authentication instead)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create admin client (service role - bypasses RLS)
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
    console.log('🔐 [device-verification/store] API called');
    
    // 1. Get session from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ [device-verification/store] No authorization header');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // 2. Verify the user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ [device-verification/store] Invalid session:', authError);
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    console.log('✅ [device-verification/store] User verified:', user.id);
    
    // 3. Get device info from request body
    const { deviceId, deviceInfo, existingDeviceId } = await request.json();
    
    if (!deviceId || !deviceInfo) {
      console.error('❌ [device-verification/store] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    console.log('📱 [device-verification/store] Device info received:', {
      deviceId: deviceId.substring(0, 12) + '...',
      deviceName: deviceInfo.deviceName,
      existingDeviceId,
    });
    
    // 4. Generate verification code and token
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const crypto = await import('crypto');
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min expiry
    
    console.log('🔑 [device-verification/store] Generated code:', verificationCode);
    
    // 5. Store device in database (using service role - bypasses RLS)
    let deviceDbId: string;
    let dbSuccess = false;
    
    if (existingDeviceId) {
      // UPDATE existing device
      console.log('🔄 [device-verification/store] Updating existing device:', existingDeviceId);
      
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('trusted_devices')
        .update({
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: `${deviceInfo.browser}`,
          os: `${deviceInfo.os}`,
          verification_token: deviceToken,
          verification_code: verificationCode,
          verification_expires_at: expiresAt.toISOString(),
        })
        .eq('id', existingDeviceId)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ [device-verification/store] UPDATE failed:', updateError);
        logger.error('[device-verification/store] UPDATE failed', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update device verification' },
          { status: 500 }
        );
      }
      
      deviceDbId = updateData.id;
      dbSuccess = true;
      console.log('✅ [device-verification/store] Device updated:', deviceDbId);
      
    } else {
      // INSERT new device
      console.log('➕ [device-verification/store] Inserting new device');
      
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('trusted_devices')
        .insert({
          user_id: user.id,
          device_id: deviceId,
          device_name: deviceInfo.deviceName,
          device_fingerprint: deviceInfo.fingerprint,
          ip_address: deviceInfo.ipAddress,
          user_agent: deviceInfo.userAgent,
          browser: `${deviceInfo.browser}`,
          os: `${deviceInfo.os}`,
          verification_token: deviceToken,
          verification_code: verificationCode,
          verification_expires_at: expiresAt.toISOString(),
          is_current: true,
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ [device-verification/store] INSERT failed:', insertError);
        logger.error('[device-verification/store] INSERT failed', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to store device verification' },
          { status: 500 }
        );
      }
      
      deviceDbId = insertData.id;
      dbSuccess = true;
      console.log('✅ [device-verification/store] Device inserted:', deviceDbId);
    }
    
    if (!dbSuccess) {
      console.error('❌ [device-verification/store] Database operation failed');
      return NextResponse.json(
        { success: false, error: 'Failed to store device verification' },
        { status: 500 }
      );
    }
    
    // 6. Send verification email
    console.log('📧 [device-verification/store] Sending verification email...');
    
    try {
      const emailResponse = await fetch(`${request.nextUrl.origin}/api/send-device-code`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          deviceName: deviceInfo.deviceName,
          verificationCode: verificationCode,
          location: deviceInfo.location,
        }),
      });
      
      if (!emailResponse.ok) {
        console.error('❌ [device-verification/store] Email failed:', await emailResponse.text());
        // Don't fail the whole flow - code is in DB, user can request resend
      } else {
        console.log('✅ [device-verification/store] Email sent successfully');
      }
    } catch (emailError) {
      console.error('❌ [device-verification/store] Email error:', emailError);
      // Don't fail the whole flow - code is in DB, user can request resend
    }
    
    // 7. Log to Supabase debug logs
    await logger.log('[device-verification/store] Device stored successfully', {
      userId: user.id,
      deviceId: deviceId.substring(0, 12) + '...',
      deviceDbId,
      verificationCode, // For debugging only
    });
    
    // 8. Return success with device token
    console.log('🎉 [device-verification/store] Success!');
    return NextResponse.json({
      success: true,
      deviceVerificationToken: deviceToken,
    });
    
  } catch (error: any) {
    console.error('💥 [device-verification/store] Fatal error:', error);
    logger.error('[device-verification/store] Fatal error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

