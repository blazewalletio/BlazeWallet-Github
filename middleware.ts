/**
 * 🔒 BLAZE WALLET - SECURITY MIDDLEWARE
 * 
 * Implements:
 * - CSRF Protection for POST/PUT/DELETE requests
 * - Request validation
 * 
 * Applied to all /api/* routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.next();
  }
  
  // Skip CSRF for cron jobs (they use different auth)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }
  
  // Skip CSRF for public endpoints that don't need it
  const publicEndpoints = [
    '/api/prices',
    '/api/prices-binance',
    '/api/prices-by-address',
    '/api/jupiter-tokens',
    '/api/ai-portfolio-analysis',
    '/api/ai-transaction',
    '/api/ai-assistant',
    '/api/ai-risk-scanner',
    '/api/gas-optimizer',
    '/api/send-welcome-email', // Email sending endpoint
    '/api/send-device-code', // Device verification code email (called server-to-server)
    '/api/auth/verify-email', // Email verification endpoint
    '/api/auth/check-email', // Check if email exists (used before signup)
    '/api/2fa', // 2FA setup/verification
    '/api/verify-device', // Device verification
    '/api/device-verification', // Device verification (uses Bearer token auth instead of CSRF)
    '/api/device-verification-code', // Device verification email sending
    '/api/verify-device-code', // Device verification code validation
    '/api/security-alert', // Security alert emails
    '/api/export-csv', // Transaction export (has auth check)
    '/api/history/logos', // History logo resolution (CoinGecko Pro, no user state)
    '/api/onramper', // Onramper endpoints (quotes, create-transaction, supported-data, checkout-intent)
    '/api/moonpay', // MoonPay endpoints
    '/api/ramp', // Ramp Network endpoints
    '/api/debug-log', // Debug logging (non-critical, should always work)
  ];
  
  // Check if pathname starts with any public endpoint
  const isPublicEndpoint = publicEndpoints.some(ep => pathname.startsWith(ep));
  
  if (isPublicEndpoint) {
    // Log for debugging (only in development or for specific routes)
    if (pathname.includes('checkout-intent')) {
      console.log('✅ Middleware: Allowing checkout-intent endpoint:', pathname, 'Method:', request.method);
    }
    return NextResponse.next();
  }
  
  // Get CSRF token from cookie
  const csrfCookie = request.cookies.get('csrf_token');
  const csrfHeader = request.headers.get('x-csrf-token');
  
  // Verify CSRF token
  if (!csrfCookie || !csrfHeader || csrfCookie.value !== csrfHeader) {
    console.warn('🚫 CSRF token mismatch:', {
      pathname,
      method: request.method,
      hasCookie: !!csrfCookie,
      hasHeader: !!csrfHeader,
      match: csrfCookie?.value === csrfHeader,
    });
    
    return NextResponse.json(
      { 
        error: 'Invalid CSRF token',
        message: 'Security check failed. Please refresh the page and try again.',
      },
      { status: 403 }
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

