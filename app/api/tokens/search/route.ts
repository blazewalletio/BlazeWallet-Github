import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

/**
 * Smart Token Search API
 * Searches tokens server-side for fast results without loading all tokens client-side
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase().trim() || '';
    const chainKey = searchParams.get('chain') || 'solana';
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!query || query.length < 2) {
      return NextResponse.json({ tokens: [] });
    }

    logger.log(`🔍 [TokenSearch] Searching for "${query}" on ${chainKey}...`);

    let tokens: any[] = [];

    // Fetch tokens based on chain
    if (chainKey === 'solana') {
      try {
        const jupiterResponse = await fetch('https://token.jup.ag/all', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (jupiterResponse.ok) {
          const allTokens: any[] = await jupiterResponse.json();
          
          // Filter tokens that match search query
          tokens = allTokens
            .filter(t => {
              const symbol = (t.symbol || '').toLowerCase();
              const name = (t.name || '').toLowerCase();
              const address = (t.address || '').toLowerCase();
              const searchLower = query.toLowerCase();
              
              return symbol.includes(searchLower) || 
                     name.includes(searchLower) || 
                     address.includes(searchLower);
            })
            .slice(0, limit)
            .map(t => ({
              address: t.address,
              symbol: t.symbol,
              name: t.name || t.symbol,
              decimals: t.decimals || 9,
              logoURI: t.logoURI || '',
            }));
        }
      } catch (error) {
        logger.error('❌ [TokenSearch] Jupiter search failed:', error);
      }
    } else if (chainKey === 'ethereum') {
      try {
        // Use our ethereum-tokens API
        const ethereumResponse = await fetch(`${request.nextUrl.origin}/api/ethereum-tokens`, {
          signal: AbortSignal.timeout(10000),
        });

        if (ethereumResponse.ok) {
          const allTokens: any[] = await ethereumResponse.json();
          
          // Filter tokens that match search query
          tokens = allTokens
            .filter(t => {
              const symbol = (t.symbol || '').toLowerCase();
              const name = (t.name || '').toLowerCase();
              const address = (t.address || '').toLowerCase();
              const searchLower = query.toLowerCase();
              
              return symbol.includes(searchLower) || 
                     name.includes(searchLower) || 
                     address.includes(searchLower);
            })
            .slice(0, limit)
            .map(t => ({
              address: t.address.toLowerCase(),
              symbol: t.symbol,
              name: t.name || t.symbol,
              decimals: t.decimals || 18,
              logoURI: t.logoURI || '',
            }));
        }
      } catch (error) {
        logger.error('❌ [TokenSearch] Ethereum search failed:', error);
      }
    }

    logger.log(`✅ [TokenSearch] Found ${tokens.length} tokens matching "${query}"`);
    
    return NextResponse.json({ tokens }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    logger.error('❌ [TokenSearch] Error:', error);
    return NextResponse.json({ tokens: [] }, { status: 200 });
  }
}

