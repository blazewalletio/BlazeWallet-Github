/**
 * Token Logo API Proxy (ENHANCED with CoinGecko Pro API)
 * 
 * Server-side proxy to fetch token logos from multiple sources:
 * 1. Known token mappings (instant, reliable)
 * 2. CoinGecko Pro API (comprehensive coverage, all chains)
 * 3. Chain-specific sources (Jupiter for Solana, Trust Wallet for EVM)
 * 4. Direct logoURI (fallback)
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache logos for 7 days
const CACHE_MAX_AGE = 60 * 60 * 24 * 7;

// CoinGecko Pro API configuration
const COINGECKO_PRO_API_BASE = 'https://pro-api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY?.trim();

// Platform IDs for CoinGecko API
const PLATFORM_IDS: Record<string, string> = {
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  base: 'base',
  optimism: 'optimistic-ethereum',
  bsc: 'binance-smart-chain',
  avalanche: 'avalanche',
  fantom: 'fantom',
  cronos: 'cronos',
  zksync: 'zksync',
  linea: 'linea',
  solana: 'solana',
};

// Known token logos (native tokens + popular coins for instant loading)
const KNOWN_LOGOS: Record<string, Record<string, string>> = {
  ethereum: {
    // Native
    '0x0000000000000000000000000000000000000000': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    // Top stablecoins
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png',
    // Top wrapped tokens
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
    // Other known tokens with CoinGecko issues
    '0x808507121b80c02388fad14726482e061b8da827': 'https://coin-images.coingecko.com/coins/images/15069/large/Pendle_Logo_Normal-03.png',
  },
  solana: {
    'So11111111111111111111111111111111111111112': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
  },
};

/**
 * Fetch logo from CoinGecko Pro API (multi-method fallback)
 */
