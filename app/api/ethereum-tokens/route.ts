import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Cache for 1 hour
export const revalidate = 3600;
export const runtime = 'edge';

/**
 * Fetch Ethereum token list from CoinGecko with fallback to popular tokens
 */
async function fetchEthereumTokensWithRetry(maxRetries = 3): Promise<any[]> {
  // Try CoinGecko API first (comprehensive token list)
  const coinGeckoUrl = 'https://api.coingecko.com/api/v3/coins/list?include_platform=true';
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.log(`🔷 [API] Attempt ${attempt + 1}/${maxRetries}, fetching from CoinGecko...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      const response = await fetch(coinGeckoUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BlazeWallet/2.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`⚠️ [API] CoinGecko returned ${response.status}`);
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const allCoins = await response.json();
      
      // Filter for Ethereum tokens only (platform: ethereum)
      const ethereumTokens = allCoins
        .filter((coin: any) => coin.platforms && coin.platforms.ethereum)
        .map((coin: any) => ({
          address: coin.platforms.ethereum.toLowerCase(),
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          decimals: 18, // Default, will be fetched on-chain if needed
          logoURI: `https://assets.coingecko.com/coins/images/${coin.id}/small.png`,
          coingeckoId: coin.id,
        }))
        .slice(0, 1000); // Limit to first 1000 tokens for performance
      
      logger.log(`✅ [API] Successfully fetched ${ethereumTokens.length} Ethereum tokens from CoinGecko`);
      return ethereumTokens;

    } catch (error: any) {
      logger.error(`❌ [API] Error fetching from CoinGecko:`, error.message);
      
      // Wait before retrying
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logger.log(`⏳ [API] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Fallback: Return popular Ethereum tokens (hardcoded)
  logger.log('⚠️ [API] CoinGecko failed, using popular tokens fallback');
  return getPopularEthereumTokens();
}

/**
 * Popular Ethereum tokens (fallback when API fails)
 */
function getPopularEthereumTokens(): any[] {
  return [
    {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      logoURI: '/crypto-usdt.png',
    },
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: '/crypto-usdc.png',
    },
    {
      address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      logoURI: '/crypto-wbtc.png',
    },
    {
      address: '0x514910771af9ca656af840dff83e8264ecf986ca',
      symbol: 'LINK',
      name: 'Chainlink',
      decimals: 18,
      logoURI: '/crypto-link.png',
    },
    {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      logoURI: '/crypto-dai.png',
    },
    {
      address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      logoURI: '/crypto-matic.png',
    },
    {
      address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
      symbol: 'SHIB',
      name: 'Shiba Inu',
      decimals: 18,
      logoURI: '/crypto-shib.png',
    },
    {
      address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      logoURI: '/crypto-uni.png',
    },
    {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      logoURI: '/crypto-eth.png',
    },
    {
      address: '0x4d224452801aced8b2f0aebe155379bb5d594381',
      symbol: 'APE',
      name: 'ApeCoin',
      decimals: 18,
      logoURI: '/crypto-ape.png',
    },
  ];
}

export async function GET(request: NextRequest) {
  try {
    logger.log('🔷 [API] Fetching Ethereum tokens...');
    
    const tokens = await fetchEthereumTokensWithRetry();
    
    logger.log(`✅ [API] Returning ${tokens.length} Ethereum tokens`);
    return NextResponse.json(tokens, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    logger.error('❌ [API] Error in Ethereum tokens route:', error);
    
    // Return popular tokens as fallback
    const fallbackTokens = getPopularEthereumTokens();
    logger.log(`⚠️ [API] Returning ${fallbackTokens.length} popular tokens as fallback`);
    
    return NextResponse.json(fallbackTokens, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }
}

