import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
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

// Generate 2FA secret and QR code
export async function POST(request: NextRequest) {
  try {
    const { userId, email, action } = await request.json();

    if (!userId || !email) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'setup') {
      // Generate new secret
      const secret = authenticator.generateSecret();
      
      // Generate OTP auth URL
      const otpauthUrl = authenticator.keyuri(
        email,
        'BLAZE Wallet',
        secret
      );
      
      // Generate QR code
      const qrCode = await QRCode.toDataURL(otpauthUrl);
      
      // Store secret (encrypted) in database
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          two_factor_secret: secret,
          two_factor_method: 'authenticator'
        })
        .eq('user_id', userId);
      
      if (updateError) {
        logger.error('Failed to store 2FA secret:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to setup 2FA' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        secret,
        qrCode,
        otpauthUrl
      });
    }
    
    if (action === 'verify') {
      const { token } = await request.json();
      
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Verification code required' },
          { status: 400 }
        );
      }
      
      // Get stored secret
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('two_factor_secret')
        .eq('user_id', userId)
        .single();
      
      if (profileError || !profile?.two_factor_secret) {
        return NextResponse.json(
          { success: false, error: '2FA not setup' },
          { status: 400 }
        );
      }
      
      // Verify token
      const isValid = authenticator.verify({
        token,
        secret: profile.two_factor_secret
      });
      
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code' },
          { status: 400 }
        );
      }
      
      // Enable 2FA
      const { error: enableError } = await supabaseAdmin
        .from('user_profiles')
        .update({ two_factor_enabled: true })
        .eq('user_id', userId);
      
      if (enableError) {
        logger.error('Failed to enable 2FA:', enableError);
        return NextResponse.json(
          { success: false, error: 'Failed to enable 2FA' },
          { status: 500 }
        );
      }
      
      // Log activity
      await supabaseAdmin.rpc('log_user_activity', {
        p_user_id: userId,
        p_activity_type: 'security_alert',
        p_description: 'Two-factor authentication enabled',
        p_metadata: JSON.stringify({ method: 'authenticator' })
      });
      
      // Recalculate security score
      await supabaseAdmin.rpc('calculate_security_score', {
        p_user_id: userId
      });
      
      return NextResponse.json({
        success: true,
        message: '2FA enabled successfully'
      });
    }
    
    if (action === 'disable') {
      const { token } = await request.json();
      
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Verification code required' },
          { status: 400 }
        );
      }
      
      // Get stored secret
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('two_factor_secret')
        .eq('user_id', userId)
        .single();
      
      if (profileError || !profile?.two_factor_secret) {
        return NextResponse.json(
          { success: false, error: '2FA not setup' },
          { status: 400 }
        );
      }
      
      // Verify token before disabling
      const isValid = authenticator.verify({
        token,
        secret: profile.two_factor_secret
      });
      
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code' },
          { status: 400 }
        );
      }
      
      // Disable 2FA
      const { error: disableError } = await supabaseAdmin
        .from('user_profiles')
        .update({ 
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_method: null
        })
        .eq('user_id', userId);
      
      if (disableError) {
        logger.error('Failed to disable 2FA:', disableError);
        return NextResponse.json(
          { success: false, error: 'Failed to disable 2FA' },
          { status: 500 }
        );
      }
      
      // Log activity
      await supabaseAdmin.rpc('log_user_activity', {
        p_user_id: userId,
        p_activity_type: 'security_alert',
        p_description: 'Two-factor authentication disabled',
        p_metadata: JSON.stringify({ method: 'authenticator' })
      });
      
      // Recalculate security score
      await supabaseAdmin.rpc('calculate_security_score', {
        p_user_id: userId
      });
      
      return NextResponse.json({
        success: true,
        message: '2FA disabled successfully'
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error: any) {
    logger.error('2FA API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

