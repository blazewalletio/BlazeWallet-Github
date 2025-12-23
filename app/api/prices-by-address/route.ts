import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering (required for API routes with query params)
export const dynamic = 'force-dynamic';

// Map chain names to CoinGecko platform IDs
const CHAIN_TO_PLATFORM: Record<string, string> = {
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  bsc: 'binance-smart-chain',
};

/**
 * Get ERC20 token prices by contract address via CoinGecko
 * This is MORE RELIABLE than symbol-based lookup!
 * 
 * Query params:
 * - addresses: comma-separated contract addresses
 * - chain: ethereum, polygon, arbitrum, base, bsc
 * 
 * Example: /api/prices-by-address?addresses=0x808...&chain=ethereum
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const addressesParam = searchParams.get('addresses');
    const chain = searchParams.get('chain') || 'ethereum';

    if (!addressesParam) {
      return NextResponse.json(
        { error: 'Missing addresses parameter' },
        { status: 400 }
      );
    }

    // Parse addresses (comma-separated)
    const addresses = addressesParam.split(',').map(addr => addr.trim().toLowerCase());

    if (addresses.length === 0) {
      return NextResponse.json(
        { error: 'No addresses provided' },
        { status: 400 }
      );
    }

    // Get CoinGecko platform ID
    const platform = CHAIN_TO_PLATFORM[chain] || 'ethereum';

    // CoinGecko API endpoint for token prices by contract address
    // Use URL encoding to ensure addresses are properly formatted
    const addressesParam = addresses.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(addressesParam)}&vs_currencies=usd&include_24hr_change=true`;

    logger.log(`📡 [Prices by Address] Fetching from CoinGecko for ${addresses.length} addresses on ${chain}`);
    logger.log(`📡 [Prices by Address] Platform: ${platform}`);
    logger.log(`📡 [Prices by Address] Addresses: ${addresses.map(a => a.substring(0, 10) + '...').join(', ')}`);
    logger.log(`📡 [Prices by Address] URL: ${url.substring(0, 200)}...`);

    // Create timeout manually (AbortSignal.timeout may not be available in all Node.js versions)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error(`❌ [Prices by Address] CoinGecko error: ${response.status} - ${errorText.substring(0, 200)}`);
        return NextResponse.json(
          { error: `CoinGecko API error: ${response.status}`, details: errorText.substring(0, 200) },
          { status: response.status }
        );
      }

      const data = await response.json();

    // Transform data to our format
    // CoinGecko returns: { "0x...": { "usd": 5.42, "usd_24h_change": -2.5 } }
    // We return: { "0x...": { price: 5.42, change24h: -2.5 } }
    const result: Record<string, { price: number; change24h: number }> = {};

    for (const address of addresses) {
      const addressLower = address.toLowerCase();
      if (data[addressLower]) {
        let price = data[addressLower].usd || 0;
        
        // 🛡️ SANITY CHECK: Detect abnormally high prices (>$100k per token)
        // This prevents incorrect value calculations from API errors or stale data
        if (price > 100000) {
          logger.warn(`⚠️ [Prices by Address] SUSPICIOUS HIGH PRICE for ${addressLower.substring(0, 10)}...: $${price.toFixed(2)}`);
          logger.warn(`   This price seems abnormally high (>$100k). Possible causes:`);
          logger.warn(`   1. CoinGecko API error`);
          logger.warn(`   2. Price in wrong unit (e.g., per 1e18 tokens instead of per token)`);
          logger.warn(`   3. Stale or corrupted data`);
          logger.warn(`   Setting price to 0 - will fallback to DexScreener if available.`);
          price = 0; // Set to 0 so fallback can try DexScreener
        }
        
        result[addressLower] = {
          price,
          change24h: data[addressLower].usd_24h_change || 0,
        };
        
        if (price > 0) {
          logger.log(`✅ [Prices by Address] ${addressLower.substring(0, 10)}...: $${result[addressLower].price.toFixed(6)}`);
        } else {
          logger.log(`⚠️ [Prices by Address] ${addressLower.substring(0, 10)}...: Price set to 0 (sanity check failed)`);
        }
      } else {
        // Address not found in CoinGecko
        result[addressLower] = {
          price: 0,
          change24h: 0,
        };
        logger.warn(`⚠️ [Prices by Address] No data for ${addressLower.substring(0, 10)}...`);
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      },
    });

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('❌ [Prices by Address] Request timeout after 10 seconds');
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    logger.error('❌ [Prices by Address] Error:', error);
    logger.error('❌ [Prices by Address] Error details:', {
      message: error?.message,
      stack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      { error: 'Failed to fetch token prices', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

