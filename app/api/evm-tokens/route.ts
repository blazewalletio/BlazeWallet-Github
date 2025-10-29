/**
 * 🔥 EVM Token Balance Proxy API
 * 
 * This API route acts as a proxy to bypass CORS restrictions when calling
 * Alchemy RPC endpoints directly from the browser.
 * 
 * Why we need this:
 * - Alchemy blocks direct browser requests (CORS policy)
 * - Server-side requests bypass CORS restrictions
 * - Keeps RPC calls secure and centralized
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Use Edge runtime for better performance

// Alchemy RPC URLs for each chain
const ALCHEMY_RPCS: Record<string, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  polygon: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
  base: 'https://base-mainnet.g.alchemy.com/v2/demo',
  optimism: 'https://opt-mainnet.g.alchemy.com/v2/demo',
};

// Fallback public RPC URLs (if Alchemy fails)
const FALLBACK_RPCS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
  optimism: 'https://mainnet.optimism.io',
  bsc: 'https://bsc-dataseed.binance.org',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, method, params } = body;

    if (!chain || !method) {
      return NextResponse.json(
        { error: 'Missing chain or method parameter' },
        { status: 400 }
      );
    }

    console.log(`📡 [EVM-Tokens API] ${method} for ${chain}`);
    console.log(`📋 [EVM-Tokens API] Params:`, JSON.stringify(params, null, 2));

    // ✅ DIRECT TO PUBLIC RPC - Alchemy demo key doesn't support alchemy_* methods!
    // Only use Alchemy for standard eth_* methods
    const useAlchemy = method.startsWith('eth_') && ALCHEMY_RPCS[chain];
    
    if (useAlchemy) {
      const alchemyUrl = ALCHEMY_RPCS[chain];
      try {
        console.log(`🔗 [EVM-Tokens API] Trying Alchemy for ${method}...`);
        const response = await fetch(alchemyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method,
            params,
            id: 1,
          }),
        });

        if (!response.ok) {
          throw new Error(`Alchemy HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          console.warn(`⚠️ [EVM-Tokens API] Alchemy error:`, data.error.message);
          throw new Error(data.error.message);
        }

        console.log(`✅ [EVM-Tokens API] Success via Alchemy`);
        return NextResponse.json(data);
      } catch (alchemyError) {
        console.warn(`⚠️ [EVM-Tokens API] Alchemy failed, trying fallback...`);
        // Continue to fallback
      }
    }

    // Use public RPC for alchemy_* methods or as fallback
    const fallbackUrl = FALLBACK_RPCS[chain];
    if (!fallbackUrl) {
      return NextResponse.json(
        { error: `No RPC configured for chain: ${chain}` },
        { status: 400 }
      );
    }

    try {
      console.log(`🔗 [EVM-Tokens API] Using public RPC for ${method}...`);
      const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Public RPC HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error(`❌ [EVM-Tokens API] Public RPC error:`, data.error.message);
        console.error(`❌ [EVM-Tokens API] Error code:`, data.error.code);
        console.error(`❌ [EVM-Tokens API] Full error:`, JSON.stringify(data.error, null, 2));
        console.error(`❌ [EVM-Tokens API] Request that failed:`, JSON.stringify({ method, params }, null, 2));
        // Return the error to the client so it can handle it
        return NextResponse.json(data);
      }

      console.log(`✅ [EVM-Tokens API] Success via public RPC`);
      return NextResponse.json(data);
    } catch (fallbackError) {
      console.error(`❌ [EVM-Tokens API] Public RPC failed:`, fallbackError);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch token data',
          details: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [EVM-Tokens API] Fatal error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch token data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

