import { NextRequest, NextResponse } from 'next/server';
import { ChangeNowService } from '@/lib/changenow-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.CHANGENOW_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ChangeNOW is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const status = await ChangeNowService.getStatus({ apiKey, id });
    return NextResponse.json({ success: true, routeEngine: 'changenow', status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch ChangeNOW status' }, { status: 400 });
  }
}

