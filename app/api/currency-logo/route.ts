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
    logger.log(`[CurrencyLogo] 🔍 Fetching logo for ${symbol} (contract: ${contractAddress || 'none'})`);
    
    // If we have a contract address, use it for more accurate results
    if (contractAddress) {
      const url = `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}${coinGeckoApiKey ? `?x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`;
      logger.log(`[CurrencyLogo] 🌐 CoinGecko URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      logger.log(`[CurrencyLogo] 📊 CoinGecko status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        
        // ✅ LOG THE FULL RESPONSE TO SEE WHAT WE'RE GETTING
        logger.log(`[CurrencyLogo] 📦 CoinGecko full response for ${symbol}:`, JSON.stringify({
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          image: data.image,
          hasImage: !!data.image,
          imageLarge: data.image?.large,
          imageSmall: data.image?.small,
          imageThumb: data.image?.thumb,
        }, null, 2));

        // ✅ CHECK ALL POSSIBLE IMAGE FIELDS
        const logoUrl = data.image?.large || data.image?.small || data.image?.thumb;
        
        if (logoUrl) {
          logger.log(`[CurrencyLogo] ✅ Found logo via CoinGecko contract lookup: ${logoUrl}`);
          return NextResponse.json({
            logo: logoUrl,
            source: 'coingecko-contract',
          });
        } else {
          logger.warn(`[CurrencyLogo] ⚠️ CoinGecko returned data but no image fields for ${symbol}`);
        }
      } else if (response.status === 404) {
        // Token not found by contract address, continue to symbol search
        logger.warn(`[CurrencyLogo] 404: Token not found by contract address: ${contractAddress}`);
      } else if (response.status === 401) {
        logger.warn(`[CurrencyLogo] 401: CoinGecko API key missing or invalid`);
      } else if (response.status === 429) {
        logger.warn(`[CurrencyLogo] 429: CoinGecko rate limit exceeded`);
      } else {
        logger.warn(`[CurrencyLogo] ${response.status}: CoinGecko returned error`);
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
      logger.log(`[CurrencyLogo] 🔍 Trying CoinGecko ID mapping: ${symbol} -> ${coinId}`);
      
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}${coinGeckoApiKey ? `?x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      logger.log(`[CurrencyLogo] 📊 CoinGecko ID lookup status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        
        logger.log(`[CurrencyLogo] 📦 CoinGecko ID response:`, JSON.stringify({
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          image: data.image,
        }, null, 2));
        
        const logoUrl = data.image?.large || data.image?.small || data.image?.thumb;
        
        if (logoUrl) {
          logger.log(`[CurrencyLogo] ✅ Found logo via CoinGecko ID: ${logoUrl}`);
          return NextResponse.json({
            logo: logoUrl,
            source: 'coingecko-id',
          });
        }
      } else if (response.status === 401) {
        logger.warn(`[CurrencyLogo] 401: CoinGecko API key missing or invalid`);
      } else if (response.status === 429) {
        logger.warn(`[CurrencyLogo] 429: CoinGecko rate limit exceeded`);
      }
    } else {
      logger.log(`[CurrencyLogo] ⚠️ No CoinGecko ID mapping found for symbol: ${symbol}`);
    }

    // Last resort: search by symbol name
    logger.log(`[CurrencyLogo] 🔍 Trying CoinGecko search API for: ${symbol}`);
    
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}${coinGeckoApiKey ? `&x_cg_demo_api_key=${coinGeckoApiKey}` : ''}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    logger.log(`[CurrencyLogo] 📊 CoinGecko search status: ${searchResponse.status}`);

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      
      logger.log(`[CurrencyLogo] 📦 CoinGecko search returned ${searchData.coins?.length || 0} results`);
      
      if (searchData.coins && searchData.coins.length > 0) {
        logger.log(`[CurrencyLogo] 📦 First 3 search results:`, JSON.stringify(
          searchData.coins.slice(0, 3).map((c: any) => ({
            id: c.id,
            symbol: c.symbol,
            name: c.name,
            thumb: c.thumb,
            large: c.large,
          })),
          null,
          2
        ));
      }
      
      const coin = searchData.coins?.[0];
      const logoUrl = coin?.large || coin?.thumb;
      
      if (logoUrl) {
        logger.log(`[CurrencyLogo] ✅ Found logo via CoinGecko search: ${logoUrl}`);
        return NextResponse.json({
          logo: logoUrl,
          source: 'coingecko-search',
        });
      }
    } else if (searchResponse.status === 401) {
      logger.warn(`[CurrencyLogo] 401: CoinGecko API key missing or invalid`);
    } else if (searchResponse.status === 429) {
      logger.warn(`[CurrencyLogo] 429: CoinGecko rate limit exceeded`);
    }

    // ✅ FALLBACK 1: Try DexScreener for token logo if we have contract address
    if (contractAddress && platform === 'ethereum') {
      try {
        logger.log(`[CurrencyLogo] 🔍 Trying DexScreener for ${symbol} (${contractAddress.substring(0, 10)}...)`);
        
        const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
        logger.log(`[CurrencyLogo] 🌐 DexScreener URL: ${dexUrl}`);
        
        const dexScreenerResponse = await fetch(dexUrl, {
          headers: {
            'Accept': 'application/json',
          },
        });

        logger.log(`[CurrencyLogo] 📊 DexScreener status: ${dexScreenerResponse.status}`);

        if (dexScreenerResponse.ok) {
          const dexData = await dexScreenerResponse.json();
          
          logger.log(`[CurrencyLogo] 📦 DexScreener returned ${dexData.pairs?.length || 0} pairs for ${symbol}`);
          
          if (dexData.pairs && dexData.pairs.length > 0) {
            const contractLower = contractAddress.toLowerCase();
            
            // Log first pair structure to see what we're working with
            logger.log(`[CurrencyLogo] 📦 First pair structure:`, JSON.stringify({
              baseToken: {
                address: dexData.pairs[0].baseToken?.address,
                symbol: dexData.pairs[0].baseToken?.symbol,
                name: dexData.pairs[0].baseToken?.name,
              },
              quoteToken: {
                address: dexData.pairs[0].quoteToken?.address,
                symbol: dexData.pairs[0].quoteToken?.symbol,
              },
              info: dexData.pairs[0].info,
              liquidity: dexData.pairs[0].liquidity,
            }, null, 2));
            
            // ✅ FIX: First filter pairs where our token is the BASE token
            const validPairs = dexData.pairs.filter((pair: any) => {
              const baseAddress = pair.baseToken?.address?.toLowerCase();
              return baseAddress === contractLower;
            });

            logger.log(`[CurrencyLogo] ✅ Found ${validPairs.length}/${dexData.pairs.length} pairs with ${symbol} as base token`);

            // Get the pair with highest liquidity from valid pairs
            const pairsToSearch = validPairs.length > 0 ? validPairs : dexData.pairs;
            const bestPair = pairsToSearch.reduce((best: any, current: any) => {
              const bestLiq = best.liquidity?.usd || 0;
              const currentLiq = current.liquidity?.usd || 0;
              return currentLiq > bestLiq ? current : best;
            }, pairsToSearch[0]);

            logger.log(`[CurrencyLogo] 🏆 Best pair selected:`, {
              baseSymbol: bestPair.baseToken?.symbol,
              quoteSymbol: bestPair.quoteToken?.symbol,
              liquidity: bestPair.liquidity?.usd,
              dexId: bestPair.dexId,
            });

            // Try multiple logo sources - check all possible locations
            const logoUrl = bestPair.info?.imageUrl || 
                           bestPair.baseToken?.imageUrl || 
                           bestPair.quoteToken?.imageUrl ||
                           bestPair.baseToken?.logoURI ||
                           bestPair.quoteToken?.logoURI;

            logger.log(`[CurrencyLogo] 🖼️ Logo sources check:`, {
              infoImageUrl: bestPair.info?.imageUrl || 'NONE',
              baseTokenImageUrl: bestPair.baseToken?.imageUrl || 'NONE',
              quoteTokenImageUrl: bestPair.quoteToken?.imageUrl || 'NONE',
              baseTokenLogoURI: bestPair.baseToken?.logoURI || 'NONE',
              quoteTokenLogoURI: bestPair.quoteToken?.logoURI || 'NONE',
              finalLogo: logoUrl || 'NONE',
            });

            if (logoUrl) {
              logger.log(`[CurrencyLogo] ✅ Found logo via DexScreener for ${symbol}: ${logoUrl}`);
              return NextResponse.json({
                logo: logoUrl,
                source: 'dexscreener',
              });
            } else {
              logger.warn(`[CurrencyLogo] ⚠️ DexScreener returned pairs but no logo URLs found for ${symbol}`);
            }
          } else {
            logger.warn(`[CurrencyLogo] ⚠️ DexScreener returned no pairs for ${symbol}`);
          }
        } else {
          logger.warn(`[CurrencyLogo] ${dexScreenerResponse.status}: DexScreener API returned error for ${symbol}`);
        }
      } catch (error: any) {
        logger.warn(`[CurrencyLogo] ❌ DexScreener fallback failed for ${symbol}:`, error.message);
      }
    }

    // ✅ FALLBACK 2: Try Uniswap Token List (extensive list with many token logos)
    if (contractAddress && platform === 'ethereum') {
      try {
        logger.log(`[CurrencyLogo] Trying Uniswap token list for ${symbol} (${contractAddress.substring(0, 10)}...)`);
        
        // Uniswap token list endpoints
        const uniswapLists = [
          'https://raw.githubusercontent.com/uniswap/default-token-list/main/src/tokens/ethereum.json',
          'https://tokens.uniswap.org', // This might redirect or need different handling
        ];

        for (const listUrl of uniswapLists) {
          try {
            const listResponse = await fetch(listUrl, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(5000),
            });

            if (listResponse.ok) {
              const listData = await listResponse.json();
              // Uniswap token list format: { tokens: [...] } or direct array
              const tokens = Array.isArray(listData) ? listData : (listData.tokens || []);
              
              logger.log(`[CurrencyLogo] Uniswap list has ${tokens.length} tokens`);
              
              const contractLower = contractAddress.toLowerCase();
              const token = tokens.find((t: any) => 
                t.address?.toLowerCase() === contractLower
              );

              if (token?.logoURI) {
                logger.log(`[CurrencyLogo] ✅ Found logo via Uniswap list for ${symbol}: ${token.logoURI}`);
                return NextResponse.json({
                  logo: token.logoURI,
                  source: 'uniswap-list',
                });
              } else if (token) {
                logger.warn(`[CurrencyLogo] Token found in Uniswap list but no logoURI for ${symbol}`);
              }
            } else {
              logger.warn(`[CurrencyLogo] Uniswap list ${listUrl} returned ${listResponse.status}`);
            }
          } catch (listError: any) {
            // Continue to next list
            logger.warn(`[CurrencyLogo] Uniswap list ${listUrl} failed:`, listError.message);
          }
        }
        
        logger.warn(`[CurrencyLogo] Uniswap token list returned no logo for ${symbol}`);
      } catch (error) {
        logger.warn(`[CurrencyLogo] Uniswap list fallback failed for ${symbol}:`, error);
      }
    }

    // ✅ FALLBACK 3: Try 1inch Token List (another comprehensive token list)
    if (contractAddress && platform === 'ethereum') {
      try {
        logger.log(`[CurrencyLogo] Trying 1inch token list for ${symbol} (${contractAddress.substring(0, 10)}...)`);
        
        const oneInchResponse = await fetch(
          `https://tokens.1inch.io/v1.1/1`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        );

        if (oneInchResponse.ok) {
          const oneInchData = await oneInchResponse.json();
          const tokens = Array.isArray(oneInchData) ? oneInchData : (oneInchData.tokens || []);
          
          logger.log(`[CurrencyLogo] 1inch list has ${tokens.length} tokens`);
          
          const contractLower = contractAddress.toLowerCase();
          const token = tokens.find((t: any) => 
            t.address?.toLowerCase() === contractLower
          );

          if (token?.logoURI || token?.logo) {
            const logoUrl = token.logoURI || token.logo;
            logger.log(`[CurrencyLogo] ✅ Found logo via 1inch list for ${symbol}: ${logoUrl}`);
            return NextResponse.json({
              logo: logoUrl,
              source: '1inch-list',
            });
          }
        }
      } catch (error) {
        logger.warn(`[CurrencyLogo] 1inch list fallback failed for ${symbol}:`, error);
      }
    }

    // No logo found
    logger.warn(`[CurrencyLogo] ❌ No logo found for ${symbol} (${contractAddress?.substring(0, 10) || 'N/A'}...) after all fallbacks`);
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

