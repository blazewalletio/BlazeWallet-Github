import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering (required for API routes with query params)
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

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
    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${addresses.join(',')}&vs_currencies=usd&include_24hr_change=true`;

    console.log(`📡 [Prices by Address] Fetching from CoinGecko for ${addresses.length} addresses on ${chain}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`❌ [Prices by Address] CoinGecko error: ${response.status}`);
      return NextResponse.json(
        { error: `CoinGecko API error: ${response.status}` },
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
        result[addressLower] = {
          price: data[addressLower].usd || 0,
          change24h: data[addressLower].usd_24h_change || 0,
        };
        console.log(`✅ [Prices by Address] ${addressLower.substring(0, 10)}...: $${result[addressLower].price}`);
      } else {
        // Address not found in CoinGecko
        result[addressLower] = {
          price: 0,
          change24h: 0,
        };
        console.warn(`⚠️ [Prices by Address] No data for ${addressLower.substring(0, 10)}...`);
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      },
    });

  } catch (error) {
    console.error('❌ [Prices by Address] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token prices' },
      { status: 500 }
    );
  }
}

