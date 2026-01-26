/**
 * Token Logo Proxy API
 * 
 * Server-side proxy to fetch token logos and bypass CORS restrictions.
 * Supports multiple sources with automatic fallback.
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache logos for 7 days
const CACHE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * GET /api/token-logo?address=xxx&chainKey=solana&symbol=JUP
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');
  const chainKey = searchParams.get('chainKey');
  const symbol = searchParams.get('symbol');

  if (!address || !chainKey) {
    return NextResponse.json(
      { error: 'Missing required params: address, chainKey' },
      { status: 400 }
    );
  }

  try {
    let logoUrl: string | null = null;

    // Strategy 1: CoinGecko CDN (works for most tokens)
    const coingeckoUrls = [
      // Try common CoinGecko patterns
      `https://assets.coingecko.com/coins/images/${symbol?.toLowerCase()}.png`,
      `https://s2.coinmarketcap.com/static/img/coins/64x64/${symbol?.toLowerCase()}.png`,
    ];

    // Strategy 2: Solana-specific sources
    if (chainKey === 'solana') {
      const solanaUrls = [
        // GitHub Solana Token Registry
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.png`,
        // Try CDN
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.svg`,
      ];
      coingeckoUrls.push(...solanaUrls);
    }

    // Strategy 3: Trust Wallet Assets
    const chainMapping: Record<string, string> = {
      ethereum: 'ethereum',
      bsc: 'smartchain',
      polygon: 'polygon',
      solana: 'solana',
      avalanche: 'avalanchec',
      arbitrum: 'arbitrum',
      optimism: 'optimism',
    };

    const trustWalletChain = chainMapping[chainKey];
    if (trustWalletChain) {
      coingeckoUrls.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${trustWalletChain}/assets/${address}/logo.png`
      );
    }

    // Try all sources
    for (const url of coingeckoUrls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
        });
        
        if (response.ok) {
          logoUrl = url;
          break;
        }
      } catch {
        continue;
      }
    }

    // If no logo found, return 404
    if (!logoUrl) {
      return NextResponse.json(
        { error: 'Logo not found', address, chainKey },
        { status: 404 }
      );
    }

    // Fetch the actual image
    const imageResponse = await fetch(logoUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch logo' },
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
    console.error('Token logo fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

