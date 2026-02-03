/**
 * API Route: Verify 2FA for sensitive actions
 * Part of SESSION SHIELD implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { verify2FACode, verifyBackupCode } from '@/lib/2fa-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { userId, code, isBackupCode, actionType } = await request.json();

    if (!userId || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    logger.log(`🔐 Verifying 2FA for action: ${actionType}`);

    // Verify the code (TOTP or backup)
    const result = isBackupCode
      ? await verifyBackupCode(userId, code)
      : await verify2FACode(userId, code);

    if (!result.success) {
      logger.warn('❌ 2FA verification failed for action:', actionType);
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid code' },
        { status: 400 }
      );
    }

    logger.log('✅ 2FA verification successful for action:', actionType);

    return NextResponse.json({
      success: true,
      message: '2FA verified successfully',
    });
  } catch (error: any) {
    logger.error('❌ 2FA action verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}

