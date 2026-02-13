import { NextRequest, NextResponse } from 'next/server';
import { reconcileIncomingTransactions } from '@/lib/server/incoming-tx-reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';

    if (cronSecret && !isVercelCron && bearerToken !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const summary = await reconcileIncomingTransactions({
      maxRows: 400,
      txLimitPerAddress: 20,
    });

    return NextResponse.json({
      success: true,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Incoming reconcile failed' },
      { status: 500 }
    );
  }
}

