/**
 * Device Matcher
 * Smart heuristic matching for device identification
 * Uses multi-signal scoring when device_id or fingerprint not found
 */

import { supabase } from './supabase';
import { EnhancedDeviceInfo } from './device-fingerprint-pro';
import { logger } from './logger';

interface TrustedDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  browser: string;
  browser_version?: string;
  os: string;
  os_version?: string;
  verified_at: string | null;
  last_used_at: string;
  device_metadata?: {
    screenResolution?: string;
    timezone?: string;
    location?: {
      country: string;
      city: string;
    };
  };
}

export interface DeviceMatchResult {
  device: TrustedDevice | null;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  canAutoRecover: boolean;
  matchDetails?: {
    fingerprintSimilarity: number;
    ipMatch: boolean;
    browserMatch: boolean;
    osMatch: boolean;
    locationMatch: boolean;
    recentlyUsed: boolean;
  };
}

/**
 * Find best matching device for user using heuristic scoring
 */
export async function findBestDeviceMatch(
  userId: string,
  currentFingerprint: string,
  currentDeviceInfo: EnhancedDeviceInfo
): Promise<DeviceMatchResult> {
  try {
    logger.log('🧠 [DeviceMatcher] Starting smart matching for user:', userId.substring(0, 8) + '...');
    
    // Get all verified devices for this user
    const { data: devices, error } = await supabase
      .from('trusted_devices')
      .select('*')
      .eq('user_id', userId)
      .not('verified_at', 'is', null);
    
    if (error) {
      logger.error('❌ [DeviceMatcher] Database error:', error);
      return {
        device: null,
        score: 0,
        confidence: 'low',
        canAutoRecover: false,
      };
    }
    
    if (!devices || devices.length === 0) {
      logger.log('ℹ️ [DeviceMatcher] No trusted devices found for user');
      return {
        device: null,
        score: 0,
        confidence: 'low',
        canAutoRecover: false,
      };
    }
    
    logger.log(`🔍 [DeviceMatcher] Analyzing ${devices.length} trusted device(s)...`);
    
    let bestMatch: TrustedDevice | null = null;
    let bestScore = 0;
    let bestMatchDetails: DeviceMatchResult['matchDetails'] | undefined;
    
    for (const device of devices) {
      let score = 0;
      const matchDetails: Required<DeviceMatchResult>['matchDetails'] = {
        fingerprintSimilarity: 0,
        ipMatch: false,
        browserMatch: false,
        osMatch: false,
        locationMatch: false,
        recentlyUsed: false,
      };
      
      // =====================================================================
      // 1. FINGERPRINT MATCHING (0-100 points)
      // =====================================================================
      
      if (device.device_fingerprint === currentFingerprint) {
        // Exact match
        score += 100;
        matchDetails.fingerprintSimilarity = 1.0;
        logger.log(`  Device ${device.device_name}: Fingerprint EXACT match (+100)`);
      } else {
        // Fuzzy match (Levenshtein similarity)
        const similarity = calculateStringSimilarity(
          device.device_fingerprint,
          currentFingerprint
        );
        const fpScore = Math.floor(similarity * 90);
        score += fpScore;
        matchDetails.fingerprintSimilarity = similarity;
        logger.log(`  Device ${device.device_name}: Fingerprint similarity ${(similarity * 100).toFixed(1)}% (+${fpScore})`);
      }
      
      // =====================================================================
      // 2. IP ADDRESS MATCHING (0-20 points)
      // =====================================================================
      
      if (device.ip_address === currentDeviceInfo.ipAddress) {
        score += 20;
        matchDetails.ipMatch = true;
        logger.log(`  Device ${device.device_name}: IP exact match (+20)`);
      } else {
        // Check country match (less strict)
        const deviceCountry = device.device_metadata?.location?.country;
        if (deviceCountry && deviceCountry === currentDeviceInfo.location.country) {
          score += 10;
          matchDetails.locationMatch = true;
          logger.log(`  Device ${device.device_name}: Same country (+10)`);
        }
      }
      
      // =====================================================================
      // 3. BROWSER MATCHING (0-15 points)
      // =====================================================================
      
      const deviceBrowser = device.browser_version 
        ? `${device.browser} ${device.browser_version}`
        : device.browser;
      const currentBrowser = `${currentDeviceInfo.browser} ${currentDeviceInfo.browserVersion}`;
      
      if (deviceBrowser === currentBrowser) {
        score += 15;
        matchDetails.browserMatch = true;
        logger.log(`  Device ${device.device_name}: Browser exact match (+15)`);
      } else if (device.browser === currentDeviceInfo.browser) {
        // Same browser, different version
        score += 8;
        logger.log(`  Device ${device.device_name}: Same browser (+8)`);
      }
      
      // =====================================================================
      // 4. OS MATCHING (0-15 points)
      // =====================================================================
      
      const deviceOS = device.os_version 
        ? `${device.os} ${device.os_version}`
        : device.os;
      const currentOS = `${currentDeviceInfo.os} ${currentDeviceInfo.osVersion}`;
      
      if (deviceOS === currentOS) {
        score += 15;
        matchDetails.osMatch = true;
        logger.log(`  Device ${device.device_name}: OS exact match (+15)`);
      } else if (device.os === currentDeviceInfo.os) {
        // Same OS, different version
        score += 8;
        logger.log(`  Device ${device.device_name}: Same OS (+8)`);
      }
      
      // =====================================================================
      // 5. SCREEN RESOLUTION (0-10 points)
      // =====================================================================
      
      if (device.device_metadata?.screenResolution === currentDeviceInfo.screenResolution) {
        score += 10;
        logger.log(`  Device ${device.device_name}: Screen resolution match (+10)`);
      }
      
      // =====================================================================
      // 6. TIMEZONE (0-5 points)
      // =====================================================================
      
      if (device.device_metadata?.timezone === currentDeviceInfo.timezone) {
        score += 5;
        logger.log(`  Device ${device.device_name}: Timezone match (+5)`);
      }
      
      // =====================================================================
      // 7. RECENTLY USED (0-10 points)
      // =====================================================================
      
      const daysSinceUse = (Date.now() - new Date(device.last_used_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse < 7) {
        score += 10;
        matchDetails.recentlyUsed = true;
        logger.log(`  Device ${device.device_name}: Used ${daysSinceUse.toFixed(1)} days ago (+10)`);
      } else if (daysSinceUse < 30) {
        score += 5;
        logger.log(`  Device ${device.device_name}: Used ${daysSinceUse.toFixed(1)} days ago (+5)`);
      }
      
      // =====================================================================
      // TOTAL SCORE
      // =====================================================================
      
      logger.log(`  Device ${device.device_name}: TOTAL SCORE = ${score}/170`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = device;
        bestMatchDetails = matchDetails;
      }
    }
    
    // =========================================================================
    // DETERMINE CONFIDENCE LEVEL
    // =========================================================================
    
    let confidence: 'high' | 'medium' | 'low';
    let canAutoRecover = false;
    
    if (bestScore >= 120) {
      confidence = 'high';
      canAutoRecover = true; // ✅ AUTO-RECOVER DEVICE ID!
      logger.log(`✅ [DeviceMatcher] HIGH CONFIDENCE match (${bestScore}/170) - AUTO-RECOVERY ENABLED`);
    } else if (bestScore >= 80) {
      confidence = 'medium';
      canAutoRecover = false; // User confirmation needed
      logger.log(`⚠️ [DeviceMatcher] MEDIUM CONFIDENCE match (${bestScore}/170) - USER CONFIRMATION NEEDED`);
    } else {
      confidence = 'low';
      canAutoRecover = false; // Full verification needed
      logger.log(`❌ [DeviceMatcher] LOW CONFIDENCE match (${bestScore}/170) - FULL VERIFICATION REQUIRED`);
    }
    
    return {
      device: bestMatch,
      score: bestScore,
      confidence,
      canAutoRecover,
      matchDetails: bestMatchDetails,
    };
    
  } catch (error: any) {
    logger.error('❌ [DeviceMatcher] Unexpected error:', error);
    return {
      device: null,
      score: 0,
      confidence: 'low',
      canAutoRecover: false,
    };
  }
}

/**
 * Calculate string similarity (Levenshtein-based)
 * Returns: 0.0 (completely different) to 1.0 (identical)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
