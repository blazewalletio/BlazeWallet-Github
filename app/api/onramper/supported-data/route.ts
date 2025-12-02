import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { OnramperService } from '@/lib/onramper-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const onramperApiKey = process.env.ONRAMPER_API_KEY;
    if (!onramperApiKey) {
      logger.error('ONRAMPER_API_KEY is not set in environment variables.');
      return NextResponse.json(
        { error: 'Onramper not configured', message: 'Please add ONRAMPER_API_KEY to environment variables' },
        { status: 503 }
      );
    }

    logger.log('📊 Fetching Onramper supported data...');

    // Get supported data from Onramper
    const supportedData = await OnramperService.getSupportedData(onramperApiKey);

    if (!supportedData) {
      return NextResponse.json(
        { error: 'Failed to fetch supported data from Onramper' },
        { status: 500 }
      );
    }

    logger.log('✅ Onramper supported data received');
    return NextResponse.json({ success: true, ...supportedData });

  } catch (error: any) {
    logger.error('Onramper supported-data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch supported data', details: error.message },
      { status: 500 }
    );
  }
}

