/**
 * 🔐 BLAZE WALLET - KMS PUBLIC KEY API
 * 
 * Exposes KMS public key for client-side encryption
 * ✅ Safe to expose (public key cannot decrypt)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kmsService } from '@/lib/kms-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// In-memory cache (15 minutes)
let cachedPublicKey: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(req: NextRequest) {
  try {
    logger.log('[KMS] Public key request received');
    logger.log('[KMS] Environment check:', {
      region: process.env.AWS_REGION,
      keyAlias: process.env.AWS_KMS_KEY_ALIAS,
      keyId: process.env.KMS_KEY_ID,
      hasAccessKey: Boolean(process.env.AWS_ACCESS_KEY_ID),
      hasSecretKey: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
    });

    // Check cache
    const now = Date.now();
    if (cachedPublicKey && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        publicKey: cachedPublicKey,
        cached: true,
      });
    }

    // Fetch fresh public key
    const publicKey = await kmsService.getPublicKey();
    logger.log('[KMS] Public key retrieved successfully');

    // Update cache
    cachedPublicKey = publicKey;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      publicKey,
      cached: false,
    });

  } catch (error: any) {
    logger.error('❌ Failed to get public key:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve public key',
      details: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

