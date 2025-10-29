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
export const runtime = 'edge'; // Use edge runtime for better performance

/**
 * Fetch Jupiter token list with retry logic
 */
async function fetchJupiterTokensWithRetry(maxRetries = 3): Promise<any[]> {
  const urls = [
    'https://token.jup.ag/all', // Primary: Full list endpoint
    'https://tokens.jup.ag/tokens', // Fallback 1: Original endpoint
    'https://cache.jup.ag/tokens', // Fallback 2: Cache endpoint
  ];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const url of urls) {
      try {
        console.log(`🪐 [API] Attempt ${attempt + 1}/${maxRetries}, trying: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'BlazeWallet/2.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`⚠️ [API] ${url} returned ${response.status}`);
          continue; // Try next URL
        }

        const tokens = await response.json();
        
        // Validate response
        if (!Array.isArray(tokens) || tokens.length === 0) {
          console.warn(`⚠️ [API] Invalid response from ${url}:`, tokens);
          continue; // Try next URL
        }

        console.log(`✅ [API] Successfully fetched ${tokens.length} tokens from ${url}`);
        return tokens;

      } catch (error: any) {
        console.error(`❌ [API] Error fetching from ${url}:`, error.message);
        // Continue to next URL
      }
    }

    // Wait before retrying all URLs
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`⏳ [API] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('All Jupiter API endpoints failed after retries');
}

export async function GET(request: NextRequest) {
  try {
    console.log('🪐 [API] Fetching Jupiter token list...');
    
    const tokens = await fetchJupiterTokensWithRetry();

    // Return with CORS headers for client access
    return NextResponse.json(tokens, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('❌ [API] All attempts failed:', error);
    
    // Return empty array with 200 status for graceful degradation
    // Client will handle empty array by using fallback
    return NextResponse.json([], {
      status: 200, // ✅ Return 200 with empty array, not 500
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

