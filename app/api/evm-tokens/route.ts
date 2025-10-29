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

    // Try Alchemy first
    const alchemyUrl = ALCHEMY_RPCS[chain];
    if (alchemyUrl) {
      try {
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

        const data = await response.json();

        if (data.error) {
          console.warn(`⚠️ [EVM-Tokens API] Alchemy error for ${chain}:`, data.error);
          throw new Error(data.error.message);
        }

        console.log(`✅ [EVM-Tokens API] Success via Alchemy for ${chain}`);
        return NextResponse.json(data);
      } catch (alchemyError) {
        console.warn(`⚠️ [EVM-Tokens API] Alchemy failed for ${chain}, trying fallback...`);
      }
    }

    // Fallback to public RPC
    const fallbackUrl = FALLBACK_RPCS[chain];
    if (fallbackUrl) {
      try {
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

        const data = await response.json();

        if (data.error) {
          console.error(`❌ [EVM-Tokens API] Fallback error for ${chain}:`, data.error);
          throw new Error(data.error.message);
        }

        console.log(`✅ [EVM-Tokens API] Success via fallback for ${chain}`);
        return NextResponse.json(data);
      } catch (fallbackError) {
        console.error(`❌ [EVM-Tokens API] Fallback failed for ${chain}:`, fallbackError);
        throw fallbackError;
      }
    }

    return NextResponse.json(
      { error: `No RPC configured for chain: ${chain}` },
      { status: 400 }
    );
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