async function fetchFromCoinGecko(
  chainKey: string,
  address: string,
  symbol: string
): Promise<string | null> {
  if (!COINGECKO_API_KEY) {
    console.warn('[Token Logo API] CoinGecko API key not configured');
    return null;
  }

  const platformId = PLATFORM_IDS[chainKey];
  if (!platformId) {
    return null;
  }

  try {
    // Method 1: Try contract address lookup (most accurate)
    try {
      const contractUrl = `${COINGECKO_PRO_API_BASE}/coins/${platformId}/contract/${address}?x_cg_pro_api_key=${COINGECKO_API_KEY}`;
      const contractResponse = await fetch(contractUrl, {
        headers: {
          'User-Agent': 'BlazeWallet/1.0 (https://blazewallet.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (contractResponse.ok) {
        const data = await contractResponse.json();
        const logoUrl = data.image?.large || data.image?.small || data.image?.thumb;
        if (logoUrl && !logoUrl.includes('missing')) {
          console.log(`[Token Logo API] ✅ Found via CoinGecko contract API: ${symbol}`);
          return logoUrl;
        }
      }
    } catch (contractError) {
      // Continue to search fallback
    }

    // Method 2: Try search API (broader coverage)
    try {
      const searchUrl = `${COINGECKO_PRO_API_BASE}/search?query=${encodeURIComponent(symbol)}&x_cg_pro_api_key=${COINGECKO_API_KEY}`;
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'BlazeWallet/1.0 (https://blazewallet.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (searchResponse.ok) {
        const data = await searchResponse.json();
        
        if (data.coins && data.coins.length > 0) {
          // Try to find exact platform match
          const exactMatch = data.coins.find((coin: any) => 
            coin.platforms && 
            coin.platforms[platformId]?.toLowerCase() === address.toLowerCase()
          );

          const coin = exactMatch || data.coins[0];
          const logoUrl = coin.large || coin.thumb;

          if (logoUrl && !logoUrl.includes('missing')) {
            console.log(`[Token Logo API] ✅ Found via CoinGecko search API: ${symbol} (${exactMatch ? 'exact' : 'fuzzy'} match)`);
            return logoUrl;
          }
        }
      }
    } catch (searchError) {
      // Continue to next source
    }

    return null;
  } catch (error: any) {
    console.error(`[Token Logo API] CoinGecko error for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Fetch logo from chain-specific sources
 */
async function fetchFromChainSources(
  chainKey: string,
  address: string
): Promise<string | null> {
  try {
    // Solana: Try Jupiter and Solana Token List
    if (chainKey === 'solana') {
      const sources = [
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.png`,
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.svg`,
      ];

      for (const url of sources) {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(2000),
          });
          if (response.ok) {
            return url;
          }
        } catch {
          continue;
        }
      }
    }

    // EVM chains: Try Trust Wallet
    const chainMapping: Record<string, string> = {
      ethereum: 'ethereum',
      bsc: 'smartchain',
      polygon: 'polygon',
      avalanche: 'avalanchec',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
      base: 'base',
      fantom: 'fantom',
      cronos: 'cronos',
    };

    const trustWalletChain = chainMapping[chainKey];
    if (trustWalletChain && address !== '0x0000000000000000000000000000000000000000') {
      const url = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletChain}/assets/${address}/logo.png`;
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          return url;
        }
      } catch {
        // Continue
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * GET /api/token-logo?address=xxx&chainKey=xxx&symbol=xxx&logoURI=xxx&returnUrl=true
 * 
 * Options:
 * - returnUrl=true: Return JSON with HTTPS URL (no caching, instant)
 * - returnUrl=false|undefined: Return image blob (cached, for persistent storage)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chainKey = searchParams.get('chainKey');
  const symbol = searchParams.get('symbol') || 'UNKNOWN';
  const logoURI = searchParams.get('logoURI');
  const returnUrl = searchParams.get('returnUrl') === 'true'; // ✅ NEW: Option to return URL only

  if (!address || !chainKey) {
    return NextResponse.json(
      { error: 'Missing required params: address, chainKey' },
      { status: 400 }
    );
  }

  try {
    let logoUrl: string | null = null;
    const normalizedAddress = address.toLowerCase();

    // Priority 1: Check known token mappings (instant)
    const knownLogo = KNOWN_LOGOS[chainKey]?.[normalizedAddress];
    if (knownLogo) {
      console.log(`[Token Logo API] ✅ Using known logo for ${symbol} (${chainKey})`);
      logoUrl = knownLogo;
    }

    // Priority 2: Try CoinGecko Pro API (comprehensive, all chains)
    if (!logoUrl) {
      logoUrl = await fetchFromCoinGecko(chainKey, address, symbol);
    }

    // Priority 3: Try chain-specific sources
    if (!logoUrl) {
      logoUrl = await fetchFromChainSources(chainKey, address);
      if (logoUrl) {
        console.log(`[Token Logo API] ✅ Found via chain-specific source: ${symbol}`);
      }
    }

    // Priority 4: Try direct logoURI (if provided)
    if (!logoUrl && logoURI) {
      try {
        const response = await fetch(logoURI, {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          logoUrl = logoURI;
          console.log(`[Token Logo API] ✅ Using direct logoURI for ${symbol}`);
        }
      } catch {
        // Continue
      }
    }

    // If no logo found, return 404
    if (!logoUrl) {
      console.warn(`[Token Logo API] ⚠️ No logo found for ${symbol} (${address}) on ${chainKey}`);
      return NextResponse.json(
        { error: 'Logo not found', address, chainKey, symbol },
        { status: 404 }
      );
    }

    // ✅ NEW: If returnUrl=true, return JSON with HTTPS URL (no blob fetching!)
    if (returnUrl) {
      return NextResponse.json(
        { imageUrl: logoUrl, symbol, chainKey },
        {
          status: 200,
          headers: {
            'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
          },
        }
      );
    }

    // ✅ DEFAULT: Fetch and return image blob (for persistent caching)
    const imageResponse = await fetch(logoUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image', url: logoUrl },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Return image with cache headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
        'CDN-Cache-Control': `public, max-age=${CACHE_MAX_AGE}`,
      },
    });
  } catch (error: any) {
    console.error(`[Token Logo API] ❌ Error for ${symbol}:`, error.message);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
