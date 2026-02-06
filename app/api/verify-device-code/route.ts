import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

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
    const { userId, email, code, deviceInfo } = await request.json();
    
    if (!userId || !email || !code || !deviceInfo) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Find device with matching code
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceInfo.fingerprint)
      .eq('verification_code', code)
      .maybeSingle();
    
    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    // Check if code expired
    if (device.verification_code_expires_at && new Date(device.verification_code_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Verification code expired. Please request a new one.' },
        { status: 400 }
      );
    }
    
    // Mark device as verified
    const { error: updateError } = await supabaseAdmin
      .from('trusted_devices')
      .update({
        verified_at: new Date().toISOString(),
        is_current: true,
        verification_code: null, // Clear code after use
        verification_code_expires_at: null,
        last_used_at: new Date().toISOString()
      })
      .eq('id', device.id);
    
    if (updateError) {
      logger.error('Failed to verify device:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify device' },
        { status: 500 }
      );
    }
    
    logger.log('✅ Device verified with code:', userId.substring(0, 8) + '...');
    return NextResponse.json({ 
      success: true, 
      message: 'Device verified successfully'
    });
    
  } catch (error: any) {
    logger.error('Verify device code error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
