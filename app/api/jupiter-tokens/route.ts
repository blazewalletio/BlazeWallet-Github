import { NextRequest, NextResponse } from 'next/server';

/**
 * Jupiter Token List API Proxy
 * 
 * Proxies requests to Jupiter's token list API to avoid CORS/DNS issues
 * Fetches ALL tokens (not just verified) for comprehensive metadata coverage
 * 
 * Cache: 1 hour (token metadata doesn't change frequently)
 */
export const revalidate = 3600; // 1 hour cache

export async function GET(request: NextRequest) {
  try {
    console.log('🪐 [API] Fetching Jupiter token list...');
    
    // Fetch ALL tokens from Jupiter (no ?tags=verified filter)
    const response = await fetch('https://tokens.jup.ag/tokens', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BlazeWallet/2.0',
      },
      // Server-side fetch with 30s timeout
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Jupiter API returned ${response.status}: ${response.statusText}`);
    }

    const tokens = await response.json();
    
    console.log(`✅ [API] Jupiter token list fetched: ${tokens.length} tokens`);

    // Return with CORS headers for client access
    return NextResponse.json(tokens, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('❌ [API] Error fetching Jupiter token list:', error);
    
    // Return empty array on error (graceful degradation)
    return NextResponse.json(
      { 
        error: 'Failed to fetch Jupiter token list',
        message: error.message,
        tokens: [] // Empty array for fallback
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

