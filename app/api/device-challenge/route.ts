/**
 * API Route: Device Challenge
 * Server-side device scoring for Trust Anchor system
 * Scores devices based on multiple signals (device_id, fingerprint, IP, browser, OS)
 * Returns: trusted (auto-login), requiresConfirmation (1-click), or requiresVerification (email)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { calculateStringSimilarity } from '@/lib/device-matcher';
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create admin client for querying trusted devices
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

/**
 * Device Challenge Request
 */
interface DeviceChallengeRequest {
  userId: string;
  challenge: {
    deviceId: string | null; // From localStorage (may be null if cleared)
    fingerprint: string;
    ipAddress: string;
    timezone: string;
    browser: string;
    browserVersion: string;
    os: string;
    osVersion: string;
    screenResolution: string;
    language: string;
  };
}

/**
 * Device Challenge Response
 */
interface DeviceChallengeResponse {
  trusted: boolean;
  requiresConfirmation?: boolean;
  requiresVerification?: boolean;
  deviceId?: string; // Return device_id for client to restore to localStorage
  sessionToken?: string; // Short-lived token for grace period
  suggestedDevice?: any; // For confirmation modal
  confidence: 'high' | 'medium' | 'low';
  score: number;
  matchDetails?: {
    deviceIdMatch: boolean;
    fingerprintSimilarity: number;
    ipMatch: boolean;
    browserMatch: boolean;
    osMatch: boolean;
    timezoneMatch: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: Max 20 attempts per IP per 15 minutes
    const clientIP = getClientIP(request.headers);
    const rateLimit = checkRateLimit(`device-challenge:${clientIP}`, 20, 15 * 60 * 1000);
    
    if (!rateLimit.allowed) {
      logger.warn(`⚠️ [DeviceChallenge] Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json(
        { 
          error: 'Too many attempts',
          message: `Please try again in ${Math.ceil(rateLimit.resetIn / 60)} minutes`,
        },
        { status: 429 }
      );
    }
    
    const body: DeviceChallengeRequest = await request.json();
    const { userId, challenge } = body;
    
    if (!userId || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    logger.log('🔍 [DeviceChallenge] Starting device scoring...');
    logger.log(`👤 User: ${userId.substring(0, 8)}...`);
    logger.log(`📱 Device ID: ${challenge.deviceId ? challenge.deviceId.substring(0, 12) + '...' : 'null (localStorage cleared)'}`);
    logger.log(`🔢 Fingerprint: ${challenge.fingerprint.substring(0, 12)}...`);
    
    // =========================================================================
    // STEP 1: GET ALL TRUSTED DEVICES FOR USER
    // =========================================================================
    
    const { data: trustedDevices, error: devicesError } = await supabaseAdmin
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .not('verified_at', 'is', null); // Only verified devices
    
    if (devicesError) {
      logger.error('❌ [DeviceChallenge] Database error:', devicesError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
    
    if (!trustedDevices || trustedDevices.length === 0) {
      logger.log('❌ [DeviceChallenge] No trusted devices found for user');
      return NextResponse.json({
        trusted: false,
        requiresVerification: true,
        confidence: 'low',
        score: 0,
      });
    }
    
    logger.log(`✅ [DeviceChallenge] Found ${trustedDevices.length} trusted device(s)`);
    
    // =========================================================================
    // STEP 2: SCORE EACH DEVICE
    // =========================================================================
    
    let bestMatch: any = null;
    let bestScore = 0;
    let bestMatchDetails: any = null;
    
    for (const device of trustedDevices) {
      let score = 0;
      const matchDetails = {
        deviceIdMatch: false,
        fingerprintSimilarity: 0,
        ipMatch: false,
        browserMatch: false,
        osMatch: false,
        timezoneMatch: false,
      };
      
      logger.log(`\n📊 Scoring device: ${device.device_name}`);
      
      // =====================================================================
      // LAYER 1: DEVICE ID MATCH (100 points) - PRIMARY IDENTIFIER
      // =====================================================================
      
      if (challenge.deviceId && device.device_id === challenge.deviceId) {
        score = 100; // Instant trust!
        matchDetails.deviceIdMatch = true;
        logger.log(`  ✅ Device ID EXACT match! (+100 points) → INSTANT TRUST`);
      } else {
        // No device_id match - continue with other signals
        
        // =================================================================
        // LAYER 2: FINGERPRINT SIMILARITY (0-50 points)
        // =================================================================
        
        if (device.device_fingerprint === challenge.fingerprint) {
          // Exact fingerprint match
          score += 50;
          matchDetails.fingerprintSimilarity = 1.0;
          logger.log(`  ✅ Fingerprint EXACT match (+50 points)`);
        } else {
          // Fuzzy fingerprint match
          const fpSimilarity = calculateStringSimilarity(
            device.device_fingerprint,
            challenge.fingerprint
          );
          const fpScore = Math.floor(fpSimilarity * 50);
          score += fpScore;
          matchDetails.fingerprintSimilarity = fpSimilarity;
          logger.log(`  📊 Fingerprint similarity: ${(fpSimilarity * 100).toFixed(1)}% (+${fpScore} points)`);
        }
        
        // =================================================================
        // LAYER 3: IP ADDRESS MATCH (0-20 points)
        // =================================================================
        
        if (device.ip_address === challenge.ipAddress) {
          score += 20;
          matchDetails.ipMatch = true;
          logger.log(`  ✅ IP exact match (+20 points)`);
        } else {
          // Check country/city match (geolocation)
          const deviceLocation = device.device_metadata?.location;
          if (deviceLocation) {
            // Note: challenge doesn't have location yet - we'd need to add geo-IP lookup
            // For now, partial credit if IP prefix matches (same ISP/region)
            const deviceIPPrefix = device.ip_address?.split('.').slice(0, 2).join('.');
            const challengeIPPrefix = challenge.ipAddress.split('.').slice(0, 2).join('.');
            if (deviceIPPrefix === challengeIPPrefix) {
              score += 10;
              logger.log(`  ✅ IP prefix match (+10 points)`);
            }
          }
        }
        
        // =================================================================
        // LAYER 4: BROWSER MATCH (0-10 points)
        // =================================================================
        
        const deviceBrowser = device.browser_version 
          ? `${device.browser} ${device.browser_version}`
          : device.browser;
        const challengeBrowser = `${challenge.browser} ${challenge.browserVersion}`;
        
        if (deviceBrowser === challengeBrowser) {
          score += 10;
          matchDetails.browserMatch = true;
          logger.log(`  ✅ Browser exact match (+10 points)`);
        } else if (device.browser === challenge.browser) {
          score += 5;
          logger.log(`  ✅ Same browser, different version (+5 points)`);
        }
        
        // =================================================================
        // LAYER 5: OS MATCH (0-10 points)
        // =================================================================
        
        const deviceOS = device.os_version 
          ? `${device.os} ${device.os_version}`
          : device.os;
        const challengeOS = `${challenge.os} ${challenge.osVersion}`;
        
        if (deviceOS === challengeOS) {
          score += 10;
          matchDetails.osMatch = true;
          logger.log(`  ✅ OS exact match (+10 points)`);
        } else if (device.os === challenge.os) {
          score += 5;
          logger.log(`  ✅ Same OS, different version (+5 points)`);
        }
        
        // =================================================================
        // LAYER 6: TIMEZONE MATCH (0-5 points)
        // =================================================================
        
        if (device.device_metadata?.timezone === challenge.timezone) {
          score += 5;
          matchDetails.timezoneMatch = true;
          logger.log(`  ✅ Timezone match (+5 points)`);
        }
        
        // =================================================================
        // LAYER 7: SCREEN RESOLUTION MATCH (0-5 points)
        // =================================================================
        
        if (device.device_metadata?.screenResolution === challenge.screenResolution) {
          score += 5;
          logger.log(`  ✅ Screen resolution match (+5 points)`);
        }
        
        // =================================================================
        // LAYER 8: LANGUAGE MATCH (0-3 points)
        // =================================================================
        
        if (device.device_metadata?.language === challenge.language) {
          score += 3;
          logger.log(`  ✅ Language match (+3 points)`);
        }
        
        // =================================================================
        // LAYER 9: RECENTLY USED BONUS (0-10 points)
        // =================================================================
        
        const daysSinceUse = (Date.now() - new Date(device.last_used_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUse < 7) {
          score += 10;
          logger.log(`  ✅ Used recently (${daysSinceUse.toFixed(1)} days ago) (+10 points)`);
        } else if (daysSinceUse < 30) {
          score += 5;
          logger.log(`  ✅ Used this month (+5 points)`);
        }
      }
      
      logger.log(`  📊 TOTAL SCORE: ${score}/100`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = device;
        bestMatchDetails = matchDetails;
      }
    }
    
    // =========================================================================
    // STEP 3: DETERMINE CONFIDENCE LEVEL & ACTION
    // =========================================================================
    
    logger.log(`\n🎯 BEST MATCH: ${bestMatch.device_name} with score ${bestScore}/100`);
    
    let response: DeviceChallengeResponse;
    
    if (bestScore >= 60) {
      // ✅ HIGH CONFIDENCE - Auto-trust
      logger.log(`✅ HIGH CONFIDENCE (${bestScore}/100) → AUTO-TRUST`);
      
      // Generate session token for grace period
      const sessionToken = crypto.randomBytes(32).toString('hex');
      
      // Update device: last_used_at, session_token
      await supabaseAdmin
        .from('trusted_devices')
        .update({ 
          last_used_at: new Date().toISOString(),
          session_token: sessionToken,
          last_verified_session_at: new Date().toISOString(),
          // Update fingerprint if it changed (device evolved)
          device_fingerprint: challenge.fingerprint,
          // Update IP address
          ip_address: challenge.ipAddress,
        })
        .eq('id', bestMatch.id);
      
      logger.log(`✅ Device updated (fingerprint + IP refreshed)`);
      
      response = {
        trusted: true,
        deviceId: bestMatch.device_id, // Return for localStorage restore
        sessionToken: sessionToken,
        confidence: 'high',
        score: bestScore,
        matchDetails: bestMatchDetails,
      };
      
    } else if (bestScore >= 40) {
      // ⚠️ MEDIUM CONFIDENCE - Ask user confirmation
      logger.log(`⚠️ MEDIUM CONFIDENCE (${bestScore}/100) → USER CONFIRMATION NEEDED`);
      
      response = {
        trusted: false,
        requiresConfirmation: true,
        suggestedDevice: {
          id: bestMatch.id,
          deviceId: bestMatch.device_id,
          deviceName: bestMatch.device_name,
          lastUsedAt: bestMatch.last_used_at,
          location: bestMatch.device_metadata?.location,
          browser: bestMatch.browser,
          os: bestMatch.os,
        },
        confidence: 'medium',
        score: bestScore,
        matchDetails: bestMatchDetails,
      };
      
    } else {
      // ❌ LOW CONFIDENCE - Email verification required
      logger.log(`❌ LOW CONFIDENCE (${bestScore}/100) → EMAIL VERIFICATION REQUIRED`);
      
      response = {
        trusted: false,
        requiresVerification: true,
        confidence: 'low',
        score: bestScore,
      };
    }
    
    logger.log(`✅ [DeviceChallenge] Response: ${JSON.stringify(response, null, 2)}`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    logger.error('❌ [DeviceChallenge] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

