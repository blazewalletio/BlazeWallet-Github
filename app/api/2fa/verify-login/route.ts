import { NextRequest, NextResponse } from 'next/server';
import { verify2FACode, verifyBackupCode } from '@/lib/2fa-service';
import { logger } from '@/lib/logger';

/**
 * API route to verify 2FA during login
 * This keeps the SERVICE_ROLE_KEY server-side only
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, code, isBackupCode } = await request.json();

    // Validation
    if (!userId || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;
    if (isBackupCode) {
      result = await verifyBackupCode(userId, code);
    } else {
      result = await verify2FACode(userId, code);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('2FA login verification API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

