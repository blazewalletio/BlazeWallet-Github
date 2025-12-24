import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Server-side API route for fetching currency logos
 * This avoids CSP/CORS issues with direct client-side CoinGecko API calls
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const contractAddress = searchParams.get('contractAddress');
  const platform = searchParams.get('platform') || 'ethereum';

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol is required' },
      { status: 400 }
    );
  }

  const coinGeckoApiKey = process.env.COINGECKO_API_KEY;

  try {
    // If we have a contract address, use it for more accurate results
    if (contractAddress) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}${coinGeckoApiKey ? `?x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.image?.large || data.image?.small) {
          return NextResponse.json({
            logo: data.image.large || data.image.small,
            source: 'coingecko-contract',
          });
        }
      } else if (response.status === 404) {
        // Token not found by contract address, continue to symbol search
        logger.warn(`[CurrencyLogo] Token not found by contract address: ${contractAddress}`);
      } else if (response.status === 401) {
        logger.warn(`[CurrencyLogo] CoinGecko API key missing or invalid`);
      } else if (response.status === 429) {
        logger.warn(`[CurrencyLogo] CoinGecko rate limit exceeded`);
      }
    }

    // Fallback: search by symbol using CoinGecko ID mapping
    const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
      'ETH': 'ethereum',
      'BTC': 'bitcoin',
      'SOL': 'solana',
      'MATIC': 'matic-network',
      'BNB': 'binancecoin',
      'AVAX': 'avalanche-2',
      'FTM': 'fantom',
      'CRO': 'crypto-com-chain',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'BCH': 'bitcoin-cash',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'WETH': 'weth',
      'DAI': 'dai',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'AAVE': 'aave',
      'WBTC': 'wrapped-bitcoin',
    };

    const coinId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];
    if (coinId) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}${coinGeckoApiKey ? `?x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.image?.large || data.image?.small) {
          return NextResponse.json({
            logo: data.image.large || data.image.small,
            source: 'coingecko-id',
          });
        }
      } else if (response.status === 401) {
        logger.warn(`[CurrencyLogo] CoinGecko API key missing or invalid`);
      } else if (response.status === 429) {
        logger.warn(`[CurrencyLogo] CoinGecko rate limit exceeded`);
      }
    }

    // Last resort: search by symbol name
    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}${coinGeckoApiKey ? `&x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const coin = searchData.coins?.[0];
      if (coin?.large || coin?.thumb) {
        return NextResponse.json({
          logo: coin.large || coin.thumb,
          source: 'coingecko-search',
        });
      }
    } else if (searchResponse.status === 401) {
      logger.warn(`[CurrencyLogo] CoinGecko API key missing or invalid`);
    } else if (searchResponse.status === 429) {
      logger.warn(`[CurrencyLogo] CoinGecko rate limit exceeded`);
    }

    // No logo found
    return NextResponse.json({
      logo: null,
      source: 'not-found',
    });
  } catch (error) {
    logger.error(`[CurrencyLogo] Error fetching logo for ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch logo' },
      { status: 500 }
    );
  }
}

