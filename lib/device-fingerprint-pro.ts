/**
 * Enhanced Device Fingerprinting with Risk Analysis
 * Fort Knox Security Level
 * V2: Added persistent localStorage caching (24h TTL)
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { logger } from './logger';

// Persistent cache keys
const FINGERPRINT_CACHE_KEY = 'blaze_device_fingerprint';
const FINGERPRINT_CACHE_TIME_KEY = 'blaze_fingerprint_cached_at';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
  hardwareConcurrency: number;
  deviceMemory?: number;
  connection: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
  touchSupport: boolean;
  vendor: string;
  isIncognito: boolean;
  isTor: boolean;
  isVPN: boolean;
  riskScore: number;
}

/**
 * Get cached fingerprint or generate fresh one
 * Caches in localStorage for 24 hours (persistent across app restarts)
 */
export async function getCachedOrGenerateFingerprint(): Promise<{
  fingerprint: string;
  isFromCache: boolean;
  previousFingerprint?: string;
}> {
  if (typeof window === 'undefined') {
    throw new Error('Fingerprint generation only works in browser');
  }
  
  // Check localStorage cache (24h TTL)
  const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY);
  const cachedAt = localStorage.getItem(FINGERPRINT_CACHE_TIME_KEY);
  
  const now = Date.now();
  
  if (cached && cachedAt) {
    const age = now - parseInt(cachedAt, 10);
    const ageMinutes = Math.floor(age / 1000 / 60);
    
    if (age < CACHE_TTL) {
      logger.log(`✅ [Fingerprint] Using cached (age: ${ageMinutes} min)`);
      return { fingerprint: cached, isFromCache: true };
    } else {
      logger.log(`⏰ [Fingerprint] Cache expired (age: ${ageMinutes} min), regenerating...`);
    }
  }
  
  // Generate fresh fingerprint
  logger.log('🔄 [Fingerprint] Generating fresh fingerprint...');
  const deviceInfo = await generateEnhancedFingerprint();
  const newFingerprint = deviceInfo.fingerprint;
  
  // Save to localStorage cache
  localStorage.setItem(FINGERPRINT_CACHE_KEY, newFingerprint);
  localStorage.setItem(FINGERPRINT_CACHE_TIME_KEY, now.toString());
  
  logger.log('✅ [Fingerprint] Fresh fingerprint cached');
  
  return {
    fingerprint: newFingerprint,
    isFromCache: false,
    previousFingerprint: cached || undefined,
  };
}

/**
 * Clear fingerprint cache (for testing or security)
 */
export function clearFingerprintCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(FINGERPRINT_CACHE_KEY);
  localStorage.removeItem(FINGERPRINT_CACHE_TIME_KEY);
  logger.log('🗑️ [Fingerprint] Cache cleared');
}

/**
 * Generate enhanced device fingerprint with security analysis
 */
