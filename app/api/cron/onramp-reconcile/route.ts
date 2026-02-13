import { NextRequest, NextResponse } from 'next/server';
import { reconcileOnrampTransactions } from '@/lib/server/onramp-reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (cronSecret && !isVercelCron && bearerToken !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await reconcileOnrampTransactions({
      maxRows: 200,
      includeFresh: false,
    });

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Cron reconcile failed' },
      { status: 500 }
    );
  }
}

