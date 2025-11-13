import { NextRequest, NextResponse } from 'next/server';

// Retry helper for API calls with exponential backoff
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // If rate limited (429) or server error (5xx), retry
      if (response.status === 429 || response.status >= 500) {
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`   ⏳ Rate limited or server error, retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000;
        console.log(`   ⏳ Request failed, retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const address = searchParams.get('address');
    const limit = searchParams.get('limit') || '10';

    if (!chainId || !address) {
      return NextResponse.json(
        { error: 'Missing chainId or address parameter' },
        { status: 400 }
      );
    }

    // Get API key based on chain - use native APIs for better reliability
    const getApiKey = (chain: string): string => {
      const keys: Record<string, string | undefined> = {
        '1': process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '11155111': process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '56': process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '97': process.env.NEXT_PUBLIC_BSCSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '137': process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '42161': process.env.NEXT_PUBLIC_ARBISCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '10': process.env.NEXT_PUBLIC_OPTIMISM_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
        '8453': process.env.NEXT_PUBLIC_BASESCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
      };
      return keys[chain] || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
    };

    // Native API endpoints for better reliability and rate limits
    const apiConfig: Record<string, { url: string; v2: boolean }> = {
      '1': { url: 'https://api.etherscan.io/api', v2: false }, // Ethereum Mainnet
      '11155111': { url: 'https://api-sepolia.etherscan.io/api', v2: false }, // Sepolia
      '56': { url: 'https://api.bscscan.com/api', v2: false }, // BSC Mainnet (Native)
      '97': { url: 'https://api-testnet.bscscan.com/api', v2: false }, // BSC Testnet (Native)
      '137': { url: 'https://api.polygonscan.com/api', v2: false }, // Polygon
      '42161': { url: 'https://api.arbiscan.io/api', v2: false }, // Arbitrum
      '10': { url: 'https://api-optimistic.etherscan.io/api', v2: false }, // Optimism
      '8453': { url: 'https://api.basescan.org/api', v2: false }, // Base
    };

    const config = apiConfig[chainId];
    const apiKey = getApiKey(chainId);

    if (!config) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'No API key configured',
          message: 'Add NEXT_PUBLIC_ETHERSCAN_API_KEY to environment variables'
        },
        { status: 503 }
      );
    }

    // Build API URL - all chains use standard V1 format now
    const apiUrl = `${config.url}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;

    console.log(`🔍 Fetching transactions for chain ${chainId} from ${config.url}...`);
    console.log(`   Address: ${address}`);
    console.log(`   API Key: ${apiKey ? 'Present' : 'Missing'}`);

    const response = await fetchWithRetry(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BlazeWallet/1.0',
      },
    }, 3);

    if (!response.ok) {
      console.error(`❌ API returned status ${response.status}`);
      const errorText = await response.text();
      console.error(`   Error response: ${errorText.substring(0, 200)}`);
      throw new Error(`Block explorer API returned ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    
    // Log API response for debugging
    console.log(`   API Status: ${data.status}`);
    console.log(`   Message: ${data.message}`);
    console.log(`   Result count: ${Array.isArray(data.result) ? data.result.length : 'N/A'}`);

    // Add CORS headers (secure - whitelist only)
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://blazewallet.io',
      'https://my.blazewallet.io',
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    
    // Allow Vercel preview deployments (specific pattern)
    const isVercelPreview = origin?.match(
      /^https:\/\/blaze-wallet-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/
    );
    
    let corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    };
    
    if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin'; // Important for CDN caching
    }
    
    return NextResponse.json(data, { headers: corsHeaders });

  } catch (error: any) {
    console.error('Transaction proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS (secure - whitelist only)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://blazewallet.io',
    'https://my.blazewallet.io',
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  const isVercelPreview = origin?.match(
    /^https:\/\/blaze-wallet-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/
  );
  
  let corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
  };
  
  if (origin && (allowedOrigins.includes(origin) || isVercelPreview)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Vary'] = 'Origin';
  }
  
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
