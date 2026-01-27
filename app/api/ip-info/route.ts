import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * IP Information & Geolocation API
 * Provides country, city, lat/long, and security flags
 */
export async function GET(request: NextRequest) {
  try {
    // Get client IP from headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwarded?.split(',')[0] || realIp || 'unknown';
    
    logger.log(`🌍 IP info requested for: ${clientIp}`);
    
    // For localhost/development, return mock data
    if (clientIp === 'unknown' || clientIp.includes('127.0.0.1') || clientIp.includes('::1')) {
      logger.log('🏠 Localhost detected - returning mock geolocation data');
      return NextResponse.json({
        ip: clientIp,
        country: 'Netherlands',
        city: 'Amsterdam',
        latitude: 52.3676,
        longitude: 4.9041,
        isTor: false,
        isVPN: false,
        blacklisted: false,
        hostname: 'localhost',
      });
    }
    
    // Use ipapi.co for geolocation (free tier: 1000 requests/day)
    // Alternative: ip-api.com (free, no key needed)
    try {
      // Using ip-api.com (completely free, 45 req/min)
      const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,message,country,city,lat,lon,isp,proxy,hosting`, {
        headers: {
          'User-Agent': 'BLAZE-Wallet/1.0',
        },
      });
      
      if (!geoResponse.ok) {
        throw new Error(`Geolocation API returned ${geoResponse.status}`);
      }
      
      const geoData = await geoResponse.json();
      
      if (geoData.status === 'fail') {
        throw new Error(geoData.message || 'Geolocation failed');
      }
      
      logger.log(`✅ Geolocation success: ${geoData.city}, ${geoData.country}`);
      
      // Basic VPN/Proxy detection
      const isVPN = geoData.proxy === true || geoData.hosting === true;
      const isTor = geoData.isp?.toLowerCase().includes('tor') || false;
      
      // Check if IP is in known blacklists (basic check)
      const blacklisted = false; // Placeholder - would need dedicated service
      
      return NextResponse.json({
        ip: clientIp,
        country: geoData.country || 'Unknown',
        city: geoData.city || 'Unknown',
        latitude: geoData.lat || 0,
        longitude: geoData.lon || 0,
        isTor,
        isVPN,
        blacklisted,
        hostname: geoData.isp || 'Unknown',
      });
      
    } catch (apiError: any) {
      logger.error('❌ Geolocation API error:', apiError.message);
      
      // Fallback to minimal data
      return NextResponse.json({
        ip: clientIp,
        country: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        isTor: false,
        isVPN: false,
        blacklisted: false,
        hostname: 'Unknown',
      });
    }
    
  } catch (error: any) {
    logger.error('❌ IP info error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get IP information',
        ip: 'unknown',
        country: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
        isTor: false,
        isVPN: false,
        blacklisted: false,
      },
      { status: 500 }
    );
  }
}

