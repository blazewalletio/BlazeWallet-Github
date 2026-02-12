import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { LiFiService } from '@/lib/lifi-service';
import { isLiFiChainIdSupported } from '@/lib/lifi-chain-ids';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chainIds = searchParams.get('chainIds');
    
    if (!chainIds) {
      return NextResponse.json(
        { error: 'Missing required parameter: chainIds' },
        { status: 400 }
      );
    }

    const chainIdArray = chainIds
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && isLiFiChainIdSupported(id));
    
    if (chainIdArray.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or unsupported chainIds parameter' },
        { status: 400 }
      );
    }

    const lifiApiKey = process.env.LIFI_API_KEY;

    logger.log('📊 Fetching Li.Fi tokens via API route:', {
      chainIds: chainIdArray,
    });

    const tokens = await LiFiService.getTokens(chainIdArray, lifiApiKey);

    if (!tokens || Object.keys(tokens).length === 0) {
      logger.warn('⚠️ No tokens returned from Li.Fi');
      return NextResponse.json(
        { error: 'No tokens found for the specified chains' },
        { status: 404 }
      );
    }

    logger.log(`✅ Li.Fi tokens received via API route: ${Object.keys(tokens).length} chains`);
    return NextResponse.json({ success: true, tokens });

  } catch (error: any) {
    logger.error('Li.Fi tokens error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens', details: error.message },
      { status: 500 }
    );
  }
}

