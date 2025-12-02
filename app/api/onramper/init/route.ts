/**
 * 🔒 ONRAMPER API - Server-Side Widget Initialization
 * 
 * ⚠️ DEPRECATED: This route is no longer used in the new custom UI implementation.
 * The new BuyModal uses /api/onramper/quotes, /api/onramper/supported-data, and /api/onramper/create-transaction
 * 
 * This route is kept for backward compatibility but returns an error to prevent confusion.
 * 
 * Docs: https://docs.onramper.com/docs/integration-steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // This route is deprecated - return error to prevent confusion
  logger.warn('⚠️ Deprecated /api/onramper/init route called - use new custom UI routes instead');
  return NextResponse.json(
    { 
      error: 'This route is deprecated',
      message: 'Please use the new custom UI. The BuyModal has been updated to use /api/onramper/quotes, /api/onramper/supported-data, and /api/onramper/create-transaction'
    },
    { status: 410 } // 410 Gone - resource is no longer available
  );
}