export async function generateEnhancedFingerprint(): Promise<EnhancedDeviceInfo> {
  try {
    logger.log('🔍 Generating enhanced device fingerprint...');
    
    // Load FingerprintJS
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    
    logger.log('✅ FingerprintJS loaded, visitor ID:', result.visitorId.substring(0, 8) + '...');
    
    // Get IP and geolocation data
    let ipData: any = {
      ip: 'unknown',
      country: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      isTor: false,
      isVPN: false,
      blacklisted: false,
    };
    
    try {
      const ipResponse = await fetch('/api/ip-info');
      if (ipResponse.ok) {
        ipData = await ipResponse.json();
        logger.log('✅ IP info retrieved:', ipData.country, ipData.city);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to get IP info, using defaults');
    }
    
    // Get detailed device name
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
        const versionMap: Record<string, string> = {
          '10.0': '10/11',
          '6.3': '8.1',
          '6.2': '8',
          '6.1': '7',
        };
        const version = match ? (versionMap[match[1]] || match[1]) : 'Unknown';
        return `Windows PC (${version})`;
      }
      
      if (/Linux/.test(ua)) return 'Linux PC';
      
      return 'Unknown Device';
    };
    
    // Browser detection
    const getBrowser = (): { name: string; version: string } => {
      const ua = navigator.userAgent;
      
      // Chrome
      if (ua.includes('Chrome') && !ua.includes('Edg')) {
        const match = ua.match(/Chrome\/(\d+)/);
        return { name: 'Chrome', version: match ? match[1] : 'Unknown' };
      }
      
      // Safari
      if (ua.includes('Safari') && !ua.includes('Chrome')) {
        const match = ua.match(/Version\/(\d+)/);
        return { name: 'Safari', version: match ? match[1] : 'Unknown' };
      }
      
      // Firefox
      if (ua.includes('Firefox')) {
        const match = ua.match(/Firefox\/(\d+)/);
        return { name: 'Firefox', version: match ? match[1] : 'Unknown' };
      }
      
      // Edge
      if (ua.includes('Edg')) {
        const match = ua.match(/Edg\/(\d+)/);
        return { name: 'Edge', version: match ? match[1] : 'Unknown' };
      }
      
      return { name: 'Unknown', version: 'Unknown' };
    };
    
    // OS detection
    const getOS = (): { name: string; version: string } => {
      const ua = navigator.userAgent;
      
      if (ua.includes('Mac OS X')) {
        const match = ua.match(/Mac OS X (\d+[._]\d+)/);
        const version = match ? match[1].replace('_', '.') : 'Unknown';
        return { name: 'macOS', version };
      }
      
      if (ua.includes('Windows NT')) {
        const match = ua.match(/Windows NT (\d+\.\d+)/);
        return { name: 'Windows', version: match ? match[1] : 'Unknown' };
      }
      
      if (ua.includes('Linux')) {
        return { name: 'Linux', version: 'Unknown' };
      }
      
      if (ua.includes('iOS') || /iPhone|iPad/.test(ua)) {
        const match = ua.match(/OS (\d+_\d+)/);
        const version = match ? match[1].replace('_', '.') : 'Unknown';
        return { name: 'iOS', version };
      }
      
      if (ua.includes('Android')) {
        const match = ua.match(/Android (\d+\.?\d*)/);
        return { name: 'Android', version: match ? match[1] : 'Unknown' };
      }
      
      return { name: 'Unknown', version: 'Unknown' };
    };
    
    // Incognito detection (basic)
    const detectIncognito = (): boolean => {
      // Basic heuristics - not 100% accurate
      return false; // Placeholder - would need more sophisticated detection
    };
    
    // TOR detection
    const detectTor = (): boolean => {
      return ipData.isTor || 
             navigator.userAgent.includes('Tor') ||
             ipData.hostname?.includes('.onion') ||
             false;
    };
    
    // VPN detection
    const detectVPN = (): boolean => {
      return ipData.isVPN || false;
    };
    
    // Connection info
    const getConnection = () => {
      const conn = (navigator as any).connection || 
                   (navigator as any).mozConnection || 
                   (navigator as any).webkitConnection;
      return {
        effectiveType: conn?.effectiveType || 'unknown',
        downlink: conn?.downlink || 0,
        rtt: conn?.rtt || 0,
      };
    };
    
    const isIncognito = detectIncognito();
    const isTor = detectTor();
    const isVPN = detectVPN();
    const browser = getBrowser();
    const os = getOS();
    
    // Calculate comprehensive risk score
    const calculateRiskScore = (): number => {
      let score = 0;
      
      // TOR is highest risk
      if (isTor) {
        score += 40;
        logger.warn('⚠️ TOR detected - High risk (+40)');
      }
      
      // VPN is moderate risk
      if (isVPN) {
        score += 20;
        logger.warn('⚠️ VPN detected - Moderate risk (+20)');
      }
      
      // Incognito mode
      if (isIncognito) {
        score += 10;
        logger.log('🔍 Incognito detected (+10)');
      }
      
      // Blacklisted IP
      if (ipData.blacklisted) {
        score += 30;
        logger.warn('🚨 Blacklisted IP detected - High risk (+30)');
      }
      
      // Unusual hours (2am - 6am local time)
      const hour = new Date().getHours();
      if (hour >= 2 && hour < 6) {
        score += 10;
        logger.log('🌙 Unusual login hour (+10)');
      }
      
      // Mobile device without touch support (suspicious)
      if (/Mobile|Android|iOS/.test(navigator.userAgent) && !('ontouchstart' in window)) {
        score += 15;
        logger.warn('⚠️ Mobile device without touch support (+15)');
      }
      
      // Unknown browser/OS
      if (browser.name === 'Unknown' || os.name === 'Unknown') {
        score += 10;
        logger.warn('⚠️ Unknown browser/OS (+10)');
      }
      
      const finalScore = Math.min(score, 100);
      logger.log(`📊 Final risk score: ${finalScore}/100`);
      
      return finalScore;
    };
    
    const deviceInfo: EnhancedDeviceInfo = {
      fingerprint: result.visitorId,
      deviceName: getDetailedDeviceName(),
      browser: browser.name,
      browserVersion: browser.version,
      os: os.name,
      osVersion: os.version,
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
      languages: Array.from(navigator.languages || [navigator.language]),
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      connection: getConnection(),
      touchSupport: 'ontouchstart' in window,
      vendor: navigator.vendor,
      isIncognito,
      isTor,
      isVPN,
      riskScore: calculateRiskScore(),
    };
    
    logger.log('✅ Enhanced fingerprint generated:', {
      fingerprint: deviceInfo.fingerprint.substring(0, 8) + '...',
      device: deviceInfo.deviceName,
      risk: deviceInfo.riskScore,
    });
    
    return deviceInfo;
    
  } catch (error) {
    logger.error('❌ Failed to generate fingerprint:', error);
    
    // Fallback: basic device info
    return {
      fingerprint: 'fallback-' + Date.now(),
      deviceName: 'Unknown Device',
      browser: 'Unknown',
      browserVersion: 'Unknown',
      os: 'Unknown',
      osVersion: 'Unknown',
      userAgent: navigator.userAgent,
      ipAddress: 'unknown',
      location: {
        country: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: [navigator.language],
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: undefined,
      connection: {
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
      },
      touchSupport: 'ontouchstart' in window,
      vendor: navigator.vendor,
      isIncognito: false,
      isTor: false,
      isVPN: false,
      riskScore: 0,
    };
  }
}

/**
 * Format device info for display
 */
export function formatDeviceInfo(device: EnhancedDeviceInfo): string {
  return `${device.deviceName} • ${device.browser} ${device.browserVersion} • ${device.location.city}, ${device.location.country}`;
}

/**
 * Get risk level description
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Get risk level color
 */
export function getRiskColor(score: number): string {
  const level = getRiskLevel(score);
  const colors = {
    low: '#10b981', // green
    medium: '#f59e0b', // yellow
    high: '#ef4444', // red
    critical: '#7f1d1d', // dark red
  };
  return colors[level];
}

