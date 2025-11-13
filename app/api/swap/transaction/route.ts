import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// 1inch swap transaction endpoint
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const chainId = searchParams.get('chainId');
  const src = searchParams.get('src');
  const dst = searchParams.get('dst');
  const amount = searchParams.get('amount');
  const from = searchParams.get('from');
  const slippage = searchParams.get('slippage') || '1';

  if (!chainId || !src || !dst || !amount || !from) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Only support 1inch API (requires key)
  if (!ONEINCH_API_KEY) {
    return NextResponse.json(
      { error: '1inch API key not configured. Use Uniswap routing instead.' },
      { status: 503 }
    );
  }

  try {
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/swap?src=${src}&dst=${dst}&amount=${amount}&from=${from}&slippage=${slippage}&disableEstimate=true`;
    
    logger.log('1inch swap transaction request...');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      logger.log('✅ 1inch swap transaction ready');
      
      return NextResponse.json(data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });
    }

    const errorText = await response.text();
    logger.error('1inch swap error:', response.status, errorText);
    
    return NextResponse.json(
      { error: `1inch API error: ${response.status}` },
      { status: response.status }
    );
  } catch (error) {
    logger.error('1inch swap failed:', error);
    return NextResponse.json(
      { error: 'Swap transaction failed' },
      { status: 500 }
    );
  }
}




