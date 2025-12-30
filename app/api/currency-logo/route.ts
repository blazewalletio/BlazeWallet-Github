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

    // ✅ FALLBACK: Try DexScreener for token logo if we have contract address
    if (contractAddress && platform === 'ethereum') {
      try {
        logger.log(`[CurrencyLogo] Trying DexScreener for ${symbol} (${contractAddress.substring(0, 10)}...)`);
        const dexScreenerResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (dexScreenerResponse.ok) {
          const dexData = await dexScreenerResponse.json();
          logger.log(`[CurrencyLogo] DexScreener returned ${dexData.pairs?.length || 0} pairs for ${symbol}`);
          
          if (dexData.pairs && dexData.pairs.length > 0) {
            const contractLower = contractAddress.toLowerCase();
            
            // ✅ FIX: First filter pairs where our token is the BASE token
            const validPairs = dexData.pairs.filter((pair: any) => {
              const baseAddress = pair.baseToken?.address?.toLowerCase();
              return baseAddress === contractLower;
            });

            logger.log(`[CurrencyLogo] Found ${validPairs.length} pairs with ${symbol} as base token`);

            // Get the pair with highest liquidity from valid pairs
            const pairsToSearch = validPairs.length > 0 ? validPairs : dexData.pairs;
            const bestPair = pairsToSearch.reduce((best: any, current: any) => {
              const bestLiq = best.liquidity?.usd || 0;
              const currentLiq = current.liquidity?.usd || 0;
              return currentLiq > bestLiq ? current : best;
            }, pairsToSearch[0]);

            // Try multiple logo sources - check all possible locations
            const logoUrl = bestPair.info?.imageUrl || 
                           bestPair.baseToken?.imageUrl || 
                           bestPair.quoteToken?.imageUrl ||
                           bestPair.baseToken?.logoURI ||
                           bestPair.quoteToken?.logoURI;

            logger.log(`[CurrencyLogo] DexScreener logo check for ${symbol}:`, {
              infoImageUrl: bestPair.info?.imageUrl || 'none',
              baseTokenImageUrl: bestPair.baseToken?.imageUrl || 'none',
              quoteTokenImageUrl: bestPair.quoteToken?.imageUrl || 'none',
              baseTokenLogoURI: bestPair.baseToken?.logoURI || 'none',
              quoteTokenLogoURI: bestPair.quoteToken?.logoURI || 'none',
              found: !!logoUrl
            });

            if (logoUrl) {
              logger.log(`[CurrencyLogo] ✅ Found logo via DexScreener for ${symbol}: ${logoUrl}`);
              return NextResponse.json({
                logo: logoUrl,
                source: 'dexscreener',
              });
            } else {
              logger.warn(`[CurrencyLogo] DexScreener returned pairs but no logo for ${symbol}`);
            }
          } else {
            logger.warn(`[CurrencyLogo] DexScreener returned no pairs for ${symbol}`);
          }
        } else {
          logger.warn(`[CurrencyLogo] DexScreener API returned ${dexScreenerResponse.status} for ${symbol}`);
        }
      } catch (error) {
        logger.warn(`[CurrencyLogo] DexScreener fallback failed for ${symbol}:`, error);
      }
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

